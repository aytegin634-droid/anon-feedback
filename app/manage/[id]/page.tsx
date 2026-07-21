import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ThreadAdminView from './thread-admin-view'

export const dynamic = 'force-dynamic'

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: feedback } = await supabase
    .from('feedbacks')
    .select('*')
    .eq('id', id)
    .single()

  if (!feedback) notFound()

  const [{ data: messages }, { data: fields }, { data: venue }, { data: templates }] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .eq('feedback_id', id)
      .order('created_at'),
    supabase
      .from('form_fields')
      .select('*')
      .eq('venue_id', feedback.venue_id)
      .order('position'),
    supabase
      .from('venues')
      .select('name')
      .eq('id', feedback.venue_id)
      .single(),
    supabase
      .from('message_templates')
      .select('*')
      .eq('venue_id', feedback.venue_id)
      .is('auto_type', null)
      .order('position'),
  ])

  // помечаем как прочитанное; если статус "new" — переводим в работу
  // (просмотр = менеджер увидел и взял в обработку)
  await supabase
    .from('feedbacks')
    .update({ unread_for_manager: false })
    .eq('id', id)

  await supabase
    .from('feedbacks')
    .update({ status: 'in_progress' })
    .eq('id', id)
    .eq('status', 'new')

  return (
  <ThreadAdminView
    feedback={{ ...feedback, status: feedback.status === 'new' ? 'in_progress' : feedback.status }}
    initialMessages={messages ?? []}
    fields={fields ?? []}
    venue={venue ?? { name: '' }}
    templates={templates ?? []}
  />
)
}