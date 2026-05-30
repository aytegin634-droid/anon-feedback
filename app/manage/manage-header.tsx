'use client'

import Link from 'next/link'

export default function ManageHeader({
  leftLink,
  leftLabel,
  title,
  right,
}: {
  leftLink?: string
  leftLabel?: string
  title?: string
  right?: React.ReactNode
}) {
  return (
    <header className="bg-neutral-900 text-white px-5 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4 min-w-0">
        {leftLink && (
          <Link href={leftLink} className="text-sm text-neutral-400 hover:text-white shrink-0">
            {leftLabel ?? '←'}
          </Link>
        )}
        {title && <h1 className="text-sm font-medium truncate">{title}</h1>}
      </div>
      {right && <div className="flex items-center gap-3 shrink-0">{right}</div>}
    </header>
  )
}