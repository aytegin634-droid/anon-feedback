import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const limit = await checkRateLimit(`submit:${ip}`, 3, 3600)
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'rate_limited', retryAfter: limit.retryAfter },
        { status: 429 }
      )
    }

    const { venue_id, answers } = await req.json()

    if (!venue_id || !answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: feedback, error } = await supabase
      .from('feedbacks')
      .insert({ venue_id, answers })
      .select('id, anonymous_token')
      .single()

    if (error || !feedback) {
      console.error('insert feedback failed', error)
      return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
    }

    // переносим фото из _form/ в feedbacks/<id>/
    // ищем во всех ответах объекты с photos[] и обновляем пути
    const updatedAnswers = await reattachPhotos(supabase, answers, feedback.id)
    if (updatedAnswers !== answers) {
      await supabase
        .from('feedbacks')
        .update({ answers: updatedAnswers })
        .eq('id', feedback.id)
    }

    await supabase.from('messages').insert({
      feedback_id: feedback.id,
      author: 'system',
      text: 'Отзыв получен. Менеджер ответит здесь.',
    })

    return NextResponse.json({ token: feedback.anonymous_token })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}

type Photo = { url: string; path: string; type: string }

async function reattachPhotos(
  supabase: ReturnType<typeof createAdminClient>,
  answers: Record<string, unknown>,
  feedbackId: string
): Promise<Record<string, unknown>> {
  let changed = false
  const result: Record<string, unknown> = { ...answers }

  for (const [fieldId, value] of Object.entries(answers)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const v = value as { text?: string; photos?: Photo[] }
    if (!Array.isArray(v.photos) || v.photos.length === 0) continue

    const newPhotos: Photo[] = []
    for (const photo of v.photos) {
      if (!photo.path?.startsWith('_form/')) {
        newPhotos.push(photo)
        continue
      }
      const filename = photo.path.replace('_form/', '')
      const newPath = `${feedbackId}/${filename}`
      const { error: moveErr } = await supabase.storage
        .from('attachments')
        .move(photo.path, newPath)
      if (moveErr) {
        console.error('move file', moveErr)
        newPhotos.push(photo)
        continue
      }
      const { data } = supabase.storage.from('attachments').getPublicUrl(newPath)
      newPhotos.push({ url: data.publicUrl, path: newPath, type: photo.type })
      changed = true
    }
    result[fieldId] = { ...v, photos: newPhotos }
  }

  return changed ? result : answers
}