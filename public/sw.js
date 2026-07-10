/**
 * Service worker for CollecTools Web Push (phone alerts).
 * Registered from the site when the user enables push notifications.
 */
self.addEventListener("push", (event) => {
  /** @type {PushEvent} */
  const pushEvent = event
  let data = {
    title: "CollecTools",
    body: "New alert",
    url: "/",
    tag: "collectools",
  }

  try {
    if (pushEvent.data) {
      const parsed = pushEvent.data.json()
      data = { ...data, ...parsed }
    }
  } catch {
    try {
      const text = pushEvent.data?.text()
      if (text) data.body = text
    } catch {
      // keep defaults
    }
  }

  pushEvent.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag || "collectools",
      data: { url: data.url || "/" },
      renotify: true,
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  /** @type {NotificationEvent} */
  const clickEvent = event
  clickEvent.notification.close()
  const targetUrl = clickEvent.notification.data?.url || "/"
  const absolute =
    typeof targetUrl === "string" && targetUrl.startsWith("http")
      ? targetUrl
      : new URL(targetUrl || "/", self.location.origin).href

  clickEvent.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url.startsWith(self.location.origin)) {
          void client.navigate(absolute)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(absolute)
      return undefined
    }),
  )
})
