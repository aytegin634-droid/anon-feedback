import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const patch: Record<string, unknown> = {}
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active 
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 60)

  // системную форму нельзя выключить
  const { data: form } = await supabase.from('forms').select('is_system').eq('id', id).single()
  if (form?.is_system && patch.is_active === false) {
    return NextResponse.json({ error: 'system_protected' }, { status: 400 })
  }

  if (form?.is_system && 'name' in patch) {
    return NextResponse.json({ error: 'system_protected' }, { status: 400 })
  }

  const { error } = await supabase.from('forms').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}