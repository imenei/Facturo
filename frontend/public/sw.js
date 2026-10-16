// Service Worker HelpDZ : permet d'ouvrir l'application sans réseau.
// - /_next/static/* (fichiers à hash)  : cache d'abord
// - pages (navigation) et /_next/data  : réseau d'abord (toujours la dernière version
//   quand on est en ligne), cache en secours -> pas de "cache figé"
// - autres fichiers statiques          : réponse du cache + mise à jour en arrière-plan
// Les appels à l'API (autre domaine) ne passent pas par ici : ils sont gérés dans lib/api.ts.
// Changer VERSION force le nettoyage des anciens caches.
const VERSION = 'v1';
const STATIC_CACHE = `helpdz-static-${VERSION}`;
const PAGES_CACHE = `helpdz-pages-${VERSION}`;
const NETWORK_TIMEOUT_MS = 5000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((c) => c.addAll(['/login', '/manifest.json']).catch(() => {})).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => ![STATIC_CACHE, PAGES_CACHE].includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function networkFirst(request, cacheName, fallbackUrls = []) {
  const cache = await caches.open(cacheName);
  try {
    const res = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (res && res.ok && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    for (const url of fallbackUrls) {
      const fb = await cache.match(url);
      if (fb) return fb;
    }
    return new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetching = fetch(request)
    .then((res) => { if (res && res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => cached);
  return cached || fetching;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API et autres domaines : non gérés ici

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES_CACHE, ['/dashboard', '/login']));
  } else if (url.pathname.startsWith('/_next/data/') || url.pathname.startsWith('/_next/image')) {
    event.respondWith(networkFirst(request, PAGES_CACHE));
  } else if (!url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});
