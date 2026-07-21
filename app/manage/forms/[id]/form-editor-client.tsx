'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type EditorField = {
  id: string
  position: number
  field_type: 'short_text' | 'long_text' | 'select' | 'multi_select' | 'scale' | 'date'
  label: string
  options: string[]
  required: boolean
  is_archived: boolean
  parent_field_id: string | null
  field_key: string | null
  has_answers: boolean
  allow_photos: boolean
  show_when: { operator: string; value?: number; values?: string[] } | null
}

const TYPE_LABELS: Record<string, string> = {
  short_text: 'Короткий текст',
  long_text: 'Длинный текст',
  select: 'Один вариант',
  multi_select: 'Несколько вариантов',
  scale: 'Оценка 0–10',
  date: 'Дата',
}

export default function FormEditorClient({
  form,
}: {
  form: { id: string; name: string; slug: string; is_system: boolean }
}) {
  const [fields, setFields] = useState<EditorField[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const load = async () => {
    const res = await fetch(`/api/manage/forms/${form.id}/fields`)
    if (res.ok) {
      const d = await res.json()
      setFields(d.fields ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const roots = fields
    .filter((f) => !f.parent_field_id && (showArchived || !f.is_archived))
    .sort((a, b) => a.position - b.position)
  const childrenOf = (id: string) =>
    fields.filter((f) => f.parent_field_id === id && !f.is_archived)

  const move = async (idx: number, dir: -1 | 1) => {
    const active = roots.filter((f) => !f.is_archived)
    const target = idx + dir
    if (target < 0 || target >= active.length) return
    const order = [...active]
    ;[order[idx], order[target]] = [order[target], order[idx]]
    // остальные поля (архивные) не участвуют в порядке
    await fetch(`/api/manage/forms/${form.id}/fields/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: order.map((f) => f.id) }),
    })
    load()
  }

  return (
    <div>
      <div className="bg-white border-b border-neutral-200 px-5 py-4 pl-16 md:pl-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link href="/manage/forms" className="text-sm text-neutral-700 hover:text-neutral-900 font-medium">
            ← Формы
          </Link>
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2 flex-wrap">
            {form.name}
            {form.is_system && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">Системная</span>
            )}
          </h1>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          + Вопрос
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-3">
        {loading && <div className="text-center text-sm text-neutral-700 py-8">Загружаем…</div>}

        {showNew && (
          <FieldForm
            parentCandidates={roots.filter((f) => !f.is_archived &&
                ['select', 'multi_select', 'scale'].includes(f.field_type))}
            onCancel={() => setShowNew(false)}
            onSave={async (payload) => {
              const res = await fetch(`/api/manage/forms/${form.id}/fields`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              })
              if (!res.ok) return false
              setShowNew(false)
              load()
              return true
            }}
          />
        )}

        {editingId && fields.find((f) => f.id === editingId && f.parent_field_id) && (() => {
          const child = fields.find((f) => f.id === editingId)!
          return (
            <FieldForm
              key={child.id}
              initial={child}
              parentCandidates={roots.filter((f) => !f.is_archived &&
                ['select', 'multi_select', 'scale'].includes(f.field_type))}
              onCancel={() => setEditingId(null)}
              onSave={async (payload) => {
                const res = await fetch(`/api/manage/forms/${form.id}/fields/${child.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                })
                if (!res.ok) return false
                setEditingId(null)
                load()
                return true
              }}
            />
          )
        })()}

        {roots.map((field, idx) =>
          editingId === field.id ? (
            <FieldForm
              parentCandidates={roots.filter((f) => !f.is_archived &&
                ['select', 'multi_select', 'scale'].includes(f.field_type) && f.id !== field?.id)}
              key={field.id}
              initial={field}
              onCancel={() => setEditingId(null)}
              onSave={async (payload) => {
                const res = await fetch(`/api/manage/forms/${form.id}/fields/${field.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                })
                if (!res.ok) return false
                setEditingId(null)
                load()
                return true
              }}
            />
          ) : (
            <FieldCard
              key={field.id}
              field={field}
              childFields={childrenOf(field.id)}
              canMoveUp={idx > 0}
              canMoveDown={idx < roots.length - 1}
              onMoveUp={() => move(idx, -1)}
              onMoveDown={() => move(idx, 1)}
              onEdit={() => setEditingId(field.id)}
              onArchive={async () => {
                if (!confirm(`Архивировать вопрос «${field.label}»? Ответы сохранятся, но гости его больше не увидят.`)) return
                const res = await fetch(`/api/manage/forms/${form.id}/fields/${field.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ is_archived: true }),
                })
                if (!res.ok) {
                  const j = await res.json().catch(() => ({}))
                  alert(j.error === 'last_field'
                    ? 'Нельзя архивировать последний вопрос — форма не может быть пустой.'
                    : 'Не удалось архивировать')
                }
                load()
              }}
              onRestore={async () => {
                await fetch(`/api/manage/forms/${form.id}/fields/${field.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ is_archived: false }),
                })
                load()
              }}
              onEditChild={(id) => setEditingId(id)}
              onArchiveChild={async (c) => {
                if (!confirm(`Архивировать условный вопрос «${c.label}»?`)) return
                await fetch(`/api/manage/forms/${form.id}/fields/${c.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ is_archived: true }),
                })
                load()
              }}
            />
          )
        )}

        {showArchived && fields
        .filter((f) => f.parent_field_id && f.is_archived)
        .map((c) => (
          <div key={c.id} className="bg-white border-2 border-neutral-200 rounded-xl p-4 opacity-50">
            <div className="text-sm font-semibold text-neutral-900">↳ {c.label}</div>
            <div className="text-xs text-neutral-700 mt-0.5">условный · архив</div>
            <button
              onClick={async () => {
                await fetch(`/api/manage/forms/${form.id}/fields/${c.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ is_archived: false }),
                })
                load()
              }}
              className="mt-2 text-xs font-medium border-2 border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50"
            >
              Восстановить
            </button>
          </div>
        ))}

        {!loading && (
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs text-neutral-700 hover:underline font-medium"
          >
            {showArchived ? 'Скрыть архивные' : 'Показать архивные'}
          </button>
        )}
      </div>
    </div>
  )
}

function FieldCard({
  field, childFields, canMoveUp, canMoveDown,
  onMoveUp, onMoveDown, onEdit, onArchive, onRestore,
  onEditChild, onArchiveChild,
}: {
  field: EditorField
  childFields: EditorField[]
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: () => void
  onArchive: () => void
  onRestore: () => void
  onEditChild: (id: string) => void
  onArchiveChild: (c: EditorField) => void
}) {
  return (
    <div className={`bg-white border-2 rounded-xl p-4 ${field.is_archived ? 'border-neutral-200 opacity-50' : 'border-neutral-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-900">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </div>
          <div className="text-xs text-neutral-700 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{TYPE_LABELS[field.field_type]}</span>
            {field.has_answers && <span className="bg-neutral-100 px-1.5 py-0.5 rounded">есть ответы</span>}
            {field.field_key && <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{field.field_key}</span>}
            {field.is_archived && <span className="bg-neutral-100 px-1.5 py-0.5 rounded">архив</span>}
          </div>
          {(field.field_type === 'select' || field.field_type === 'multi_select') && (
            <div className="text-xs text-neutral-600 mt-1 truncate">
              {field.options.join(' · ')}
            </div>
          )}
        </div>
        {!field.is_archived && (
          <div className="flex flex-col gap-0.5 shrink-0">
            <button onClick={onMoveUp} disabled={!canMoveUp}
              className="w-7 h-7 border border-neutral-200 rounded text-xs disabled:opacity-20 hover:bg-neutral-50">↑</button>
            <button onClick={onMoveDown} disabled={!canMoveDown}
              className="w-7 h-7 border border-neutral-200 rounded text-xs disabled:opacity-20 hover:bg-neutral-50">↓</button>
          </div>
        )}
      </div>

      {childFields.length > 0 && (
        <div className="mt-3 pl-3 border-l-2 border-amber-200 space-y-2">
          {childFields.map((c) => (
            <div key={c.id} className="bg-amber-50/50 border border-amber-100 rounded-lg px-3 py-2">
              <div className="text-sm text-neutral-800 font-medium">
                ↳ {c.label}
                {c.required && <span className="text-red-500 ml-1">*</span>}
              </div>
              <div className="text-xs text-neutral-600 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{TYPE_LABELS[c.field_type]}</span>
                <span className="text-neutral-500">условный</span>
                {c.allow_photos && <span>📎 фото</span>}
                {c.has_answers && <span className="bg-white px-1.5 py-0.5 rounded border border-neutral-200">есть ответы</span>}
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onEditChild(c.id)}
                  className="text-xs font-medium border border-neutral-200 bg-white rounded-lg px-2.5 py-1 hover:bg-neutral-50"
                >
                  Изменить
                </button>
                <button
                  onClick={() => onArchiveChild(c)}
                  className="text-xs font-medium text-red-600 border border-red-100 bg-white rounded-lg px-2.5 py-1 hover:bg-red-50"
                >
                  В архив
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        {field.is_archived ? (
          <button onClick={onRestore}
            className="text-xs font-medium border-2 border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50">
            Восстановить
          </button>
        ) : (
          <>
            <button onClick={onEdit}
              className="text-xs font-medium border-2 border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50">
              Изменить
            </button>
            <button onClick={onArchive}
              className="text-xs font-medium text-red-600 border-2 border-red-100 rounded-lg px-3 py-1.5 hover:bg-red-50">
              В архив
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function FieldForm({
  initial,
  parentCandidates,
  onCancel,
  onSave,
}: {
  initial?: EditorField
  parentCandidates: EditorField[]
  onCancel: () => void
  onSave: (payload: Record<string, unknown>) => Promise<boolean>
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [fieldType, setFieldType] = useState(initial?.field_type ?? 'short_text')
  const [required, setRequired] = useState(initial?.required ?? false)
  const [optionsText, setOptionsText] = useState((initial?.options ?? []).join('\n'))
  const [allowPhotos, setAllowPhotos] = useState(initial?.allow_photos ?? false)
  const [isConditional, setIsConditional] = useState(!!initial?.parent_field_id)
  const [parentId, setParentId] = useState(initial?.parent_field_id ?? '')
  const [condOperator, setCondOperator] = useState<string>(
    (initial?.show_when as { operator?: string } | null)?.operator ?? 'lt'
  )
  const [condValue, setCondValue] = useState<number>(
    (initial?.show_when as { value?: number } | null)?.value ?? 7
  )
  const [condValues, setCondValues] = useState<string[]>(
    (initial?.show_when as { values?: string[] } | null)?.values ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const typeLocked = !!initial?.has_answers
  const needsOptions = fieldType === 'select' || fieldType === 'multi_select'
  const parent = parentCandidates.find((p) => p.id === parentId)

  const save = async () => {
    if (!label.trim()) { setError('Введите текст вопроса'); return }
    const options = optionsText.split('\n').map((s) => s.trim()).filter(Boolean)
    if (needsOptions && options.length < 2) {
      setError('Нужно минимум два варианта (каждый с новой строки)')
      return
    }

    let showWhen: Record<string, unknown> | null = null
    let parentFieldId: string | null = null
    if (isConditional) {
      if (!parent) { setError('Выберите родительский вопрос'); return }
      parentFieldId = parent.id
      if (parent.field_type === 'scale') {
        showWhen = { operator: condOperator, value: condValue }
      } else {
        if (condValues.length === 0) {
          setError('Отметьте хотя бы один вариант-триггер')
          return
        }
        showWhen = { operator: 'in', values: condValues }
      }
    }

    setSaving(true)
    setError(null)
    const ok = await onSave({
      label: label.trim(),
      field_type: fieldType,
      required,
      options: needsOptions ? options : [],
      allow_photos: allowPhotos,
      parent_field_id: parentFieldId,
      show_when: showWhen,
    })
    setSaving(false)
    if (!ok) setError('Не удалось сохранить')
  }

  return (
    <div className="bg-white border-2 border-amber-400 rounded-xl p-4 space-y-3">
      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Текст вопроса</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 200))}
          className="w-full border-2 border-neutral-200 rounded-lg px-3 py-2 text-base text-neutral-900 focus:outline-none focus:border-amber-500"
        />
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Тип ответа</label>
          <select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as EditorField['field_type'])}
            disabled={typeLocked}
            className="text-sm border-2 border-neutral-200 rounded-lg px-3 py-2 text-neutral-900 disabled:opacity-50"
          >
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {typeLocked && (
            <div className="text-xs text-neutral-600 mt-1 max-w-[220px]">
              По вопросу уже есть ответы — тип менять нельзя.
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer pb-2.5">
          <input type="checkbox" checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="w-4 h-4 accent-amber-500" />
          <span className="text-sm font-medium text-neutral-800">Обязательный</span>
        </label>
        {(fieldType === 'short_text' || fieldType === 'long_text') && (
          <label className="flex items-center gap-2 cursor-pointer pb-2.5">
            <input type="checkbox" checked={allowPhotos}
              onChange={(e) => setAllowPhotos(e.target.checked)}
              className="w-4 h-4 accent-amber-500" />
            <span className="text-sm font-medium text-neutral-800">📎 Разрешить фото</span>
          </label>
        )}
      </div>

      {needsOptions && (
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
            Варианты ответа (каждый с новой строки)
          </label>
          <textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            rows={4}
            placeholder={'Отлично\nХорошо\nПлохо\nДругое'}
            className="w-full border-2 border-neutral-200 rounded-lg px-3 py-2 text-base text-neutral-900 focus:outline-none focus:border-amber-500"
          />
        </div>
      )}

      {/* Условный вопрос */}
      {parentCandidates.length > 0 && (
        <div className="border-t border-neutral-100 pt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isConditional}
              onChange={(e) => setIsConditional(e.target.checked)}
              className="w-4 h-4 accent-amber-500" />
            <span className="text-sm font-medium text-neutral-800">
              Условный — показывать только при определённом ответе
            </span>
          </label>

          {isConditional && (
            <div className="mt-2 space-y-2 pl-6">
              <select
                value={parentId}
                onChange={(e) => {
                  setParentId(e.target.value)
                  setCondValues([])
                }}
                className="w-full text-sm border-2 border-neutral-200 rounded-lg px-3 py-2 text-neutral-900"
              >
                <option value="">— выберите вопрос —</option>
                {parentCandidates.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>

              {parent?.field_type === 'scale' && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-700">Показывать, если оценка</span>
                  <select value={condOperator} onChange={(e) => setCondOperator(e.target.value)}
                    className="text-sm border-2 border-neutral-200 rounded px-2 py-1.5">
                    <option value="lt">меньше</option>
                    <option value="lte">меньше или равно</option>
                    <option value="gt">больше</option>
                    <option value="gte">больше или равно</option>
                  </select>
                  <input type="number" min={0} max={10} value={condValue}
                    onChange={(e) => setCondValue(Number(e.target.value))}
                    className="w-16 text-sm border-2 border-neutral-200 rounded px-2 py-1.5" />
                </div>
              )}

              {parent && parent.field_type !== 'scale' && (
                <div>
                  <div className="text-xs text-neutral-600 mb-1">Показывать, если выбран один из:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {parent.options.map((opt) => {
                      const sel = condValues.includes(opt)
                      return (
                        <button key={opt} type="button"
                          onClick={() => setCondValues((prev) =>
                            sel ? prev.filter((x) => x !== opt) : [...prev, opt]
                          )}
                          className={`text-xs px-2.5 py-1 rounded-md border-2 transition ${
                            sel ? 'border-amber-500 bg-amber-50 font-medium text-neutral-900'
                                : 'border-neutral-200 text-neutral-700'
                          }`}>
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-lg font-medium">{error}</div>
      )}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40">
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 border-2 border-neutral-200 text-neutral-800 rounded-lg text-sm font-semibold hover:bg-neutral-50">
          Отмена
        </button>
      </div>
    </div>
  )
}