'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSHint, setShowIOSHint] = useState(false)
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false)
  const [showIOSModal, setShowIOSModal] = useState(false)

  useEffect(() => {
    // если уже установлено или ранее закрыли промпт — не показываем
    if (typeof window === 'undefined') return
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed) return

    // проверка iOS Safari
    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)
    const isInStandaloneMode =
      'standalone' in navigator && (navigator as { standalone?: boolean }).standalone

    if (isIOS && !isInStandaloneMode) {
      // показываем подсказку с инструкцией через несколько секунд после загрузки
      const t = setTimeout(() => setShowIOSHint(true), 2000)
      return () => clearTimeout(t)
    }

    // Android Chrome / Edge / прочие — слушаем стандартное событие
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowAndroidPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const installAndroid = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setShowAndroidPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const dismiss = () => {
    localStorage.setItem('pwa-install-dismissed', '1')
    setShowAndroidPrompt(false)
    setShowIOSHint(false)
    setShowIOSModal(false)
  }

  if (showAndroidPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-white border border-neutral-200 rounded-xl shadow-lg p-4 flex items-center gap-3 z-50">
        <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-xl flex-shrink-0">
          📲
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Установить приложение</div>
          <div className="text-xs text-neutral-700">Быстрый доступ с главного экрана</div>
        </div>
        <button
          onClick={installAndroid}
          className="text-xs bg-black text-white rounded-md px-3 py-1.5 flex-shrink-0"
        >
          Установить
        </button>
        <button onClick={dismiss} className="text-neutral-600 hover:text-neutral-700 text-lg leading-none">
          ×
        </button>
      </div>
    )
  }

  if (showIOSHint) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-white border border-neutral-200 rounded-xl shadow-lg p-4 flex items-center gap-3 z-50 text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-xl flex-shrink-0">
            📲
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Добавить на главный экран</div>
            <div className="text-xs text-neutral-700">Показать как</div>
          </div>
          <span
            onClick={(e) => {
              e.stopPropagation()
              dismiss()
            }}
            className="text-neutral-600 hover:text-neutral-700 text-lg leading-none px-2"
          >
            ×
          </span>
        </button>
        {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} onDismiss={dismiss} />}
      </>
    )
  }

  return null
}

function IOSInstallModal({ onClose, onDismiss }: { onClose: () => void; onDismiss: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-5 max-w-sm w-full"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium">Добавить на главный экран</h2>
          <button onClick={onClose} className="text-neutral-600 text-2xl leading-none">×</button>
        </div>

        <ol className="space-y-3 text-sm text-neutral-700">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-xs flex-shrink-0">1</span>
            <span>
              Нажмите кнопку <strong>Поделиться</strong>{' '}
              <span className="inline-block px-1.5 py-0.5 bg-neutral-100 rounded text-xs">⎘</span>{' '}
              внизу экрана
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-xs flex-shrink-0">2</span>
            <span>
              Прокрутите вниз и выберите <strong>«На экран „Домой"»</strong>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-xs flex-shrink-0">3</span>
            <span>Нажмите <strong>«Добавить»</strong> в правом верхнем углу</span>
          </li>
        </ol>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-neutral-200 rounded-lg py-2 text-sm">
            Понятно
          </button>
          <button onClick={onDismiss} className="text-sm font-medium text-neutral-700 px-3">
            Больше не показывать
          </button>
        </div>
      </div>
    </div>
  )
}