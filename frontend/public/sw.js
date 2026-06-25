// Ce fichier remplace l'ancien Service Worker (PWA/Workbox) qui causait
// des problèmes de cache figé sur l'application.
// Son seul rôle est de se désinstaller proprement et de vider le cache
// déjà présent chez les utilisateurs qui avaient l'ancienne version installée.
// Une fois tous les anciens Service Workers nettoyés, ce fichier ne sera
// plus appelé par personne (plus aucun enregistrement n'est effectué).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Supprime tous les caches créés par l'ancien Service Worker
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      // Désinscrit ce Service Worker lui-même : plus aucun SW actif après ça
      await self.registration.unregister();

      // Force tous les onglets ouverts à recharger avec une version propre
      const clientsList = await self.clients.matchAll({ type: 'window' });
      clientsList.forEach((client) => client.navigate(client.url));
    })(),
  );
});
