/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config')

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development' || process.env.DESKTOP_BUILD === '1',
  buildExcludes: [/app-build-manifest\.json$/, /middleware-manifest\.json$/],
  // Next.js App Router ajoute un paramètre ?_rsc=xxxx (qui change à chaque
  // requête) sur les appels de navigation internes (RSC payload). Sans ça,
  // Workbox traite chaque navigation comme une URL différente et ne sert
  // jamais le cache : on l'ignore pour que la clé de cache reste stable.
  cacheStartUrl: true,
  fallbacks: {
    document: '/offline.html',
  },
  runtimeCaching: [
    {
      // Navigation entre pages de l'app (HTML + RSC payload). On ignore le
      // paramètre _rsc pour que la clé de cache soit stable. Pour la vraie
      // navigation document, next-pwa bascule automatiquement sur
      // /offline.html (option "fallbacks" ci-dessus). Pour les requêtes RSC
      // internes (destination vide, pas "document"), ce fallback automatique
      // ne s'applique pas : on intercepte nous-mêmes l'échec pour éviter
      // l'exception "no-response" non gérée, et on laisse Next.js basculer
      // sur une navigation classique du navigateur (son propre fallback).
      urlPattern: ({ request, url }) => {
        const isSameOrigin = self.origin === url.origin;
        if (!isSameOrigin) return false;
        if (url.pathname.startsWith('/api/')) return false;
        return request.mode === 'navigate' || url.searchParams.has('_rsc');
      },
      handler: 'NetworkFirst',
      options: {
        cacheName: 'facturo-pages',
        matchOptions: { ignoreSearch: true },
        expiration: { maxEntries: 64, maxAgeSeconds: 86400 },
        networkTimeoutSeconds: 4,
        plugins: [
          {
            handlerDidError: async ({ request }) => {
              if (request.destination === 'document') {
                return caches.match('/offline.html', { ignoreSearch: true });
              }
              // Requête RSC sans correspondance en cache : on renvoie une
              // réponse d'erreur "propre" (gérée) plutôt que de laisser
              // Workbox rejeter avec no-response. Next.js détecte l'échec du
              // fetch RSC et retombe lui-même sur une navigation classique.
              return new Response(null, { status: 503, statusText: 'Offline' });
            },
          },
        ],
      },
    },
    {
      // Appels vers l'API backend : on tente le réseau, mais on bascule vite
      // sur le cache (3s) pour éviter que l'app paraisse figée sans réseau.
      // Les pages elles-mêmes gèrent déjà leur propre fallback (getCached*),
      // ce cache HTTP est une sécurité supplémentaire au niveau du SW.
      urlPattern: ({ url }) => url.href.includes('/api/') || url.hostname.startsWith('api.'),
      handler: 'NetworkFirst',
      method: 'GET',
      options: {
        cacheName: 'facturo-api-cache',
        expiration: { maxEntries: 300, maxAgeSeconds: 86400 },
        networkTimeoutSeconds: 3,
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Reste du trafic externe (images, polices, etc.)
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'facturo-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 86400 },
        networkTimeoutSeconds: 5,
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  i18n,
};

module.exports = withPWA(nextConfig);