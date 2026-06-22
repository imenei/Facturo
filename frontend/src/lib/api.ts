import axios from 'axios';
import { getOfflineQueue, addToOfflineQueue, clearOfflineQueue } from './offlineDB';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.helpdz.com/api';

const api = axios.create({ baseURL: API_URL, timeout: 10000 });

// Inject token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('facturo_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('facturo_token');
      localStorage.removeItem('facturo_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// Vrai-faux ami : navigator.onLine indique seulement qu'une interface réseau
// est active (wifi/4G connecté), pas que le serveur est joignable. On essaie
// donc toujours la requête réelle, et on ne mets en queue qu'en cas d'échec
// réseau avéré (pas une erreur métier 4xx/5xx du serveur, qui doit remonter
// normalement à l'appelant).
function isNetworkError(err: any) {
  // Erreur axios sans réponse du serveur = vraie coupure réseau / timeout
  return !!err && !err.response && (err.code === 'ECONNABORTED' || err.message === 'Network Error' || err.code === 'ERR_NETWORK' || !navigator.onLine);
}

// Offline-aware POST/PUT/PATCH/DELETE.
// Utiliser ceci à la place de api.post/put/patch/delete pour toute action
// métier qui doit pouvoir être créée hors-ligne et synchronisée plus tard
// (factures, statut de tâche/livraison, etc.)
export async function apiRequestWithOffline(method: string, url: string, data?: any) {
  // Si on sait déjà qu'on est hors-ligne, on ne perd pas de temps à essayer.
  if (!navigator.onLine) {
    await addToOfflineQueue({ method, url, data, timestamp: Date.now() });
    const err: any = new Error('OFFLINE_QUEUED');
    err.offlineQueued = true;
    throw err;
  }
  try {
    return await api.request({ method, url, data });
  } catch (err: any) {
    if (isNetworkError(err)) {
      await addToOfflineQueue({ method, url, data, timestamp: Date.now() });
      const queuedErr: any = new Error('OFFLINE_QUEUED');
      queuedErr.offlineQueued = true;
      throw queuedErr;
    }
    // Erreur "normale" du serveur (validation, 401, 500…) : on la laisse remonter telle quelle.
    throw err;
  }
}

export async function syncOfflineQueue() {
  const queue = await getOfflineQueue();
  if (!queue.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  for (const item of queue) {
    try {
      await api.request({ method: item.method, url: item.url, data: item.data });
      synced++;
    } catch (e) {
      failed++;
      console.error('Sync failed for', item, e);
    }
  }
  // On vide la queue après une tentative complète : les éléments synchronisés
  // ne doivent pas être rejoués, et ceux qui ont échoué pour une raison métier
  // (ex: ressource supprimée depuis) ne doivent pas bloquer indéfiniment la queue.
  await clearOfflineQueue();
  return { synced, failed };
}

export async function getOfflineQueueCount() {
  const queue = await getOfflineQueue();
  return queue.length;
}

export default api;
