import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: feedback } = await supabase
    .from('feedbacks')
    .select('id')
    .eq('anonymous_token', token)
    .single()

  if (!feedback) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 })
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'too_large' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'not_image' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${feedback.id}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from('attachments')
    .upload(path, file, { contentType: file.type })

  if (error) {
    console.error('upload', error)
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
  }

  const { data } = supabase.storage.from('attachments').getPublicUrl(path)

  return NextResponse.json({
    url: data.publicUrl,
    type: file.type,
  })
}