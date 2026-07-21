import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import InboxClient from './inbox-client'
import ManageHeader from './manage-header'
import PushSetup from './push-setup'

export default async function AdminInboxPage() {
  const supabase = await createClient()
  const [{ data: feedbacks }, { data: forms }] = await Promise.all([
  supabase
    .from('feedbacks')
    .select('id, anonymous_token, answers, status, created_at, last_message_at, unread_for_manager, guest_name, form_id')
    .order('last_message_at', { ascending: false })
    .limit(100),
  supabase.from('forms').select('id, name, is_system').order('is_system', { ascending: false }),
])

  return (
    <div>
      <div className="bg-white border-b border-neutral-200 px-5 py-4 pl-16 md:pl-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Отзывы</h1>
        <PushSetup />
      </div>
      <Suspense>
        <InboxClient initial={feedbacks ?? []} forms={forms ?? []} />
      </Suspense>
    </div> 
  )
}