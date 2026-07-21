'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Item = {
  id: string
  anonymous_token: string
  answers: Record<string, unknown>
  status: 'new' | 'in_progress' | 'resolved' | 'archived'
  created_at: string
  last_message_at: string
  unread_for_manager: boolean
  guest_name: string | null   // ← добавить
  form_id: string | null
}

type Filter = 'all' | 'unread' | 'new' | 'in_progress' | 'resolved'

export default function InboxClient({
  initial,
  forms,
}: {
  initial: Item[]
  forms: { id: string; name: string; is_system: boolean }[]
}) {
  const searchParams = useSearchParams()
  const pathname = usePathname()  
  const router = useRouter()
  const formById = new Map(forms.map((f) => [f.id, f]))

  const [formFilter, setFormFilter] = useState<string>('all')

  // читаем фильтр из URL один раз при монтировании
  const [filter, setFilterState] = useState<Filter>(() => {
    const f = searchParams.get('filter')
    if (f === 'unread' || f === 'new' || f === 'in_progress' || f === 'resolved') return f
    return 'all'
  })

  // тихо обновляем URL без триггера Next-навигации
  const setFilter = useCallback((f: Filter) => {
    setFilterState(f)
    const params = new URLSearchParams(searchParams.toString())
    if (f === 'all') params.delete('filter')
    else params.set('filter', f)
    const q = params.toString()
    const url = `${pathname}${q ? `?${q}` : ''}`
    window.history.replaceState(null, '', url)
  }, [pathname, searchParams])

  const [items, setItems] = useState<Item[]>(initial)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedbacks' },
        async () => {
          const { data } = await supabase
            .from('feedbacks')
            .select('id, anonymous_token, answers, status, created_at, last_message_at, unread_for_manager, guest_name, form_id')
            .order('last_message_at', { ascending: false })
            .limit(100)
          if (data) setItems(data as Item[])
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // при каждом возврате на инбокс обновляем данные с сервера
  useEffect(() => {
    router.refresh()
  }, [router])

  const filtered = items.filter((it) => {
  if (formFilter !== 'all' && it.form_id !== formFilter) return false
  if (filter === 'all') return true
  if (filter === 'unread') return it.unread_for_manager
  return it.status === filter
})

  const unreadCount = items.filter((i) => i.unread_for_manager).length

  useEffect(() => {
      if (typeof navigator === 'undefined') return
      if (unreadCount > 0) {
        if ('setAppBadge' in navigator) {
          navigator.setAppBadge(unreadCount).catch(() => {})
        }
      } else if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {})
      }
    }, [unreadCount])

  // ссылка возврата сохраняет текущий URL вместе с фильтром
  const returnTo = `${pathname}${filter !== 'all' ? `?filter=${filter}` : ''}`

  return (
    <div>
      <div className="bg-white border-b border-neutral-200 px-5 py-2 flex gap-1 overflow-x-auto">
        <select
          value={formFilter}
          onChange={(e) => setFormFilter(e.target.value)}
          className="ml-auto text-xs border-2 border-neutral-200 rounded-lg px-2 py-1.5 font-medium text-neutral-900"
        >
          <option value="all">Все формы</option>
          {forms.map((f) => (
            <option key={f.id} value={f.id}>{f.is_system ? 'Только отзывы' : f.name}</option>
          ))}
        </select>
        <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>Все ({items.length})</FilterTab>
        <FilterTab active={filter === 'unread'} onClick={() => setFilter('unread')}>
          Непрочитанные{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </FilterTab>
        <FilterTab active={filter === 'new'} onClick={() => setFilter('new')}>Новые</FilterTab>
        <FilterTab active={filter === 'in_progress'} onClick={() => setFilter('in_progress')}>В работе</FilterTab>
        <FilterTab active={filter === 'resolved'} onClick={() => setFilter('resolved')}>Закрытые</FilterTab>
      </div>

      <div className="max-w-3xl mx-auto px-3 py-3 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center text-sm text-neutral-600 py-12">Нет отзывов</div>
        )}
        {filtered.map((item) => (
          <FeedbackCard
            key={item.id}
            item={item}
            form={item.form_id ? formById.get(item.form_id) : undefined}
            returnTo={returnTo}
            onOpen={() => {
              setItems((prev) =>
                prev.map((it) =>
                  it.id === item.id
                    ? {
                        ...it,
                        unread_for_manager: false,
                        status: it.status === 'new' ? 'in_progress' : it.status,
                      }
                    : it
                )
              )
            }}
          />
        ))}
      </div>
    </div>
  )
}

function FilterTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition ${
        active ? 'bg-neutral-900 text-white font-medium' : 'text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  )
}

function FeedbackCard({
  item,
  form,
  returnTo,
  onOpen,
}: {
  item: Item
  form?: { id: string; name: string; is_system: boolean }
  returnTo: string
  onOpen: () => void
}) {
  const answers = item.answers
  const numericAnswers = Object.values(answers).filter((v) => typeof v === 'number') as number[]
  const minScore = numericAnswers.length > 0 ? Math.min(...numericAnswers) : null
  const branch = Object.values(answers).find(
    (v) => typeof v === 'string' && ['Араванская', 'Дом-Быта', 'Юго-Восток', 'Анар'].includes(v as string)
  ) as string | undefined

  const time = new Date(item.last_message_at).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })

  return (
    <Link
      prefetch={true}
      onClick={onOpen}
      href={`/manage/${item.id}?from=${encodeURIComponent(returnTo)}`}
      className={`block bg-white border rounded-lg px-4 py-3 hover:border-neutral-400 transition ${
        item.unread_for_manager ? 'border-blue-300 bg-blue-50/30' : 'border-neutral-200'
      }`}
    >
      {/* ... остальное содержимое карточки как было */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {item.unread_for_manager && (
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          )}
          <span className="text-sm font-medium">
            {item.guest_name ? `${item.guest_name} · ` : ''}{branch ?? 'Без филиала'}
          </span>
          {minScore != null && (
            <span className={`text-xs px-2 py-0.5 rounded ${
              minScore <= 6 ? 'bg-red-100 text-red-700' :
              minScore <= 8 ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {minScore}/10
            </span>
          )}
          <StatusBadge status={item.status} />
          {form && (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              form.is_system
                ? 'bg-amber-100 text-amber-800'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {form.is_system ? 'Отзыв' : form.name}
            </span>
          )}
        </div>
        <span className="text-sm font-medium text-neutral-700">{time}</span>
      </div>
      <div className="text-xs text-neutral-700 font-mono">#{item.anonymous_token.slice(0, 7)}</div>
    </Link>
  )
}

function StatusBadge({ status }: { status: Item['status'] }) {
  const map = {
    new: { label: 'Новый', cls: 'bg-neutral-100 text-neutral-600' },
    in_progress: { label: 'В работе', cls: 'bg-blue-100 text-blue-700' },
    resolved: { label: 'Закрыт', cls: 'bg-green-100 text-green-700' },
    archived: { label: 'Архив', cls: 'bg-neutral-100 text-neutral-600' },
  }
  const { label, cls } = map[status]
  return <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>{label}</span>
}