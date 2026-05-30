'use client'

import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export default function SaveLinkBanner({ token }: { token: string }) {
  const [show, setShow] = useState(false)
  const [url, setUrl] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    const dismissedKey = `dismissed-banner:${token}`
    if (localStorage.getItem(dismissedKey)) return
    setShow(true)
    setUrl(window.location.href)
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share)
  }, [token])

  const dismiss = () => {
    localStorage.setItem(`dismissed-banner:${token}`, '1')
    setShow(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: select text
    }
  }

  const share = async () => {
    if (!navigator.share) return
    try {
      await navigator.share({
        title: 'Ваш отзыв в Borsok',
        text: 'Ссылка на мой отзыв и чат с менеджером',
        url,
      })
    } catch {
      // user cancelled
    }
  }

  if (!show) return null

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-6 h-6 mt-0.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-700">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 mb-1">Сохраните эту ссылку</p>
          <p className="text-xs text-amber-800 mb-3">
            Это единственный способ вернуться и прочитать ответ менеджера. Закроете вкладку — ссылка потеряется.
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              onClick={copy}
              className="text-xs bg-white border border-amber-300 rounded-md px-3 py-1.5 hover:bg-amber-100"
            >
              {copied ? '✓ Скопировано' : '📋 Скопировать ссылку'}
            </button>
            {canShare && (
              <button
                onClick={share}
                className="text-xs bg-white border border-amber-300 rounded-md px-3 py-1.5 hover:bg-amber-100"
              >
                📤 Поделиться
              </button>
            )}
            <button
              onClick={() => setShowQR((v) => !v)}
              className="text-xs bg-white border border-amber-300 rounded-md px-3 py-1.5 hover:bg-amber-100"
            >
              {showQR ? '✕ Скрыть QR' : '📱 Показать QR'}
            </button>
            <button
              onClick={dismiss}
              className="text-xs text-amber-700 hover:underline ml-auto"
            >
              Понятно, скрыть
            </button>
          </div>
          <p className="text-xs text-amber-700">
            Совет: добавьте в закладки браузера (Ctrl+D / Cmd+D) или сделайте скриншот этой страницы.
          </p>
          {showQR && url && (
            <div className="mt-3 p-3 bg-white rounded-lg inline-block">
              <QRCodeSVG value={url} size={140} />
              <p className="text-xs text-neutral-500 text-center mt-2">
                Отсканируйте с другого устройства
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}