import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ThreadAdminView from './thread-admin-view'
import { revalidatePath } from 'next/cache'

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
      .order('position'),
  ])

  // помечаем как прочитанное менеджером
  await supabase
    .from('feedbacks')
    .update({ unread_for_manager: false })
    .eq('id', id)
    
  revalidatePath('/manage')

  return (
    <ThreadAdminView
      feedback={feedback}
      initialMessages={messages ?? []}
      fields={fields ?? []}
      venue={venue ?? { name: '' }}
      templates={templates ?? []}
    />
  )
}