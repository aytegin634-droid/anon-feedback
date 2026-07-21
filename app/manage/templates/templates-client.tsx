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
const MAX_TEXT = 2000

type ConditionField = {
  id: string
  label: string
  field_type: 'scale' | 'select' | 'multi_select'
  options: string[]
  position: number
}

export default function TemplatesClient({ conditionFields }: { conditionFields: ConditionField[] }) {
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

        <AutoReplySection conditionFields={conditionFields} />

        <div className="pt-2">
          <h2 className="text-sm font-bold text-neutral-900 mb-1">Быстрые ответы</h2>
          <p className="text-xs text-neutral-700 mb-3">Кнопки для вставки в чат вручную</p>
        </div>

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

type AutoCondition = {
  field_id: string
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'in'
  value?: number
  values?: string[]
}

type AutoReplyData = {
  text: string
  enabled: boolean
  conditions: AutoCondition[]
}

function AutoReplySection({ conditionFields }: { conditionFields: ConditionField[] }) {
  const [positive, setPositive] = useState<AutoReplyData | null>(null)
  const [negative, setNegative] = useState<AutoReplyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/manage/auto-replies')
      .then((r) => r.json())
      .then((d) => {
        setPositive(d.positive)
        setNegative(d.negative)
        setLoading(false)
      })
  }, [])

  if (loading || !positive || !negative) {
    return <div className="text-sm text-neutral-700 py-4">Загружаем автоответы…</div>
  }

  return (
    <div className="space-y-3 mb-6">
      <div>
        <h2 className="text-sm font-bold text-neutral-900 mb-1">Автоответы</h2>
        <p className="text-xs text-neutral-700">
          Отправляются гостю автоматически сразу после отзыва.
          Работают <strong>только для системной формы «Отзывы»</strong> — на дополнительные формы не действуют.
        </p>
      </div>

      <NegativeAutoReply
        data={negative}
        conditionFields={conditionFields}
        onSaved={(d) => setNegative(d)}
      />

      <PositiveAutoReply
        data={positive}
        onSaved={(d) => setPositive(d)}
      />
    </div>
  )
}

function NegativeAutoReply({
  data,
  conditionFields,
  onSaved,
}: {
  data: AutoReplyData
  conditionFields: ConditionField[]
  onSaved: (d: AutoReplyData) => void
}) {
  const [text, setText] = useState(data.text)
  const [enabled, setEnabled] = useState(data.enabled)
  const [conditions, setConditions] = useState<AutoCondition[]>(data.conditions)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const addCondition = () => {
    const first = conditionFields[0]
    if (!first) return
    const cond: AutoCondition =
      first.field_type === 'scale'
        ? { field_id: first.id, operator: 'lt', value: 7 }
        : { field_id: first.id, operator: 'in', values: [] }
    setConditions((prev) => [...prev, cond])
  }

  const updateCondition = (idx: number, cond: AutoCondition) => {
    setConditions((prev) => prev.map((c, i) => (i === idx ? cond : c)))
  }

  const removeCondition = (idx: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== idx))
  }

  const canEnable = conditions.length > 0
  const save = async () => {
    setSaving(true)
    setSaved(false)
    const finalEnabled = enabled && canEnable
    const res = await fetch('/api/manage/auto-replies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auto_type: 'negative',
        text: text.trim(),
        enabled: finalEnabled,
        conditions,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setEnabled(finalEnabled)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved({ text: text.trim(), enabled: finalEnabled, conditions })
    }
  }

  return (
    <div className="border-2 border-red-200 bg-red-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <div className="text-sm font-semibold text-neutral-900">
            Автоответ на отрицательные отзывы
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!canEnable}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-amber-500"
          />
          <span className="text-xs font-medium text-neutral-700">
            {enabled && canEnable ? 'Включён' : 'Выключен'}
          </span>
        </label>
      </div>

      {!canEnable && (
        <div className="text-xs text-neutral-700 bg-white border border-red-200 rounded-lg px-3 py-2">
          Добавьте хотя бы одно условие, чтобы включить автоответ.
        </div>
      )}

      <div>
        <div className="text-xs font-semibold text-neutral-700 mb-1.5">
          Отправлять, если выполнено хотя бы одно условие:
        </div>
        <div className="space-y-2">
          {conditions.map((cond, i) => (
            <ConditionRow
              key={i}
              cond={cond}
              fields={conditionFields}
              onChange={(c) => updateCondition(i, c)}
              onRemove={() => removeCondition(i)}
            />
          ))}
        </div>
        <button
          onClick={addCondition}
          className="mt-2 text-xs font-medium text-neutral-800 border-2 border-neutral-200 bg-white rounded-lg px-3 py-1.5 hover:border-amber-400"
        >
          + Добавить условие
        </button>
      </div>

      <div>
        <div className="text-xs font-semibold text-neutral-700 mb-1.5">Текст ответа</div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          rows={3}
          className="w-full border-2 border-neutral-200 rounded-lg px-3 py-2 text-base text-neutral-900 bg-white focus:outline-none focus:border-amber-500"
        />
        <div className="text-xs text-neutral-700 mt-1">{text.length}/2000</div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
      >
        {saving ? 'Сохраняем…' : saved ? '✓ Сохранено' : 'Сохранить'}
      </button>
    </div>
  )
}

function ConditionRow({
  cond,
  fields,
  onChange,
  onRemove,
}: {
  cond: AutoCondition
  fields: ConditionField[]
  onChange: (c: AutoCondition) => void
  onRemove: () => void
}) {
  const field = fields.find((f) => f.id === cond.field_id) ?? fields[0]

  const changeField = (fieldId: string) => {
    const f = fields.find((x) => x.id === fieldId)
    if (!f) return
    if (f.field_type === 'scale') {
      onChange({ field_id: fieldId, operator: 'lt', value: 7 })
    } else {
      onChange({ field_id: fieldId, operator: 'in', values: [] })
    }
  }

  return (
    <div className="bg-white border-2 border-neutral-200 rounded-lg p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={cond.field_id}
          onChange={(e) => changeField(e.target.value)}
          className="flex-1 text-sm border border-neutral-200 rounded px-2 py-1.5 text-neutral-900"
        >
          {fields.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <button
          onClick={onRemove}
          className="text-neutral-400 hover:text-red-600 text-lg leading-none px-1"
        >
          ×
        </button>
      </div>

      {field?.field_type === 'scale' ? (
        <div className="flex items-center gap-2">
          <select
            value={cond.operator}
            onChange={(e) => onChange({ ...cond, operator: e.target.value as AutoCondition['operator'] })}
            className="text-sm border border-neutral-200 rounded px-2 py-1.5 text-neutral-900"
          >
            <option value="lt">меньше</option>
            <option value="lte">меньше или равно</option>
            <option value="gt">больше</option>
            <option value="gte">больше или равно</option>
          </select>
          <input
            type="number"
            min={0}
            max={10}
            value={cond.value ?? 0}
            onChange={(e) => onChange({ ...cond, value: Number(e.target.value) })}
            className="w-20 text-sm border border-neutral-200 rounded px-2 py-1.5 text-neutral-900"
          />
        </div>
      ) : (
        <div>
          <div className="text-xs text-neutral-600 mb-1">Если выбран один из вариантов:</div>
          <div className="flex flex-wrap gap-1.5">
            {(field?.options ?? []).map((opt) => {
              const selected = (cond.values ?? []).includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const cur = cond.values ?? []
                    const next = selected
                      ? cur.filter((x) => x !== opt)
                      : [...cur, opt]
                    onChange({ ...cond, values: next })
                  }}
                  className={`text-xs px-2.5 py-1 rounded-md border-2 transition ${
                    selected
                      ? 'border-amber-500 bg-amber-50 text-neutral-900 font-medium'
                      : 'border-neutral-200 text-neutral-700'
                  }`}
                >
                  {opt}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PositiveAutoReply({
  data,
  onSaved,
}: {
  data: AutoReplyData
  onSaved: (d: AutoReplyData) => void
}) {
  const [text, setText] = useState(data.text)
  const [enabled, setEnabled] = useState(data.enabled)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/manage/auto-replies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auto_type: 'positive',
        text: text.trim(),
        enabled,
        conditions: [],
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved({ text: text.trim(), enabled, conditions: [] })
    }
  }

  return (
    <div className="border-2 border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <div className="text-sm font-semibold text-neutral-900">
            Автоответ на хорошие отзывы
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-amber-500"
          />
          <span className="text-xs font-medium text-neutral-700">
            {enabled ? 'Включён' : 'Выключен'}
          </span>
        </label>
      </div>
      <p className="text-xs text-neutral-700">
        Срабатывает, когда не сработал отрицательный (то есть отзыв без серьёзных претензий).
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 2000))}
        rows={3}
        className="w-full border-2 border-neutral-200 rounded-lg px-3 py-2 text-base text-neutral-900 bg-white focus:outline-none focus:border-amber-500"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-700">{text.length}/2000</span>
        <button
          onClick={save}
          disabled={saving}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-40"
        >
          {saving ? 'Сохраняем…' : saved ? '✓ Сохранено' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}