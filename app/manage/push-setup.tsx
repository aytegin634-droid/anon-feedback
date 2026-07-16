'use client'

import { useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

type PushState = 'loading' | 'unsupported' | 'need-install' | 'off' | 'on' | 'denied'

export default function PushSetup() {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    void init()
  }, [])

  const init = async () => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (isIOS && !standalone) {
      setState('need-install')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    const reg = await navigator.serviceWorker.register('/sw.js')
    const existing = await reg.pushManager.getSubscription()
    setState(existing ? 'on' : 'off')
  }

  const enable = async () => {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })
      const res = await fetch('/api/manage/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      setState(res.ok ? 'on' : 'off')
    } catch (e) {
      console.error(e)
      setState('off')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/manage/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      if ('clearAppBadge' in navigator) {
        try { await navigator.clearAppBadge() } catch {}
      }
      setState('off')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || state === 'unsupported') return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Настройки уведомлений"
        className={`relative w-9 h-9 rounded-lg border-2 flex items-center justify-center text-lg transition ${
          state === 'on'
            ? 'border-amber-300 bg-amber-50'
            : 'border-neutral-200 bg-white hover:border-neutral-300'
        }`}
      >
        {state === 'on' ? '🔔' : '🔕'}
        {state === 'on' && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-neutral-900">Уведомления</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {state === 'need-install' && (
              <p className="text-sm text-neutral-800">
                Чтобы получать уведомления на iPhone, добавьте приложение на главный
                экран и откройте его оттуда.
              </p>
            )}

            {state === 'denied' && (
              <p className="text-sm text-neutral-800">
                Уведомления заблокированы в настройках браузера. Разрешите их для
                этого сайта, затем вернитесь сюда.
              </p>
            )}

            {(state === 'on' || state === 'off') && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{state === 'on' ? '🔔' : '🔕'}</span>
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">
                      {state === 'on' ? 'Включены' : 'Выключены'}
                    </div>
                    <div className="text-xs text-neutral-700">
                      Оповещение при новом отзыве и ответе гостя, счётчик на иконке
                      приложения
                    </div>
                  </div>
                </div>
                <button
                  onClick={state === 'on' ? disable : enable}
                  disabled={busy}
                  className={`w-full py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-40 ${
                    state === 'on'
                      ? 'border-2 border-neutral-200 text-neutral-800 hover:bg-neutral-50'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  {busy ? '…' : state === 'on' ? 'Выключить' : 'Включить'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}