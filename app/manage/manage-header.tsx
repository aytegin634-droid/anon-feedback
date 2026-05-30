'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function ManageSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // на логине сайдбар не показываем
  if (pathname === '/manage/login') return null

  // закрывать сайдбар при переходе по ссылке
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const links = [
    { href: '/manage', label: 'Отзывы', icon: '📥' },
    { href: '/manage/stats', label: 'Статистика', icon: '📊' },
    { href: '/manage/templates', label: 'Шаблоны', icon: '💬' },
  ]

  const isActive = (href: string) => {
    if (href === '/manage') return pathname === '/manage'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Мобильная кнопка-гамбургер */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 w-10 h-10 bg-neutral-900 text-white rounded-lg flex items-center justify-center shadow-lg"
        aria-label="Открыть меню"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Затемнение фона на мобильном */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 bg-black/50 z-40"
        />
      )}

      {/* Сайдбар */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 h-screen w-64 bg-neutral-900 text-white z-50
          flex flex-col transition-transform
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="px-5 py-5 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">Borsok</div>
            <div className="text-sm font-medium text-neutral-700 font-medium">Менеджер</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden text-neutral-600 hover:text-white text-2xl leading-none"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition
                ${isActive(l.href)
                  ? 'bg-amber-500 text-white'
                  : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'}
              `}
            >
              <span className="text-base">{l.icon}</span>
              <span>{l.label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-neutral-800">
          <form action="/manage/logout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
            >
              <span className="text-base">🚪</span>
              <span>Выйти</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}