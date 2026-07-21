'use client'

import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

type FormItem = {
  id: string
  name: string
  slug: string
  is_system: boolean
  is_active: boolean
  created_at: string
}

export default function FormsClient({ initial }: { initial: FormItem[] }) {
  const [forms, setForms] = useState(initial)
  const [showNew, setShowNew] = useState(false)
  const [qrFor, setQrFor] = useState<FormItem | null>(null)

  const reload = async () => {
    const res = await fetch('/api/manage/forms')
    if (res.ok) {
      const d = await res.json()
      setForms(d.forms ?? [])
    }
  }

  return (
    <div>
      <div className="bg-white border-b border-neutral-200 px-5 py-4 pl-16 md:pl-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Формы</h1>
        <button
          onClick={() => setShowNew(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          + Создать форму
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-3">
        {showNew && (
          <NewFormCard
            onCancel={() => setShowNew(false)}
            onCreated={() => { setShowNew(false); reload() }}
          />
        )}
        {forms.map((f) => (
          <FormCard key={f.id} form={f} onQR={() => setQrFor(f)} onChanged={reload} />
        ))}
      </div>

      {qrFor && <QRModal form={qrFor} onClose={() => setQrFor(null)} />}
    </div>
  )
}

function FormCard({ form, onQR, onChanged }: { form: FormItem; onQR: () => void; onChanged: () => void }) {
  const url = `${window.location.origin}/f/${form.slug}`
  const [copied, setCopied] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(form.name)
  const [saving, setSaving] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const toggleActive = async () => {
    await fetch(`/api/manage/forms/${form.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !form.is_active }),
    })
    onChanged()
  }

  const rename = async () => {
    if (!newName.trim() || newName.trim() === form.name) {
      setRenaming(false)
      return
    }
    setSaving(true)
    await fetch(`/api/manage/forms/${form.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    setSaving(false)
    setRenaming(false)
    onChanged()
  }

  return (
    <div className={`bg-white border-2 rounded-xl p-4 ${form.is_active ? 'border-neutral-200' : 'border-neutral-200 opacity-60'}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value.slice(0, 60))}
                onKeyDown={(e) => { if (e.key === 'Enter') rename() }}
                autoFocus
                className="flex-1 border-2 border-amber-400 rounded-lg px-2 py-1 text-sm text-neutral-900 focus:outline-none"
              />
              <button onClick={rename} disabled={saving}
                className="text-xs bg-amber-500 text-white rounded-lg px-3 py-1.5 font-semibold disabled:opacity-40">
                {saving ? '…' : 'ОК'}
              </button>
              <button onClick={() => { setRenaming(false); setNewName(form.name) }}
                className="text-xs text-neutral-600 px-1">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-neutral-900">{form.name}</span>
              {form.is_system && (
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-semibold">Системная</span>
              )}
              {!form.is_active && (
                <span className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded font-medium">Выключена</span>
              )}
              {!form.is_system && (
                <button onClick={() => setRenaming(true)}
                  className="text-xs text-neutral-500 hover:text-neutral-800" title="Переименовать">
                  ✏️
                </button>
              )}
            </div>
          )}
          <div className="text-xs text-neutral-700 font-mono mt-1 truncate">/f/{form.slug}</div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={copy} className="text-xs font-medium border-2 border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50">
          {copied ? '✓ Скопировано' : '🔗 Ссылка'}
        </button>
        <button onClick={onQR} className="text-xs font-medium border-2 border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50">
          📱 QR-код
        </button>
        <a href={`/manage/forms/${form.id}`}
          className="text-xs font-medium border-2 border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50">
          ✏️ Вопросы
        </a>
        {!form.is_system && (
          <button onClick={toggleActive} className="text-xs font-medium border-2 border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50">
            {form.is_active ? 'Выключить' : 'Включить'}
          </button>
        )}
      </div>
    </div>
  )
}

function NewFormCard({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    if (!name.trim()) { setError('Введите название'); return }
    setSaving(true)
    setError(null)
    const res = await fetch('/api/manage/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setSaving(false)
    if (!res.ok) { setError('Не удалось создать'); return }
    onCreated()
  }

  return (
    <div className="bg-white border-2 border-amber-400 rounded-xl p-4 space-y-3">
      <div className="text-sm font-semibold text-neutral-900">Новая форма</div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value.slice(0, 60))}
        placeholder="Название, например: Анкета для банкета"
        className="w-full border-2 border-neutral-200 rounded-lg px-3 py-2.5 text-base text-neutral-900 focus:outline-none focus:border-amber-500"
      />
      {error && <div className="text-sm text-red-700 font-medium">{error}</div>}
      <div className="flex gap-2">
        <button onClick={create} disabled={saving}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40">
          {saving ? 'Создаём…' : 'Создать'}
        </button>
        <button onClick={onCancel}
          className="px-4 py-2 border-2 border-neutral-200 text-neutral-800 rounded-lg text-sm font-semibold hover:bg-neutral-50">
          Отмена
        </button>
      </div>
      <p className="text-xs text-neutral-700">
        После создания добавьте вопросы — пустая форма не принимает ответы.
      </p>
    </div>
  )
}

function QRModal({ form, onClose }: { form: FormItem; onClose: () => void }) {
  const url = `${window.location.origin}/f/${form.slug}`
  const canvasWrapRef = useRef<HTMLDivElement>(null)

  const download = () => {
    const canvas = canvasWrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `qr-${form.slug}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
        <div className="text-base font-bold text-neutral-900">{form.name}</div>
        <div ref={canvasWrapRef} className="inline-block p-3 bg-white border-2 border-neutral-200 rounded-xl">
          <QRCodeCanvas value={url} size={220} includeMargin />
        </div>
        <div className="text-xs text-neutral-700 font-mono break-all">{url}</div>
        <div className="flex gap-2">
          <button onClick={download}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-lg text-sm font-semibold">
            ⬇ Скачать PNG
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 border-2 border-neutral-200 text-neutral-800 rounded-lg text-sm font-semibold hover:bg-neutral-50">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}