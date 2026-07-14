self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'Morettis';
  const options = {
    body: data.body || 'Nuevo aviso disponible.',
    icon: '/apple-touch-icon.png',
    badge: '/favicon.png',
    tag: data.tag || 'morettis-aviso',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => client.url === targetUrl);
    if (existing) return existing.focus();
    return clients.openWindow(targetUrl);
  })());
});
