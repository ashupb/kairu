const CACHE = 'kairu-familias-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e =>
  e.waitUntil(clients.claim())
);

self.addEventListener('fetch', e => {
  // Solo cachear requests del mismo origen (no APIs de Supabase)
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
