import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import InboxClient from './inbox-client'

export default async function AdminInboxPage() {
  const supabase = await createClient()
  const { data: feedbacks } = await supabase
    .from('feedbacks')
    .select('id, anonymous_token, answers, status, created_at, last_message_at, unread_for_manager')
    .order('last_message_at', { ascending: false })
    .limit(100)

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 px-5 py-3 flex items-center justify-between">
        <h1 className="text-sm font-medium">Отзывы</h1>
        <div className="flex items-center">
          <Link href="/manage/stats" className="text-xs text-neutral-500 hover:text-neutral-800 mr-4">
            📊 Статистика
          </Link>
          <form action="/manage/logout" method="post">
            <button className="text-xs text-neutral-500 hover:text-neutral-800">Выйти</button>
          </form>
        </div>
      </header>
      <Suspense>
        <InboxClient initial={feedbacks ?? []} />
      </Suspense>
    </main>
  )
}