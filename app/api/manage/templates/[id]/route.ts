import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_LABEL = 30
const MAX_TEXT = 2000

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return supabase
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await requireAuth()
  if (!supabase) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()
  const label = (body.label ?? '').toString().trim()
  const text = (body.text ?? '').toString().trim()

  if (!label || !text) {
    return NextResponse.json({ error: 'empty' }, { status: 400 })
  }
  if (label.length > MAX_LABEL || text.length > MAX_TEXT) {
    return NextResponse.json({ error: 'too_long' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('message_templates')
    .update({ label, text })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await requireAuth()
  if (!supabase) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const { error, count } = await supabase
    .from('message_templates')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (count === 0) {
    // RLS заблокировал или записи нет
    return NextResponse.json({ error: 'not_deleted' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}