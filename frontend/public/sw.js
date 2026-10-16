// Service Worker HelpDZ : permet d'ouvrir l'application sans réseau.
// - /_next/static/* (fichiers à hash)  : cache d'abord
// - pages (navigation) et /_next/data  : réseau d'abord, cache en secours
// - autres fichiers statiques (ex: /locales) : cache + mise à jour en arrière-plan
// Les appels à l'API (autre domaine) sont gérés dans lib/api.ts.
// Changer VERSION force le nettoyage des anciens caches.
const VERSION = 'v2';
const STATIC_CACHE = `helpdz-static-${VERSION}`;
const PAGES_CACHE = `helpdz-pages-${VERSION}`;
const NETWORK_TIMEOUT_MS = 5000;

// Fichiers précachés à l'installation (chaque fichier est indépendant :
// si un seul échoue, les autres sont quand même mis en cache)
const PRECACHE_PAGES = ['/login', '/manifest.json'];
const PRECACHE_STATIC = [
  '/locales/fr/common.json',
  '/locales/en/common.json',
  '/locales/ar/common.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGES_CACHE);
      const statics = await caches.open(STATIC_CACHE);
      await Promise.allSettled([
        ...PRECACHE_PAGES.map((u) => pages.add(u)),
        ...PRECACHE_STATIC.map((u) => statics.add(u)),
      ]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => ![STATIC_CACHE, PAGES_CACHE].includes(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (r) => { clearTimeout(t); resolve(r); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function fallbackResponse(request, text = 'Hors ligne') {
  const isJson = new URL(request.url).pathname.endsWith('.json');
  return new Response(isJson ? '{}' : text, {
    status: 503,
    headers: {
      'Content-Type': isJson ? 'application/json' : 'text/plain; charset=utf-8',
    },
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
    return fallbackResponse(request);
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    return fallbackResponse(request, '');
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetching = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (cached) return cached;
  const res = await fetching;
  return res || fallbackResponse(request, '');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API et autres domaines

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES_CACHE, ['/dashboard', '/login']));
  } else if (
    url.pathname.startsWith('/_next/data/') ||
    url.pathname.startsWith('/_next/image')
  ) {
    event.respondWith(networkFirst(request, PAGES_CACHE));
  } else if (!url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});
