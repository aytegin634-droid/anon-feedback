import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const limit = await checkRateLimit(`submit:${ip}`, 3, 3600)
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retryAfter: limit.retryAfter },
        { status: 429 }
      )
    }

    const { venue_id, answers } = await req.json()

    if (!venue_id || !answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // находим поле имени по семантическому ключу и достаём значение
    const { data: nameField } = await supabase
      .from('form_fields')
      .select('id')
      .eq('venue_id', venue_id)
      .eq('field_key', 'guest_name')
      .maybeSingle()

    let guestName: string | null = null
    if (nameField) {
      const v = answers[nameField.id]
      if (typeof v === 'string' && v.trim()) {
        guestName = v.trim().slice(0, 100)
      }
    }

    const { data: feedback, error } = await supabase
      .from('feedbacks')
      .insert({ venue_id, answers, guest_name: guestName })
      .select('id, anonymous_token')
      .single()

    if (error || !feedback) {
      console.error('insert feedback failed', error)
      return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
    }

    // переносим фото из _form/ в feedbacks/<id>/
    // ищем во всех ответах объекты с photos[] и обновляем пути
    const updatedAnswers = await reattachPhotos(supabase, answers, feedback.id)
    if (updatedAnswers !== answers) {
      await supabase
        .from('feedbacks')
        .update({ answers: updatedAnswers })
        .eq('id', feedback.id)
    }

    // получаем оба автоответа с настройками
  const { data: autoReplies } = await supabase
    .from('message_templates')
    .select('auto_type, text, enabled, conditions')
    .eq('venue_id', venue_id)
    .not('auto_type', 'is', null)

  const negative = autoReplies?.find((a) => a.auto_type === 'negative')
  const positive = autoReplies?.find((a) => a.auto_type === 'positive')

  let autoText: string | null = null

  // 1. негативный: включён + есть условия + хотя бы одно выполнено
  if (
    negative?.enabled &&
    Array.isArray(negative.conditions) &&
    negative.conditions.length > 0
  ) {
    const matched = negative.conditions.some((c: AutoCondition) =>
      evalAutoCondition(answers, c)
    )
    if (matched) autoText = negative.text
  }

  // 2. позитивный: если негатив не сработал и позитив включён
  if (!autoText && positive?.enabled && positive.text) {
    autoText = positive.text
  }

  if (autoText) {
    await supabase.from('messages').insert({
      feedback_id: feedback.id,
      author: 'manager',
      manager_id: null,
      text: autoText,
    })
  } else {
    await supabase.from('messages').insert({
      feedback_id: feedback.id,
      author: 'system',
      text: 'Отзыв получен. Менеджер ответит здесь.',
    })
  }

    return NextResponse.json({ token: feedback.anonymous_token })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

type Photo = { url: string; path: string; type: string }

async function reattachPhotos(
  supabase: ReturnType<typeof createAdminClient>,
  answers: Record<string, unknown>,
  feedbackId: string
): Promise<Record<string, unknown>> {
  let changed = false
  const result: Record<string, unknown> = { ...answers }

  for (const [fieldId, value] of Object.entries(answers)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const v = value as { text?: string; photos?: Photo[] }
    if (!Array.isArray(v.photos) || v.photos.length === 0) continue

    const newPhotos: Photo[] = []
    for (const photo of v.photos) {
      if (!photo.path?.startsWith('_form/')) {
        newPhotos.push(photo)
        continue
      }
      const filename = photo.path.replace('_form/', '')
      const newPath = `${feedbackId}/${filename}`
      const { error: moveErr } = await supabase.storage
        .from('attachments')
        .move(photo.path, newPath)
      if (moveErr) {
        console.error('move file', moveErr)
        newPhotos.push(photo)
        continue
      }
      const { data } = supabase.storage.from('attachments').getPublicUrl(newPath)
      newPhotos.push({ url: data.publicUrl, path: newPath, type: photo.type })
      changed = true
    }
    result[fieldId] = { ...v, photos: newPhotos }
  }

  return changed ? result : answers
}

type AutoCondition = {
  field_id: string
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'in'
  value?: number
  values?: string[]
}

function evalAutoCondition(
  answers: Record<string, unknown>,
  cond: AutoCondition
): boolean {
  const v = answers[cond.field_id]
  if (v == null) return false
  switch (cond.operator) {
    case 'lt':
      return typeof v === 'number' && typeof cond.value === 'number' && v < cond.value
    case 'lte':
      return typeof v === 'number' && typeof cond.value === 'number' && v <= cond.value
    case 'gt':
      return typeof v === 'number' && typeof cond.value === 'number' && v > cond.value
    case 'gte':
      return typeof v === 'number' && typeof cond.value === 'number' && v >= cond.value
    case 'in': {
      const list = cond.values ?? []
      if (Array.isArray(v)) return v.some((x) => list.includes(x as string))
      return list.includes(v as string)
    }
    default:
      return false
  }
}