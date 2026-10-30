/**
 * SERVICE WORKER (PWA)
 *  1) Cachea los archivos estáticos de Next (/_next/static) y los iconos: carga instantánea.
 *  2) Navegación: red primero; si no hay conexión, muestra una pantalla offline.
 *  3) La API y Socket.IO NUNCA se cachean (los datos siempre son en vivo).
 *  4) Recibe notificaciones push aunque la app esté cerrada.
 * Para forzar una actualización de caché, cambia VERSION.
 */
const VERSION = 'v1';
const STATIC_CACHE = `static-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // API/Maps: red directa

  // Estáticos: caché primero (los nombres de Next llevan hash, nunca cambian).
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.open(STATIC_CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Páginas: red primero, pantalla offline si falla.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center">' +
      '<div><h2>Sin conexión</h2><p>Comprueba tu internet e inténtalo de nuevo.</p>' +
      '<button onclick="location.reload()" style="padding:12px 20px;font-size:16px">Reintentar</button></div>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
  }
});

// ---- Notificaciones push ----
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : { title: 'Notificación', body: '' };
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
    data: { url: data.url || '/' }, vibrate: [200, 100, 200],
  }));
});

// Al tocar la notificación: enfoca la app abierta o abre una ventana nueva.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { await c.focus(); if ('navigate' in c) await c.navigate(url); return; }
    }
    await self.clients.openWindow(url);
  })());
});
