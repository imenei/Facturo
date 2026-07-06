import axios from 'axios';
import { getOfflineQueue, addToOfflineQueue, removeOfflineQueueItem, getCachedInvoices, removeCachedInvoice, getCachedTasks, removeCachedTask, updateCachedTask } from './offlineDB';

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
  const queueOffline = async () => {
    await addToOfflineQueue({ method, url, data, timestamp: Date.now() });
    return { data: { _offline: true }, status: 202, statusText: 'Queued', headers: {}, config: {} as any };
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return queueOffline();
  }

  try {
    return await api.request({ method, url, data });
  } catch (err: any) {
    if (!err.response) return queueOffline();
    throw err;
  }
}

function applyTaskPatch(task: any, method: string, url: string, data?: any): Record<string, any> {
  if (method === 'DELETE') return { _deleted: true };
  if (url.endsWith('/start-delivery')) {
    return { startedDeliveryAt: new Date().toISOString(), finishedDeliveryAt: null, deliveryDurationMinutes: null };
  }
  if (url.endsWith('/finish-delivery')) {
    const started = task.startedDeliveryAt ? new Date(task.startedDeliveryAt).getTime() : Date.now();
    const finished = new Date();
    return {
      finishedDeliveryAt: finished.toISOString(),
      deliveryDurationMinutes: Math.round((finished.getTime() - started) / 60000),
      status: 'terminee',
      completedAt: finished.toISOString(),
    };
  }
  if (data?.cancelDelivery) {
    return { startedDeliveryAt: null, finishedDeliveryAt: null, deliveryDurationMinutes: null };
  }
  return data || {};
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
      if ((item.method === 'PUT' || item.method === 'PATCH' || item.method === 'DELETE') && item.url.startsWith('/tasks/')) {
        const taskId = item.url.split('/')[2]?.split('?')[0];
        if (taskId && item.method === 'DELETE') await removeCachedTask(taskId);
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

/** Mutation tâche avec mise à jour optimiste du cache local si hors-ligne */
export async function mutateTaskOffline(
  method: 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  taskId: string,
  data?: any,
) {
  const res = await apiRequestWithOffline(method, url, data);
  if (res.data?._offline) {
    const cached = (await getCachedTasks()).find((t) => t.id === taskId);
    if (cached) {
      const patch = applyTaskPatch(cached, method, url, data);
      if (patch._deleted) {
        await removeCachedTask(taskId);
      } else {
        await updateCachedTask(taskId, patch);
      }
    }
    return { offline: true as const };
  }
  return { offline: false as const };
}

export default api;
