import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import InboxClient from './inbox-client'
import ManageHeader from './manage-header'

export default async function AdminInboxPage() {
  const supabase = await createClient()
  const { data: feedbacks } = await supabase
    .from('feedbacks')
    .select('id, anonymous_token, answers, status, created_at, last_message_at, unread_for_manager')
    .order('last_message_at', { ascending: false })
    .limit(100)

  return (
    <main className="min-h-screen bg-neutral-50">
      <ManageHeader
        title="Отзывы"
        right={
          <>
            <Link href="/manage/stats" className="text-xs text-neutral-300 hover:text-white">
              📊 Статистика
            </Link>
            <form action="/manage/logout" method="post">
              <button className="text-xs text-neutral-300 hover:text-white">Выйти</button>
            </form>
          </>
        }
      />
      <Suspense>
        <InboxClient initial={feedbacks ?? []} />
      </Suspense>
    </main>
  )
}