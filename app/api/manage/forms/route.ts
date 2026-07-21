import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VENUE_ID = '00000000-0000-0000-0000-000000000001'

const TRANSLIT: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',
  м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',
  ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
}

function slugify(name: string): string {
  const base = name.toLowerCase()
    .split('').map((ch) => TRANSLIT[ch] ?? ch).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 6)
  return base ? `${base}-${suffix}` : `form-${suffix}`
}

async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? supabase : null
}

export async function GET() {
  const supabase = await requireAuth()
  if (!supabase) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data } = await supabase
    .from('forms')
    .select('id, name, slug, is_system, is_active, created_at')
    .order('is_system', { ascending: false })
    .order('created_at')
  return NextResponse.json({ forms: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await requireAuth()
  if (!supabase) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { name } = await req.json()
  const trimmed = (name ?? '').toString().trim()
  if (!trimmed) return NextResponse.json({ error: 'empty' }, { status: 400 })

  const { data, error } = await supabase
    .from('forms')
    .insert({ venue_id: VENUE_ID, name: trimmed.slice(0, 60), slug: slugify(trimmed) })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ form: data })
}