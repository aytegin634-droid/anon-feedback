import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

let configured = false

function configure() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  configured = true
}

export async function sendPushToManagers(payload: {
  title: string
  body: string
  url: string
  tag?: string
}) {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return
  }
  configure()

  const supabase = createAdminClient()

  const [{ data: subs }, { count }] = await Promise.all([
    supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth'),
    supabase
      .from('feedbacks')
      .select('id', { count: 'exact', head: true })
      .eq('unread_for_manager', true),
  ])

  if (!subs || subs.length === 0) return

  const body = JSON.stringify({
    ...payload,
    badgeCount: count ?? 0,
  })

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        // 404/410 — подписка протухла, удаляем
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id)
        } else {
          console.error('push failed', status)
        }
      }
    })
  )
}