'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Attachment, Feedback, FormField, Message } from '@/lib/types'
import { useSearchParams } from 'next/navigation'
import ManageHeader from '../manage-header'

type Template = { id: string; label: string; text: string }

export default function ThreadAdminView({
  feedback,
  initialMessages,
  fields,
  venue,
  templates,
}: {
  feedback: Feedback
  initialMessages: Message[]
  fields: FormField[]
  venue: { name: string }
  templates: Template[]
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // realtime подписка
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`admin-thread:${feedback.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `feedback_id=eq.${feedback.id}`,
        },
        (payload) => {
          const m = payload.new as Message
          setMessages((prev) => {
            if (prev.some((x) => x.id === m.id)) return prev
            return [...prev, m]
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [feedback.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: message } = await supabase
      .from('messages')
      .insert({
        feedback_id: feedback.id,
        author: 'manager',
        manager_id: user?.id,
        text: t,
      })
      .select()
      .single()
    if (message) {
      setMessages((prev) => [...prev, message as Message])
      setText('')
    }
    setSending(false)
  }

  const useTemplate = (tpl: Template) => {
    setText((prev) => prev ? `${prev}\n${tpl.text}` : tpl.text)
  }

  const setStatus = async (status: Feedback['status']) => {
    const supabase = createClient()
    await supabase.from('feedbacks').update({ status }).eq('id', feedback.id)
    router.refresh()
  }

  const fieldsById = new Map(fields.map((f) => [f.id, f]))

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="bg-white border-b border-neutral-200 px-5 py-3 pl-16 md:pl-5 flex items-center justify-between gap-3">
        <BackLink />
        <select
          value={feedback.status}
          onChange={(e) => setStatus(e.target.value as Feedback['status'])}
          className="text-sm border-2 border-neutral-200 rounded-lg px-3 py-1.5 text-neutral-900 font-medium"
        >
          <option value="new">Новый</option>
          <option value="in_progress">В работе</option>
          <option value="resolved">Закрыт</option>
          <option value="archived">Архив</option>
        </select>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-4 p-4">
        {/* Левая колонка: ответы из формы */}
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-4 h-fit">
          <div>
            <div className="text-xs text-neutral-400 mb-1">Заведение</div>
            <div className="text-sm font-medium">{venue.name}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-400 mb-1">Токен гостя</div>
            <div className="text-xs font-mono text-neutral-600">#{feedback.anonymous_token.slice(0, 7)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-400 mb-1">Создан</div>
            <div className="text-sm">{new Date(feedback.created_at).toLocaleString('ru-RU')}</div>
          </div>

          <hr className="border-neutral-100" />

          <div className="space-y-3">
            {fields
              .filter((f) => !f.parent_field_id)
              .sort((a, b) => a.position - b.position)
              .map((root) => (
                <AnswerBlock
                  key={root.id}
                  field={root}
                  answers={feedback.answers}
                  fields={fields}
                />
              ))}
          </div>
        </div>

        {/* Правая колонка: тред */}
        <div className="bg-white border border-neutral-200 rounded-lg flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m) => (
              <AdminMessageBubble key={m.id} message={m} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {templates.length > 0 && (
            <div className="border-t border-neutral-100 px-3 py-2 flex gap-1.5 flex-wrap">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => useTemplate(tpl)}
                  className="text-xs text-neutral-700 border border-neutral-200 rounded-md px-2.5 py-1 hover:bg-neutral-50"
                  title={tpl.text}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-neutral-200 px-3 py-3 flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ответ гостю… (Ctrl+Enter — отправить)"
              rows={3}
              className="flex-1 resize-none border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-400"
            />
            <button
              onClick={send}
              disabled={sending || !text.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-30"
            >
              Отправить
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

function AnswerBlock({
  field,
  answers,
  fields,
}: {
  field: FormField
  answers: Record<string, unknown>
  fields: FormField[]
}) {
  const value = answers[field.id]
  const children = fields.filter((f) => f.parent_field_id === field.id)
  const visibleChildren = children.filter((c) => answers[c.id] != null && answers[c.id] !== '')

  const hasAnswer =
    value != null &&
    value !== '' &&
    !(Array.isArray(value) && value.length === 0)

  if (!hasAnswer && visibleChildren.length === 0) return null

  return (
    <div>
      <div className="text-xs text-neutral-400 mb-1">{field.label}</div>
      <div className="text-sm text-neutral-900">
        {hasAnswer && <AnswerValue value={value} />}
      </div>
      {visibleChildren.map((child) => (
        <div key={child.id} className="mt-2 pl-3 border-l-2 border-neutral-100">
          <div className="text-xs text-neutral-400 mb-1">{child.label}</div>
          <div className="text-sm text-neutral-900">
            <AnswerValue value={answers[child.id]} />
          </div>
        </div>
      ))}
    </div>
  )
}

function AnswerValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) return <>{value.join(', ')}</>

  if (value && typeof value === 'object') {
    const v = value as { text?: string; photos?: { url: string }[] }
    return (
      <div className="space-y-2">
        {v.text && <div className="whitespace-pre-wrap">{v.text}</div>}
        {v.photos && v.photos.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {v.photos.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                <img src={p.url} alt="" className="w-20 h-20 object-cover rounded border border-neutral-200" />
              </a>
            ))}
          </div>
        )}
      </div>
    )
  }

  return <>{String(value)}</>
}

function AdminMessageBubble({ message }: { message: Message }) {
  if (message.author === 'system') {
    return (
      <div className="text-center text-xs text-neutral-400 py-1">{message.text}</div>
    )
  }

  const isManager = message.author === 'manager'
  const time = new Date(message.created_at).toLocaleString('ru-RU', {
    hour: '2-digit', minute: '2-digit',
  })

  const allAttachments: Attachment[] = []
  if (Array.isArray(message.attachments)) {
    allAttachments.push(...message.attachments)
  }
  if (message.attachment_url && !allAttachments.some((a) => a.url === message.attachment_url)) {
    allAttachments.push({ url: message.attachment_url, type: message.attachment_type ?? 'image/*' })
  }

  return (
    <div className={`flex ${isManager ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
        isManager ? 'bg-blue-500 text-white' : 'bg-neutral-100 text-neutral-900'
      }`}>
        <div className={`text-xs mb-0.5 ${isManager ? 'text-blue-100' : 'text-neutral-500'}`}>
          {isManager ? 'Я' : 'Гость'} · {time}
        </div>
        {allAttachments.length > 0 && (
          <div className={`grid gap-1 mb-1 ${allAttachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {allAttachments.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                <img src={a.url} alt="" className="rounded max-w-full object-cover" />
              </a>
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

function BackLink() {
  const searchParams = useSearchParams()
  const from = searchParams.get('from') ?? '/manage'
  return (
    <Link href={from} className="text-sm text-neutral-500 hover:text-neutral-800">
      ← К списку
    </Link>
  )
}