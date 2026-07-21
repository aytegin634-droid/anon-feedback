import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToManagers } from '@/lib/push'

const resend = new Resend(process.env.RESEND_API_KEY!)

// Supabase webhook отправляет такое тело при INSERT
type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Record<string, unknown>
  old_record: Record<string, unknown> | null
}

export async function POST(req: Request) {
  // 1. Проверяем секрет — webhook от Supabase должен прислать заголовок
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = (await req.json()) as WebhookPayload

  try {
    if (payload.table === 'feedbacks' && payload.type === 'INSERT') {
      await notifyNewFeedback(payload.record)
    } else if (payload.table === 'messages' && payload.type === 'INSERT') {
      const author = payload.record.author as string
      if (author === 'guest') {
        await notifyGuestMessage(payload.record)
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('notification failed', e)
    // не возвращаем 500, чтобы Supabase не ретраил бесконечно
    return NextResponse.json({ ok: false, error: String(e) })
  }
}

async function notifyNewFeedback(feedback: Record<string, unknown>) {
  const supabase = createAdminClient()
  const feedbackId = feedback.id as string
  const venueId = feedback.venue_id as string
  const answers = feedback.answers as Record<string, unknown>
  const token = feedback.anonymous_token as string

  const { data: formRow } = await supabase
  .from('forms').select('name, is_system').eq('id', feedback.form_id as string).maybeSingle()

  const [{ data: venue }, { data: fields }] = await Promise.all([
    supabase.from('venues').select('name').eq('id', venueId).single(),
    supabase
      .from('form_fields')
      .select('id, label, field_type, position, parent_field_id')
      .eq('venue_id', venueId)
      .order('position'),
  ])

  const branch = findBranch(answers)
  const scores = collectScores(answers, fields ?? [])
  const worst = worstScore(scores)
  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/manage/${feedbackId}`

  const html = renderNewFeedbackEmail({
    venueName: venue?.name ?? 'Заведение',
    branch,
    worst,
    answers,
    fields: fields ?? [],
    adminUrl,
    token,
    guestName: (feedback.guest_name as string | null) ?? null,
  })

  const subject = (() => {
    if (!worst) return `Новый отзыв — ${branch ?? venue?.name ?? 'заведение'}`
    const place = branch ?? venue?.name ?? 'отзыв'
    if (worst.value <= 6) return `🔴 ${shortenLabel(worst.label)} ${worst.value}/10 — ${place}`
    if (worst.value <= 8) return `🟡 ${shortenLabel(worst.label)} ${worst.value}/10 — ${place}`
    return `Новый отзыв ${worst.value}/10 — ${place}`
  })()

  const finalSubject = formRow && !formRow.is_system
  ? `📋 ${formRow.name} — новый ответ`
  : subject

  await resend.emails.send({
    from: process.env.NOTIFICATION_FROM_EMAIL!,
    to: process.env.NOTIFICATION_TO_EMAIL!,
    subject: finalSubject,
    html,
  })

  const guestNameForPush = (feedback.guest_name as string | null) ?? null

  await sendPushToManagers({
    title: worst && worst.value <= 6 ? `🔴 Низкая оценка ${worst.value}/10` : 'Новый отзыв',
    body: `${branch ?? venue?.name ?? 'Borsok'}${guestNameForPush ? ` · ${guestNameForPush}` : ''}`,
    url: `/manage/${feedbackId}`,
    tag: `feedback-${feedbackId}`,
  })
}

async function notifyGuestMessage(message: Record<string, unknown>) {
  const supabase = createAdminClient()
  const feedbackId = message.feedback_id as string
  const text = (message.text as string | null) ?? ''
  const attachments = (message.attachments as { url: string }[] | null) ?? []

  const { data: feedback } = await supabase
    .from('feedbacks')
    .select('anonymous_token, answers, venue_id')
    .eq('id', feedbackId)
    .single()
  if (!feedback) return

  const { data: venue } = await supabase
    .from('venues')
    .select('name')
    .eq('id', feedback.venue_id)
    .single()

  const branch = findBranch(feedback.answers as Record<string, unknown>)
  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/manage/${feedbackId}`

  const html = renderGuestMessageEmail({
    venueName: venue?.name ?? 'Заведение',
    branch,
    text,
    hasPhotos: attachments.length > 0,
    photosCount: attachments.length,
    adminUrl,
  })

  await resend.emails.send({
    from: process.env.NOTIFICATION_FROM_EMAIL!,
    to: process.env.NOTIFICATION_TO_EMAIL!,
    subject: `Гость ответил — ${branch ?? venue?.name ?? 'тред'}`,
    html,
  })

  await sendPushToManagers({
    title: 'Гость ответил',
    body: text ? text.slice(0, 120) : 'Прислал фото',
    url: `/manage/${feedbackId}`,
    tag: `thread-${feedbackId}`,
  })
}

// === вспомогательные ===

type ScoredField = { label: string; value: number }

function collectScores(
  answers: Record<string, unknown>,
  fields: { id: string; label: string; field_type: string }[]
): ScoredField[] {
  const scores: ScoredField[] = []
  for (const f of fields) {
    if (f.field_type !== 'scale') continue
    const v = answers[f.id]
    if (typeof v === 'number') {
      scores.push({ label: f.label, value: v })
    }
  }
  return scores
}

function worstScore(scores: ScoredField[]): ScoredField | null {
  if (scores.length === 0) return null
  return scores.reduce((acc, cur) => (cur.value < acc.value ? cur : acc))
}

function shortenLabel(label: string): string {
  // "Оцените обслуживание" → "обслуживание"
  return label.replace(/^Оцените\s+/i, '').toLowerCase()
}

function findBranch(answers: Record<string, unknown>): string | null {
  const branches = ['Араванская', 'Дом-Быта', 'Юго-Восток', 'Анар']
  for (const v of Object.values(answers)) {
    if (typeof v === 'string' && branches.includes(v)) return v
  }
  return null
}

function findMinScore(answers: Record<string, unknown>): number | null {
  const nums = Object.values(answers).filter((v) => typeof v === 'number') as number[]
  if (nums.length === 0) return null
  return Math.min(...nums)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatAnswer(value: unknown): string {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return escapeHtml(value.join(', '))
  if (typeof value === 'object') {
    const v = value as { text?: string; photos?: { url: string }[] }
    const parts: string[] = []
    if (v.text) parts.push(escapeHtml(v.text))
    if (v.photos && v.photos.length > 0) parts.push(`<em>+${v.photos.length} фото</em>`)
    return parts.join('<br>')
  }
  return escapeHtml(String(value))
}

function scoreColor(score: number): string {
  if (score <= 6) return '#dc2626' // red
  if (score <= 8) return '#d97706' // amber
  return '#16a34a' // green
}

function renderNewFeedbackEmail(p: {
  venueName: string
  branch: string | null
  worst: ScoredField | null
  answers: Record<string, unknown>
  fields: { id: string; label: string; field_type: string; parent_field_id: string | null }[]
  adminUrl: string
  token: string
  guestName: string | null
}): string {
  const rootFields = p.fields.filter((f) => !f.parent_field_id)
  const answerRows = rootFields
    .map((f) => {
      const value = p.answers[f.id]
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return ''
      let valueHtml = formatAnswer(value)
      if (f.field_type === 'scale' && typeof value === 'number') {
        const color = scoreColor(value)
        valueHtml = `<span style="color:${color};font-weight:600">${value}/10</span>`
      }
      const children = p.fields.filter((c) => c.parent_field_id === f.id)
      const childAnswers = children
        .filter((c) => p.answers[c.id] != null && p.answers[c.id] !== '')
        .map((c) => `<div style="margin-top:6px;padding-left:12px;border-left:3px solid #e5e5e5">
          <div style="font-size:12px;color:#737373;margin-bottom:2px">${escapeHtml(c.label)}</div>
          <div style="font-size:14px;color:#171717">${formatAnswer(p.answers[c.id])}</div>
        </div>`)
        .join('')

      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f5f5f5">
            <div style="font-size:12px;color:#737373;margin-bottom:4px">${escapeHtml(f.label)}</div>
            <div style="font-size:14px;color:#171717;line-height:1.5">${valueHtml}</div>
            ${childAnswers}
          </td>
        </tr>
      `
    })
    .join('')

  const headerBadge = p.worst
    ? `<div style="margin-top:6px;font-size:13px;color:#737373">
         Худшая оценка:
         <span style="color:${scoreColor(p.worst.value)};font-weight:600">${escapeHtml(p.worst.label)} — ${p.worst.value}/10</span>
       </div>`
    : ''

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:20px">
    <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e5e5e5">
      <h1 style="margin:0 0 4px;font-size:18px;color:#171717">Новый отзыв</h1>
      <p style="margin:0 0 4px;font-size:14px;color:#737373">
        ${escapeHtml(p.venueName)}${p.branch ? ` · ${escapeHtml(p.branch)}` : ''}
      </p>
      ${p.guestName ? `<p style="margin:0 0 4px;font-size:14px;color:#171717"><strong>👤 ${escapeHtml(p.guestName)}</strong></p>` : ''}
      ${headerBadge}

      <table style="width:100%;border-collapse:collapse;margin-top:16px">${answerRows}</table>

      <a href="${p.adminUrl}" style="display:inline-block;margin-top:24px;background:#171717;color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500">
        Ответить гостю
      </a>

      <p style="margin:24px 0 0;font-size:11px;color:#a3a3a3;font-family:monospace">
        #${p.token.slice(0, 7)}
      </p>
    </div>
    <p style="text-align:center;margin:16px 0 0;font-size:11px;color:#a3a3a3">
      Borsok · уведомления о новых отзывах
    </p>
  </div>
</body></html>`
}

function renderGuestMessageEmail(p: {
  venueName: string
  branch: string | null
  text: string
  hasPhotos: boolean
  photosCount: number
  adminUrl: string
}): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:20px">
    <div style="background:white;border-radius:12px;padding:24px;border:1px solid #e5e5e5">
      <h1 style="margin:0 0 4px;font-size:18px;color:#171717">Гость ответил вам</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#737373">
        ${escapeHtml(p.venueName)}${p.branch ? ` · ${escapeHtml(p.branch)}` : ''}
      </p>

      ${p.text ? `<div style="background:#f5f5f5;border-radius:8px;padding:14px;font-size:14px;line-height:1.5;color:#171717;white-space:pre-wrap">${escapeHtml(p.text)}</div>` : ''}
      ${p.hasPhotos ? `<p style="margin:12px 0 0;font-size:13px;color:#737373">📎 Прикреплено фото: ${p.photosCount}</p>` : ''}

      <a href="${p.adminUrl}" style="display:inline-block;margin-top:24px;background:#171717;color:white;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500">
        Открыть переписку
      </a>
    </div>
  </div>
</body></html>`
}