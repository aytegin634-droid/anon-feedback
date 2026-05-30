'use client'

import { useEffect, useState } from 'react'

type Template = {
  id: string
  label: string
  text: string
  position: number
  created_at: string
}

const MAX_TEMPLATES = 5
const MAX_LABEL = 30
const MAX_TEXT = 500

export default function TemplatesClient() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/manage/templates')
    if (res.ok) {
      const data = await res.json()
      setTemplates(data.templates ?? [])
    }
    setLoading(false)
  }

  const canAdd = templates.length < MAX_TEMPLATES

  return (
    <div>
      <div className="bg-white border-b border-neutral-200 px-5 py-4 pl-16 md:pl-5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Шаблоны ответов</h1>
          <p className="text-sm text-neutral-700 mt-0.5">
            {templates.length}/{MAX_TEMPLATES} · быстрые ответы в чате с гостем
          </p>
        </div>
        {canAdd && !showNew && (
          <button
            onClick={() => setShowNew(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            + Добавить
          </button>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-3">
        {loading && (
          <div className="text-center text-sm text-neutral-700 py-8">Загружаем…</div>
        )}

        {showNew && (
          <TemplateForm
            onCancel={() => setShowNew(false)}
            onSave={async (label, text) => {
              const res = await fetch('/api/manage/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label, text }),
              })
              if (!res.ok) {
                const j = await res.json().catch(() => ({}))
                if (j.error === 'limit_reached') {
                  return { ok: false, msg: 'Лимит: максимум 5 шаблонов' }
                }
                if (j.error === 'label_too_long') {
                  return { ok: false, msg: `Ключ длиннее ${MAX_LABEL} символов` }
                }
                if (j.error === 'text_too_long') {
                  return { ok: false, msg: `Текст длиннее ${MAX_TEXT} символов` }
                }
                return { ok: false, msg: 'Не удалось сохранить' }
              }
              await load()
              setShowNew(false)
              return { ok: true }
            }}
          />
        )}

        {templates.map((tpl) =>
          editingId === tpl.id ? (
            <TemplateForm
              key={tpl.id}
              initial={tpl}
              onCancel={() => setEditingId(null)}
              onSave={async (label, text) => {
                const res = await fetch(`/api/manage/templates/${tpl.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ label, text }),
                })
                if (!res.ok) return { ok: false, msg: 'Не удалось сохранить' }
                await load()
                setEditingId(null)
                return { ok: true }
              }}
            />
          ) : (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              onEdit={() => setEditingId(tpl.id)}
              onDelete={async () => {
                if (!confirm(`Удалить шаблон «${tpl.label}»?`)) return
                const res = await fetch(`/api/manage/templates/${tpl.id}`, {
                  method: 'DELETE',
                })
                if (res.ok) load()
              }}
            />
          )
        )}

        {!loading && templates.length === 0 && !showNew && (
          <div className="text-center py-12">
            <p className="text-sm text-neutral-700 mb-4">Пока нет шаблонов</p>
            <button
              onClick={() => setShowNew(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
            >
              + Создать первый
            </button>
          </div>
        )}

        {!canAdd && (
          <div className="text-center text-xs text-neutral-700 py-3 bg-amber-50 border border-amber-200 rounded-lg font-medium">
            Достигнут лимит в {MAX_TEMPLATES} шаблонов. Удалите ненужные, чтобы добавить новые.
          </div>
        )}
      </div>
    </div>
  )
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: Template
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white border-2 border-neutral-200 rounded-xl p-4 hover:border-neutral-300 transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md text-xs font-semibold">
          {template.label}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={onEdit}
            className="text-xs font-medium text-neutral-700 hover:text-neutral-900 px-2 py-1 rounded hover:bg-neutral-100"
          >
            Изменить
          </button>
          <button
            onClick={onDelete}
            className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
          >
            Удалить
          </button>
        </div>
      </div>
      <div className="text-sm text-neutral-800 whitespace-pre-wrap">{template.text}</div>
    </div>
  )
}

function TemplateForm({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Template
  onCancel: () => void
  onSave: (label: string, text: string) => Promise<{ ok: boolean; msg?: string }>
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [text, setText] = useState(initial?.text ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!label.trim() || !text.trim()) {
      setError('Заполните оба поля')
      return
    }
    setSaving(true)
    setError(null)
    const result = await onSave(label.trim(), text.trim())
    if (!result.ok) {
      setError(result.msg ?? 'Ошибка')
    }
    setSaving(false)
  }

  return (
    <div className="bg-white border-2 border-amber-400 rounded-xl p-4 space-y-3">
      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
          Ключевое слово (для кнопки в чате)
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, MAX_LABEL))}
          placeholder="Например: Извинение"
          maxLength={MAX_LABEL}
          className="w-full border-2 border-neutral-200 rounded-lg px-3 py-2 text-base text-neutral-900 focus:outline-none focus:border-amber-500"
        />
        <div className="text-xs text-neutral-700 mt-1">{label.length}/{MAX_LABEL}</div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
          Текст ответа
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
          placeholder="Например: Извините за неудобство. Передал ваш отзыв администратору, свяжемся с вами в течение часа."
          rows={4}
          maxLength={MAX_TEXT}
          className="w-full border-2 border-neutral-200 rounded-lg px-3 py-2 text-base text-neutral-900 focus:outline-none focus:border-amber-500"
        />
        <div className="text-xs text-neutral-700 mt-1">{text.length}/{MAX_TEXT}</div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg font-medium">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 transition"
        >
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border-2 border-neutral-200 text-neutral-800 rounded-lg text-sm font-semibold hover:bg-neutral-50 transition"
        >
          Отмена
        </button>
      </div>
    </div>
  )
}