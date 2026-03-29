import axios from 'axios';
import { getOfflineQueue, addToOfflineQueue } from './offlineDB';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

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

// Offline-aware POST/PUT/PATCH
export async function apiRequestWithOffline(method: string, url: string, data?: any) {
  if (!navigator.onLine) {
    await addToOfflineQueue({ method, url, data, timestamp: Date.now() });
    throw new Error('OFFLINE_QUEUED');
  }
  return api.request({ method, url, data });
}

export async function syncOfflineQueue() {
  const queue = await getOfflineQueue();
  for (const item of queue) {
    try {
      await api.request({ method: item.method, url: item.url, data: item.data });
    } catch (e) {
      console.error('Sync failed for', item);
    }
  }
}

export default api;
