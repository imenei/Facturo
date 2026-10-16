// Service Worker HelpDZ : permet d'ouvrir l'application sans réseau.
// - /_next/static/*                    : cache d'abord
// - pages (navigation), /_next/data, _rsc : réseau d'abord, cache en secours
// - autres fichiers statiques (/locales, manifest...) : cache + mise à jour en arrière-plan
// Les appels à l'API (autre domaine) sont gérés dans lib/api.ts.
// Changer VERSION force le nettoyage des anciens caches.
const VERSION = 'v4';
const STATIC_CACHE = `helpdz-static-${VERSION}`;
const PAGES_CACHE = `helpdz-pages-${VERSION}`;
const NETWORK_TIMEOUT_MS = 5000;

// Précache : chaque fichier est indépendant (un échec n'empêche pas les autres)
const PRECACHE_PAGES = ['/login'];
const PRECACHE_STATIC = [
  '/manifest.json',
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

// Réponse de secours : toujours une vraie Response (jamais undefined)
function fallbackResponse(request, text = 'Hors ligne') {
  const isJson = new URL(request.url).pathname.endsWith('.json');
  return new Response(isJson ? '{}' : text, {
    status: 503,
    headers: {
      'Content-Type': isJson ? 'application/json' : 'text/plain; charset=utf-8',
    },
  });
}

// Page affichée quand une page n'a jamais été ouverte en ligne.
// (On ne sert JAMAIS le HTML d'une autre page : ça cause des erreurs d'hydratation React.)
function offlinePage() {
  return new Response(
    '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Hors ligne</title></head>' +
      '<body style="font-family:sans-serif;text-align:center;padding:3rem">' +
      '<h2>Hors ligne</h2>' +
      "<p>Cette page n'a pas encore été ouverte en ligne.</p>" +
      '<button onclick="location.reload()">Réessayer</button>' +
      '</body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function networkFirst(request, cacheName, isNavigation = false) {
  const cache = await caches.open(cacheName);
  try {
    const res = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (res && res.ok && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const cached = await cache.match(request, { ignoreVary: true });
    if (cached) return cached;
    return isNavigation ? offlinePage() : fallbackResponse(request);
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
    event.respondWith(networkFirst(request, PAGES_CACHE, true));
  } else if (
    url.pathname.startsWith('/_next/data/') ||
    url.pathname.startsWith('/_next/image') ||
    url.searchParams.has('_rsc')
  ) {
    event.respondWith(networkFirst(request, PAGES_CACHE));
  } else if (!url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});
