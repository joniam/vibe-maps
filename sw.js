const CACHE_VER = 'v5';
const SHELL_CACHE = `vibemaps-shell-${CACHE_VER}`;

const SHELL_URLS = ['.', 'index.html', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('vibemaps-') && k !== SHELL_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Never cache Mapbox API/tile requests
  if (url.hostname.includes('mapbox.com') || url.hostname.includes('mapbox.cn')) {
    e.respondWith(fetch(e.request)); return;
  }
  // Google Fonts: network-first with cache fallback
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); return;
  }
  // App shell: cache-first
  e.respondWith(caches.match(e.request).then((c) => c || fetch(e.request)));
});
