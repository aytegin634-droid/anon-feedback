import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VENUE_ID = '00000000-0000-0000-0000-000000000001'
const MAX_TEXT = 2000

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return supabase
}

export async function GET() {
  const supabase = await requireAuth()
  if (!supabase) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('message_templates')
    .select('auto_type, text, enabled, conditions')
    .eq('venue_id', VENUE_ID)
    .not('auto_type', 'is', null)

  const pick = (type: string) => {
    const row = data?.find((d) => d.auto_type === type)
    return {
      text: row?.text ?? '',
      enabled: row?.enabled ?? false,
      conditions: Array.isArray(row?.conditions) ? row!.conditions : [],
    }
  }

  return NextResponse.json({
    positive: pick('positive'),
    negative: pick('negative'),
  })
}

export async function PUT(req: Request) {
  const supabase = await requireAuth()
  if (!supabase) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const autoType = body.auto_type
  const text = (body.text ?? '').toString().trim()
  const enabled = !!body.enabled
  const conditions = Array.isArray(body.conditions) ? body.conditions : []

  if (autoType !== 'positive' && autoType !== 'negative') {
    return NextResponse.json({ error: 'bad_type' }, { status: 400 })
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ error: 'too_long', max: MAX_TEXT }, { status: 400 })
  }
  // включить можно только при наличии хотя бы одного условия (для негатива)
  // позитив можно включать без условий
  const finalEnabled =
    autoType === 'negative' ? enabled && conditions.length > 0 : enabled

  const label = autoType === 'positive' ? 'Автоответ (хорошие)' : 'Автоответ (плохие)'

  const { data: existing } = await supabase
    .from('message_templates')
    .select('id')
    .eq('venue_id', VENUE_ID)
    .eq('auto_type', autoType)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('message_templates')
      .update({ text, label, enabled: finalEnabled, conditions })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('message_templates')
      .insert({
        venue_id: VENUE_ID, auto_type: autoType, text, label,
        enabled: finalEnabled, conditions, position: -1,
      })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}