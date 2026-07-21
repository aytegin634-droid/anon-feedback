import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const supabase = await createClient()

  // проверка авторизации — статистика только для залогиненного менеджера
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? '30'  // дней
  const branch = searchParams.get('branch') ?? 'all'

  const since = new Date()
  if (period !== 'all') {
    since.setDate(since.getDate() - parseInt(period, 10))
  } else {
    since.setFullYear(2000)  // де-факто без фильтра
  }

  const [{ data: feedbacks }, { data: fields }] = await Promise.all([
    supabase
      .from('feedbacks')
      .select('id, answers, status, created_at, last_message_at')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('form_fields')
      .select('id, label, field_type, position, parent_field_id, options')
      .eq('form_id', '00000000-0000-0000-0000-000000000002')
  ])

  if (!feedbacks || !fields) {
    return NextResponse.json({ error: 'no_data' }, { status: 500 })
  }

  // фильтр по филиалу
  const branches = ['Араванская', 'Дом-Быта', 'Юго-Восток', 'Анар']
  const filtered = branch === 'all'
    ? feedbacks
    : feedbacks.filter((fb) => {
        const ans = fb.answers as Record<string, unknown>
        return Object.values(ans).some((v) => v === branch)
      })

  // карта полей по позиции для удобства
  const fieldByPos = new Map<number, typeof fields[0]>()
  for (const f of fields) fieldByPos.set(f.position, f)

  // === 1. Верхние плитки ===
  const total = filtered.length
  const avgService = avgScore(filtered, fieldByPos.get(4)?.id)  // обслуживание
  const avgFood = avgScore(filtered, fieldByPos.get(6)?.id)     // блюда
  const resolved = filtered.filter((f) => f.status === 'resolved').length
  const resolvedRate = total > 0 ? Math.round((resolved / total) * 100) : 0

  // === 2. Динамика по дням (количество отзывов) ===
  const byDay = aggregateByDay(filtered)

  // === 3. Тренд средней оценки по неделям ===
  const weeklyTrend = aggregateWeeklyTrend(
    filtered,
    fieldByPos.get(4)?.id,
    fieldByPos.get(6)?.id
  )

  // === 4. Распределение оценок (гистограмма) ===
  const serviceDistribution = scoreDistribution(filtered, fieldByPos.get(4)?.id)
  const foodDistribution = scoreDistribution(filtered, fieldByPos.get(6)?.id)

  // === 5. ТОП проблем (multi_select поля) ===
  const greetingCounts = countMultiSelectOptions(filtered, fieldByPos.get(3)?.id)
  const waitingCounts = countMultiSelectOptions(filtered, fieldByPos.get(5)?.id)
  const likedCounts = countMultiSelectOptions(filtered, fieldByPos.get(7)?.id)

  // === 6. Тексты «что не понравилось» — из условных полей ===
  const complaintsService = collectConditionalTexts(filtered, fieldByPos.get(41)?.id)
  const complaintsFood = collectConditionalTexts(filtered, fieldByPos.get(61)?.id)

  // === 7. Распределение по филиалам ===
  const byBranch = aggregateByBranch(feedbacks, branches)

  return NextResponse.json({
    total,
    avgService,
    avgFood,
    resolvedRate,
    byDay,
    weeklyTrend,
    serviceDistribution,
    foodDistribution,
    greetingCounts,
    waitingCounts,
    likedCounts,
    complaintsService,
    complaintsFood,
    byBranch,
  })
}

// === вспомогательные функции агрегации ===

function avgScore(
  items: { answers: Record<string, unknown> | unknown }[],
  fieldId: string | undefined
): number | null {
  if (!fieldId) return null
  const nums: number[] = []
  for (const it of items) {
    const v = (it.answers as Record<string, unknown>)[fieldId]
    if (typeof v === 'number') nums.push(v)
  }
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function aggregateByDay(items: { created_at: string }[]): { date: string; count: number }[] {
  const map = new Map<string, number>()
  for (const it of items) {
    const day = it.created_at.slice(0, 10)
    map.set(day, (map.get(day) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function aggregateWeeklyTrend(
  items: { created_at: string; answers: unknown }[],
  serviceFieldId: string | undefined,
  foodFieldId: string | undefined
): { week: string; service: number | null; food: number | null }[] {
  const buckets = new Map<string, { service: number[]; food: number[] }>()
  for (const it of items) {
    const week = getWeekKey(new Date(it.created_at))
    const bucket = buckets.get(week) ?? { service: [], food: [] }
    const answers = it.answers as Record<string, unknown>
    if (serviceFieldId && typeof answers[serviceFieldId] === 'number') {
      bucket.service.push(answers[serviceFieldId] as number)
    }
    if (foodFieldId && typeof answers[foodFieldId] === 'number') {
      bucket.food.push(answers[foodFieldId] as number)
    }
    buckets.set(week, bucket)
  }
  return Array.from(buckets.entries())
    .map(([week, b]) => ({
      week,
      service: b.service.length ? round1(avg(b.service)) : null,
      food: b.food.length ? round1(avg(b.food)) : null,
    }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

function getWeekKey(d: Date): string {
  // YYYY-WW формат для сортировки
  const year = d.getFullYear()
  const start = new Date(year, 0, 1)
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000)
  const week = Math.ceil((days + start.getDay() + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function scoreDistribution(
  items: { answers: unknown }[],
  fieldId: string | undefined
): { score: number; count: number }[] {
  const counts = new Array(11).fill(0)
  if (!fieldId) return counts.map((count, score) => ({ score, count }))
  for (const it of items) {
    const v = (it.answers as Record<string, unknown>)[fieldId]
    if (typeof v === 'number' && v >= 0 && v <= 10) counts[v]++
  }
  return counts.map((count, score) => ({ score, count }))
}

function countMultiSelectOptions(
  items: { answers: unknown }[],
  fieldId: string | undefined
): { option: string; count: number }[] {
  if (!fieldId) return []
  const counts = new Map<string, number>()
  for (const it of items) {
    const v = (it.answers as Record<string, unknown>)[fieldId]
    if (Array.isArray(v)) {
      for (const opt of v) {
        const key = (opt as string).startsWith('Другое:') ? 'Другое' : (opt as string)
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    } else if (typeof v === 'string') {
      const key = v.startsWith('Другое:') ? 'Другое' : v
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([option, count]) => ({ option, count }))
    .sort((a, b) => b.count - a.count)
}

function collectConditionalTexts(
  items: { id: string; answers: unknown; created_at: string }[],
  fieldId: string | undefined
): { text: string; feedbackId: string; date: string }[] {
  if (!fieldId) return []
  const out: { text: string; feedbackId: string; date: string }[] = []
  for (const it of items) {
    const v = (it.answers as Record<string, unknown>)[fieldId]
    let text: string | null = null
    if (typeof v === 'string' && v.trim()) text = v
    else if (v && typeof v === 'object') {
      const obj = v as { text?: string }
      if (obj.text?.trim()) text = obj.text
    }
    if (text) {
      out.push({ text, feedbackId: it.id, date: it.created_at })
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date))  // свежее сверху
}

function aggregateByBranch(
  items: { answers: unknown }[],
  branches: string[]
): { branch: string; count: number; avgService: number | null; avgFood: number | null }[] {
  const out: ReturnType<typeof aggregateByBranch> = []
  for (const branch of branches) {
    const subset = items.filter((it) =>
      Object.values((it.answers as Record<string, unknown>)).some((v) => v === branch)
    )
    out.push({
      branch,
      count: subset.length,
      avgService: null,  // вычислим в клиенте если потребуется, или передадим из API
      avgFood: null,
    })
  }
  return out.sort((a, b) => b.count - a.count)
}

function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
function round1(n: number): number {
  return Math.round(n * 10) / 10
}