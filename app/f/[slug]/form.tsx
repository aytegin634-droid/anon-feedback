'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FormField, ShowWhen, Venue } from '@/lib/types'

const OTHER_VALUE = 'Другое'
const MAX_FORM_PHOTOS = 3

type PhotoRef = { url: string; path: string; type: string }
type TextWithPhotos = { text: string; photos: PhotoRef[] }

export default function FeedbackForm({
  venue,
  fields,
}: {
  venue: Venue
  fields: FormField[]
}) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const setAnswer = (fieldId: string, value: unknown) =>
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  const setOther = (fieldId: string, text: string) =>
    setOtherTexts((prev) => ({ ...prev, [fieldId]: text }))
  const toggleMulti = (fieldId: string, option: string) => {
    setAnswers((prev) => {
      const current = (prev[fieldId] as string[] | undefined) ?? []
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option]
      return { ...prev, [fieldId]: next }
    })
  }

  const orderedVisible = useMemo(() => {
    const roots = fields
      .filter((f) => !f.parent_field_id)
      .sort((a, b) => a.position - b.position)
    const childrenByParent = new Map<string, FormField[]>()
    for (const f of fields) {
      if (f.parent_field_id) {
        const arr = childrenByParent.get(f.parent_field_id) ?? []
        arr.push(f)
        childrenByParent.set(f.parent_field_id, arr)
      }
    }
    for (const arr of childrenByParent.values()) {
      arr.sort((a, b) => a.position - b.position)
    }
    const result: FormField[] = []
    for (const root of roots) {
      result.push(root)
      const children = childrenByParent.get(root.id) ?? []
      for (const child of children) {
        if (
          child.show_when &&
          matchesCondition(answers[child.parent_field_id!], child.show_when)
        ) {
          result.push(child)
        }
      }
    }
    return result
  }, [fields, answers])

  const rootFields = fields.filter((f) => !f.parent_field_id)
  const indexByRoot = new Map(rootFields.map((f, i) => [f.id, i + 1]))

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => router.push(`/t/${success}`), 2500)
      return () => clearTimeout(t)
    }
  }, [success, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    for (const f of orderedVisible) {
      if (!f.required) continue
      const v = answers[f.id]
      const isEmpty =
        v == null ||
        v === '' ||
        (Array.isArray(v) && v.length === 0) ||
        (typeof v === 'object' && !Array.isArray(v) &&
          !(v as TextWithPhotos).text?.trim() &&
          ((v as TextWithPhotos).photos?.length ?? 0) === 0)
      if (isEmpty) {
        setError(`Заполните: ${f.label}`)
        return
      }
    }

    const finalAnswers: Record<string, unknown> = { ...answers }
    for (const f of orderedVisible) {
      if (f.field_type === 'select' && answers[f.id] === OTHER_VALUE) {
        const txt = otherTexts[f.id]?.trim()
        if (txt) finalAnswers[f.id] = `Другое: ${txt}`
      } else if (f.field_type === 'multi_select') {
        const arr = (answers[f.id] as string[] | undefined) ?? []
        if (arr.includes(OTHER_VALUE)) {
          const txt = otherTexts[f.id]?.trim()
          if (txt) {
            finalAnswers[f.id] = arr.map((v) =>
              v === OTHER_VALUE ? `Другое: ${txt}` : v
            )
          }
        }
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue_id: venue.id, answers: finalAnswers }),
      })
      if (res.status === 429) {
        const { retryAfter } = await res.json()
        setError(`Слишком много отправок. Попробуйте через ${Math.ceil(retryAfter / 60)} мин.`)
        setSubmitting(false)
        return
      }
      if (!res.ok) throw new Error('submit failed')
      const { token } = await res.json()
      setSuccess(token)
    } catch {
      setError('Не удалось отправить. Попробуйте ещё раз.')
      setSubmitting(false)
    }
  }

  if (success) return <SuccessModal token={success} />

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {orderedVisible.map((field) => {
        const idx = indexByRoot.get(field.id)
        const isChild = !!field.parent_field_id
        return (
          <div
            key={field.id}
            className={`space-y-2.5 ${isChild ? 'pl-4 border-l-2 border-amber-300 ml-1' : ''}`}
          >
            <label className="block text-base font-semibold text-neutral-900 leading-snug">
              {idx != null && <span className="text-neutral-500 mr-1.5">{idx}.</span>}
              {isChild && <span className="text-amber-500 mr-1.5">↳</span>}
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderField(field, answers, otherTexts, setAnswer, toggleMulti, setOther)}
          </div>
        )
      })}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2.5 rounded-lg font-medium">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-neutral-900 text-white rounded-xl py-3.5 text-base font-semibold disabled:opacity-50 hover:bg-neutral-800 transition"
      >
        {submitting ? 'Отправляем…' : 'Пусть узнают, что я думаю'}
      </button>
    </form>
  )
}

function matchesCondition(value: unknown, cond: ShowWhen): boolean {
  if (value == null) return false
  switch (cond.operator) {
    case 'eq': return value === cond.value
    case 'in':
      if (Array.isArray(value)) {
        return value.some((v) => cond.values.includes(v as string))
      }
      return cond.values.includes(value as string)
    case 'lt': return typeof value === 'number' && value < cond.value
    case 'gt': return typeof value === 'number' && value > cond.value
    case 'lte': return typeof value === 'number' && value <= cond.value
    case 'gte': return typeof value === 'number' && value >= cond.value
  }
}

function renderField(
  field: FormField,
  answers: Record<string, unknown>,
  otherTexts: Record<string, string>,
  setAnswer: (id: string, v: unknown) => void,
  toggleMulti: (id: string, opt: string) => void,
  setOther: (id: string, text: string) => void
) {
  const v = answers[field.id]
  const inputCls = "w-full border-2 border-neutral-200 rounded-lg px-3 py-2.5 text-base text-neutral-900 focus:outline-none focus:border-amber-500 transition"

  switch (field.field_type) {
    case 'short_text':
    if (field.field_key === 'waiter_name') {
      return <WaiterNameField field={field} value={v} setAnswer={setAnswer} />
    }
    if (field.allow_photos) {
      return <TextWithPhotosField field={field} value={v} setAnswer={setAnswer} multiline={false} />
    }
    return (
      <input
        type="text"
        value={(v as string) ?? ''}
        onChange={(e) => setAnswer(field.id, e.target.value)}
        className={inputCls}
      />
    )
    case 'long_text':
      if (field.allow_photos) {
        return <TextWithPhotosField field={field} value={v} setAnswer={setAnswer} multiline={true} />
      }
      return (
        <textarea value={(v as string) ?? ''}
          onChange={(e) => setAnswer(field.id, e.target.value)}
          rows={4} className={inputCls} />
      )
    case 'date':
      return (
        <input type="date" value={(v as string) ?? ''}
          onChange={(e) => setAnswer(field.id, e.target.value)}
          className={inputCls} />
      )
    case 'select': {
      const isOther = v === OTHER_VALUE
      return (
        <div className="space-y-2">
          {field.options.map((opt) => {
            const selected = v === opt
            return (
              <label key={opt}
                className={`flex items-center gap-3 px-4 py-3 border-2 rounded-lg cursor-pointer transition ${
                  selected
                    ? 'border-amber-500 bg-amber-50 text-neutral-900'
                    : 'border-neutral-200 text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50'
                }`}>
                <input type="radio" name={field.id} checked={selected}
                  onChange={() => setAnswer(field.id, opt)}
                  className="w-4 h-4 accent-amber-500" />
                <span className="text-base font-medium">{opt}</span>
              </label>
            )
          })}
          {isOther && (
            <input type="text" placeholder="Уточните…"
              value={otherTexts[field.id] ?? ''}
              onChange={(e) => setOther(field.id, e.target.value)}
              className={`${inputCls} mt-1`} />
          )}
        </div>
      )
    }
    case 'multi_select': {
      const selected = (v as string[]) ?? []
      const isOther = selected.includes(OTHER_VALUE)
      return (
        <div className="space-y-2">
          {field.options.map((opt) => {
            const isSelected = selected.includes(opt)
            return (
              <label key={opt}
                className={`flex items-center gap-3 px-4 py-3 border-2 rounded-lg cursor-pointer transition ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50 text-neutral-900'
                    : 'border-neutral-200 text-neutral-800 hover:border-neutral-300 hover:bg-neutral-50'
                }`}>
                <input type="checkbox" checked={isSelected}
                  onChange={() => toggleMulti(field.id, opt)}
                  className="w-4 h-4 accent-amber-500" />
                <span className="text-base font-medium">{opt}</span>
              </label>
            )
          })}
          {isOther && (
            <input type="text" placeholder="Уточните…"
              value={otherTexts[field.id] ?? ''}
              onChange={(e) => setOther(field.id, e.target.value)}
              className={`${inputCls} mt-1`} />
          )}
        </div>
      )
    }
    case 'scale': {
      const min = field.scale_min ?? 0
      const max = field.scale_max ?? 10
      const nums = Array.from({ length: max - min + 1 }, (_, i) => i + min)
      return (
        <div className="flex gap-1.5 flex-wrap">
          {nums.map((n) => {
            const selected = v === n
            return (
              <button key={n} type="button"
                onClick={() => setAnswer(field.id, n)}
                className={`w-10 h-10 rounded-lg border-2 text-base font-semibold transition ${
                  selected
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'border-neutral-200 text-neutral-700 hover:border-neutral-400'
                }`}>
                {n}
              </button>
            )
          })}
        </div>
      )
    }
  }
}

function TextWithPhotosField({
  field,
  value,
  setAnswer,
  multiline,
}: {
  field: FormField
  value: unknown
  setAnswer: (id: string, v: unknown) => void
  multiline: boolean
}) {
  const data = (
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as TextWithPhotos)
      : { text: typeof value === 'string' ? value : '', photos: [] }
  )
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputCls = "w-full border-2 border-neutral-200 rounded-lg px-3 py-2.5 text-base text-neutral-900 focus:outline-none focus:border-amber-500 transition"

  const update = (next: Partial<TextWithPhotos>) => {
    setAnswer(field.id, { text: data.text, photos: data.photos, ...next })
  }

  const onFile = async (file: File) => {
    if (data.photos.length >= MAX_FORM_PHOTOS) {
      setLocalError(`Максимум ${MAX_FORM_PHOTOS} фото`)
      return
    }
    setLocalError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/feedback/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setLocalError(
          j.error === 'too_large' ? 'Файл больше 5 МБ' :
          j.error === 'not_image' ? 'Можно только изображения' :
          'Не удалось загрузить'
        )
        return
      }
      const photo = await res.json() as PhotoRef
      update({ photos: [...data.photos, photo] })
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = (idx: number) => {
    update({ photos: data.photos.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-2.5">
      {multiline ? (
        <textarea value={data.text}
          onChange={(e) => update({ text: e.target.value })}
          rows={4} className={inputCls} />
      ) : (
        <input type="text" value={data.text}
          onChange={(e) => update({ text: e.target.value })}
          className={inputCls} />
      )}

      <input type="file" accept="image/*" ref={fileRef} className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          if (e.target) e.target.value = ''
        }} />

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => fileRef.current?.click()}
          disabled={uploading || data.photos.length >= MAX_FORM_PHOTOS}
          className="text-sm font-medium text-neutral-800 border-2 border-neutral-200 rounded-lg px-3 py-2 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-30 transition">
          {uploading ? 'Загрузка…' : `📎 Фото (${data.photos.length}/${MAX_FORM_PHOTOS})`}
        </button>
        {data.photos.map((p, i) => (
          <div key={i} className="relative">
            <img src={p.url} alt="" className="w-14 h-14 object-cover rounded-lg" />
            <button type="button" onClick={() => removePhoto(i)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-neutral-900 text-white rounded-full text-xs flex items-center justify-center font-bold">
              ×
            </button>
          </div>
        ))}
      </div>

      {localError && <div className="text-sm text-red-700 font-medium">{localError}</div>}
    </div>
  )
}

function SuccessModal({ token }: { token: string }) {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center text-center py-12">
      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-5">
        <svg className="w-8 h-8 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-neutral-900 mb-2">Спасибо за отзыв!</h2>
      <p className="text-base text-neutral-700 mb-8 max-w-xs">
        Сейчас откроется чат, где менеджер сможет связаться с вами анонимно.
      </p>
      <button onClick={() => router.push(`/t/${token}`)} className="text-base text-neutral-700 underline font-medium">
        Перейти сейчас
      </button>
    </div>
  )
}

function WaiterNameField({
  field,
  value,
  setAnswer,
}: {
  field: FormField
  value: unknown
  setAnswer: (id: string, v: unknown) => void
}) {
  const isUnknown = value === 'Не помню'
  const inputCls =
    'w-full border-2 border-neutral-200 rounded-lg px-3 py-2.5 text-base text-neutral-900 focus:outline-none focus:border-amber-500 transition'

  return (
    <div className="space-y-2.5">
      <input
        type="text"
        value={isUnknown ? '' : (value as string) ?? ''}
        disabled={isUnknown}
        onChange={(e) => setAnswer(field.id, e.target.value)}
        placeholder={isUnknown ? '—' : 'Имя официанта'}
        className={`${inputCls} ${isUnknown ? 'opacity-50 bg-neutral-50' : ''}`}
      />
      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={isUnknown}
          onChange={(e) => setAnswer(field.id, e.target.checked ? 'Не помню' : '')}
          className="w-4 h-4 accent-amber-500"
        />
        <span className="text-sm font-medium text-neutral-700">Не помню имя</span>
      </label>
    </div>
  )
}