import axios from 'axios';
import { getOfflineQueue, addToOfflineQueue, removeOfflineQueueItem, getCachedInvoices, removeCachedInvoice, getCachedTasks, removeCachedTask } from './offlineDB';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.helpdz.com/api';

const api = axios.create({ baseURL: API_URL, timeout: 10000 });

// Inject token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('helpdz_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('helpdz_token');
      localStorage.removeItem('helpdz_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// Offline-aware POST/PUT/PATCH/DELETE
export async function apiRequestWithOffline(method: string, url: string, data?: any) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await addToOfflineQueue({ method, url, data, timestamp: Date.now() });
    return { data: { _offline: true }, status: 202, statusText: 'Queued', headers: {}, config: {} as any };
  }
  return api.request({ method, url, data });
}

export async function syncOfflineQueue() {
  const queue = await getOfflineQueue();
  let synced = 0;
  for (const item of queue) {
    try {
      await api.request({ method: item.method, url: item.url, data: item.data });
      await removeOfflineQueueItem(item.key);
      if (item.method === 'POST' && item.url === '/invoices') {
        const pending = (await getCachedInvoices()).filter((i) => i._pendingSync)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        if (pending[0]) await removeCachedInvoice(pending[0].id);
      }
      if (item.method === 'POST' && item.url === '/tasks') {
        const pending = (await getCachedTasks()).filter((t) => t._pendingSync)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        if (pending[0]) await removeCachedTask(pending[0].id);
      }
      synced++;
    } catch (e) {
      console.error('Sync failed for', item);
    }
  }
  if (synced > 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offline-synced'));
  }
  return synced;
}

export default api;
