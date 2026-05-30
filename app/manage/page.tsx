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
    <div>
      <div className="bg-white border-b border-neutral-200 px-5 py-4 pl-16 md:pl-5">
        <h1 className="text-xl font-bold text-neutral-900">Отзывы</h1>
      </div>
      <Suspense>
        <InboxClient initial={feedbacks ?? []} />
      </Suspense>
    </div> 
  )
}