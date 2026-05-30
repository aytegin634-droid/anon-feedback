import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limit = await checkRateLimit(`upload-form:${ip}`, 20, 600)
  if (!limit.ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
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

  const supabase = createAdminClient()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  // временная папка _form/ — после submit фото переедет в папку feedback'а
  const path = `_form/${crypto.randomUUID()}.${ext}`

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
    path,
    type: file.type,
  })
}