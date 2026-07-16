self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = {}
  }

  const title = data.title || 'Borsok'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'borsok-feedback',
    renotify: true,
    data: { url: data.url || '/manage' },
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options)
      if (typeof data.badgeCount === 'number' && 'setAppBadge' in navigator) {
        try {
          await navigator.setAppBadge(data.badgeCount)
        } catch (e) {}
      }
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/manage'

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try { await client.navigate(url) } catch (e) {}
          }
          return
        }
      }
      await self.clients.openWindow(url)
    })()
  )
})