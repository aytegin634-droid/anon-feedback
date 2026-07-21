import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params

  await supabase
    .from('feedbacks')
    .update({ unread_for_manager: false })
    .eq('id', id)

  await supabase
    .from('feedbacks')
    .update({ status: 'in_progress' })
    .eq('id', id)
    .eq('status', 'new')

  return NextResponse.json({ ok: true })
}