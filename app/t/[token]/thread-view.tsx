'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Attachment, Message } from '@/lib/types'
import SaveLinkBanner from './save-link-banner'

const MAX_TEXT = 500
const MAX_ATTACHMENTS = 4

type ThreadData = {
  feedback: { id: string; answers: Record<string, unknown>; created_at: string; status: string }
  messages: Message[]
  fields: { id: string; label: string; field_type: string; position: number }[]
  venue: { name: string }
}

export default function ThreadView({ token }: { token: string }) {
  const [data, setData] = useState<ThreadData | null>(null)
  const [text, setText] = useState('')
  const [pending, setPending] = useState<Attachment[]>([])
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [lastActivity, setLastActivity] = useState<number | null>(null)
  const markActivity = () => setLastActivity(Date.now())

  useEffect(() => {
    if (!lastActivity) return
    const dismissed = localStorage.getItem(`dismissed-banner:${token}`)
    if (dismissed) return  // если гость уже скрыл баннер — не мешаем

    const handler = (e: BeforeUnloadEvent) => {
      const fiveMinutes = 5 * 60 * 1000
      if (Date.now() - lastActivity < fiveMinutes) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [lastActivity, token])

  useEffect(() => {
    fetch(`/api/thread/${token}`)
      .then((r) => r.json())
      .then(setData)
  }, [token])

  useEffect(() => {
    if (!data?.feedback.id) return
    const supabase = createClient()
    const channel = supabase
      .channel(`thread:${data.feedback.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `feedback_id=eq.${data.feedback.id}`,
        },
        (payload) => {
          const m = payload.new as Message
          setData((prev) => {
            if (!prev) return prev
            if (prev.messages.some((x) => x.id === m.id)) return prev
            return { ...prev, messages: [...prev.messages, m] }
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [data?.feedback.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data?.messages.length])

  const uploadFile = async (file: File) => {
    if (pending.length >= MAX_ATTACHMENTS) {
      setError(`Максимум ${MAX_ATTACHMENTS} фото за раз`)
      return
    }
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/thread/${token}/upload`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(
          j.error === 'too_large' ? 'Файл больше 5 МБ' :
          j.error === 'not_image' ? 'Можно только изображения' :
          'Не удалось загрузить'
        )
        return
      }
      const { url, type } = await res.json()
      setPending((prev) => [...prev, { url, type }])
    } finally {
      setUploading(false)
    }
  }

  const removePending = (idx: number) => {
    setPending((prev) => prev.filter((_, i) => i !== idx))
  }

  const send = async () => {
    const t = text.trim()
    if (!t && pending.length === 0) return
    if (t.length > MAX_TEXT) {
      setError(`Сообщение длиннее ${MAX_TEXT} символов`)
      return
    }
    if (sending) return
    setSending(true)
    setError(null)
    markActivity()
    try {
      const res = await fetch(`/api/thread/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t, attachments: pending }),
      })
      if (res.status === 429) {
        const { retryAfter } = await res.json()
        setError(`Слишком быстро. Подождите ${retryAfter} сек.`)
        return
      }
      if (!res.ok) {
        setError('Не удалось отправить')
        return
      }
      const { message } = await res.json()
      setData((prev) =>
        prev ? { ...prev, messages: [...prev.messages, message] } : prev
      )
      setText('')
      setPending([])
      markActivity()
    } finally {
      setSending(false)
    }
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center text-sm text-neutral-400">
        Загружаем…
      </main>
    )
  }

  const charsLeft = MAX_TEXT - text.length

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-xl bg-white min-h-screen flex flex-col">
        <header className="px-5 py-4 border-b border-neutral-200">
          <div className="text-sm font-medium">Ваш отзыв · {data.venue.name}</div>
          <div className="text-xs text-neutral-400 font-mono">#{token.slice(0, 7)}</div>
        </header>

        <SaveLinkBanner token={token} />

        <div className="border-b border-neutral-200">
          <button
            onClick={() => setSummaryOpen((s) => !s)}
            className="w-full px-5 py-3 text-left flex items-center justify-between hover:bg-neutral-50"
          >
            <span className="text-sm text-neutral-600">
              {summaryOpen ? 'Скрыть мои ответы' : 'Посмотреть мои ответы'}
            </span>
            <span className="text-neutral-400 text-xs">{summaryOpen ? '▲' : '▼'}</span>
          </button>
          {summaryOpen && (
            <div className="px-5 pb-4 space-y-3">
              {data.fields.map((field) => {
                const value = data.feedback.answers[field.id]
                if (
                  value == null || value === '' ||
                  (Array.isArray(value) && value.length === 0)
                ) return null
                return (
                  <div key={field.id} className="text-sm">
                    <div className="text-neutral-400 text-xs mb-0.5">{field.label}</div>
                    <div className="text-neutral-800">
                      {Array.isArray(value) ? value.join(', ') : String(value)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {data.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* очередь фото */}
        {pending.length > 0 && (
          <div className="px-3 py-2 border-t border-neutral-200 flex gap-2 flex-wrap">
            {pending.map((att, i) => (
              <div key={i} className="relative">
                <img src={att.url} alt="" className="w-16 h-16 object-cover rounded" />
                <button
                  onClick={() => removePending(i)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-black text-white rounded-full text-xs flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
            {error}
          </div>
        )}

        <div className="border-t border-neutral-200 px-3 py-3 flex items-end gap-2">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadFile(f)
              if (e.target) e.target.value = ''
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || pending.length >= MAX_ATTACHMENTS}
            className="w-10 h-10 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-500 disabled:opacity-30 flex-shrink-0"
            aria-label="Прикрепить фото"
            title={pending.length >= MAX_ATTACHMENTS ? 'Максимум 4 фото' : 'Прикрепить фото'}
          >
            {uploading ? '…' : '📎'}
          </button>
          <div className="flex-1 relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Написать ответ…"
              rows={1}
              className="w-full resize-none border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-400 max-h-32"
            />
            {text.length > MAX_TEXT * 0.8 && (
              <div className={`absolute -top-5 right-0 text-xs ${charsLeft < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                {charsLeft}
              </div>
            )}
          </div>
          <button
            onClick={send}
            disabled={sending || (!text.trim() && pending.length === 0)}
            className="px-4 h-10 bg-black text-white rounded-lg text-sm disabled:opacity-30 flex-shrink-0"
          >
            →
          </button>
        </div>
      </div>
    </main>
  )
}

function MessageBubble({ message }: { message: Message }) {
  if (message.author === 'system') {
    return (
      <div className="text-center text-xs text-neutral-400 py-1">{message.text}</div>
    )
  }
  const isGuest = message.author === 'guest'
  const time = new Date(message.created_at).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  // объединяем новые attachments[] и legacy attachment_url
  const allAttachments: Attachment[] = []
  if (Array.isArray(message.attachments)) {
    allAttachments.push(...message.attachments)
  }
  if (message.attachment_url && !allAttachments.some((a) => a.url === message.attachment_url)) {
    allAttachments.push({ url: message.attachment_url, type: message.attachment_type ?? 'image/*' })
  }

  return (
    <div className={`flex ${isGuest ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isGuest ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-900'
        }`}
      >
        <div className={`text-xs mb-0.5 ${isGuest ? 'text-neutral-300' : 'text-neutral-500'}`}>
          {isGuest ? 'Вы' : 'Менеджер'} · {time}
        </div>
        {allAttachments.length > 0 && (
          <div className={`grid gap-1 mb-1 ${allAttachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {allAttachments.map((a, i) => (
              <img key={i} src={a.url} alt="" className="rounded max-w-full object-cover" />
            ))}
          </div>
        )}
        {message.text && (
          <div className="text-sm whitespace-pre-wrap break-words">{message.text}</div>
        )}
      </div>
    </div>
  )
}