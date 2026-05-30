import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: feedback, error } = await supabase
    .from('feedbacks')
    .select('id, venue_id, answers, status, created_at')
    .eq('anonymous_token', token)
    .single()

  if (error || !feedback) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const [{ data: messages }, { data: fields }, { data: venue }] = await Promise.all([
    supabase
      .from('messages')
      .select('id, author, text, attachment_url, attachment_type, created_at')
      .eq('feedback_id', feedback.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('form_fields')
      .select('id, label, field_type, position')
      .eq('venue_id', feedback.venue_id)
      .order('position'),
    supabase
      .from('venues')
      .select('name')
      .eq('id', feedback.venue_id)
      .single(),
  ])

  // помечаем сообщения менеджера прочитанными
  await supabase
    .from('feedbacks')
    .update({ unread_for_guest: false })
    .eq('id', feedback.id)

  return NextResponse.json({
    feedback,
    messages: messages ?? [],
    fields: fields ?? [],
    venue: venue ?? { name: '' },
  })
}