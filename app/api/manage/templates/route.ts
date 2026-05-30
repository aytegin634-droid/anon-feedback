import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VENUE_ID = '00000000-0000-0000-0000-000000000001'
const MAX_LABEL = 30
const MAX_TEXT = 500

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return supabase
}

export async function GET() {
  const supabase = await requireAuth()
  if (!supabase) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { data, error } = await supabase
    .from('message_templates')
    .select('id, label, text, position, created_at')
    .eq('venue_id', VENUE_ID)
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await requireAuth()
  if (!supabase) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const label = (body.label ?? '').toString().trim()
  const text = (body.text ?? '').toString().trim()

  if (!label || !text) {
    return NextResponse.json({ error: 'empty' }, { status: 400 })
  }
  if (label.length > MAX_LABEL) {
    return NextResponse.json({ error: 'label_too_long', max: MAX_LABEL }, { status: 400 })
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ error: 'text_too_long', max: MAX_TEXT }, { status: 400 })
  }

  // вычисляем следующий position
  const { data: maxPos } = await supabase
    .from('message_templates')
    .select('position')
    .eq('venue_id', VENUE_ID)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPos = (maxPos?.position ?? 0) + 1

  const { data, error } = await supabase
    .from('message_templates')
    .insert({ venue_id: VENUE_ID, label, text, position: nextPos })
    .select()
    .single()

  if (error) {
    if (error.message?.includes('TEMPLATES_LIMIT')) {
      return NextResponse.json({ error: 'limit_reached', max: 5 }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ template: data })
}