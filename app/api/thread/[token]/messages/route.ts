import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_TEXT_LENGTH = 2000
const MAX_ATTACHMENTS = 4

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // лимит 10 сообщений в минуту с одного треда
  const limit = await checkRateLimit(`msg:${token}`, 10, 60)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfter: limit.retryAfter },
      { status: 429 }
    )
  }

  const body = await req.json()
  const text = (body.text ?? '').toString().trim()
  const attachments = Array.isArray(body.attachments) ? body.attachments : []

  if (!text && attachments.length === 0) {
    return NextResponse.json({ error: 'empty' }, { status: 400 })
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: 'too_long', max: MAX_TEXT_LENGTH },
      { status: 400 }
    )
  }
  if (attachments.length > MAX_ATTACHMENTS) {
    return NextResponse.json(
      { error: 'too_many_attachments', max: MAX_ATTACHMENTS },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const { data: feedback } = await supabase
    .from('feedbacks')
    .select('id')
    .eq('anonymous_token', token)
    .single()

  if (!feedback) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      feedback_id: feedback.id,
      author: 'guest',
      text: text || null,
      attachments,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  }

  return NextResponse.json({ message })
}