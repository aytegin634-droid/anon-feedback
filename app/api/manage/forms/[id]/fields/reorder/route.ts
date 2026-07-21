import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id: formId } = await params
  const { order } = await req.json() // массив field_id в нужном порядке

  if (!Array.isArray(order)) return NextResponse.json({ error: 'bad_order' }, { status: 400 })

  // позиции с шагом 10, чтобы было место для вставок
  for (let i = 0; i < order.length; i++) {
    await supabase
      .from('form_fields')
      .update({ position: (i + 1) * 10 })
      .eq('id', order[i])
      .eq('form_id', formId)
  }
  return NextResponse.json({ ok: true })
}