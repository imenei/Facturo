import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  addToOfflineQueue,
  getApiCache,
  getAllApiCache,
  getOfflineQueue,
  putApiCache,
  removeOfflineQueueItem,
} from './offlineDB';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.helpdz.com/api';

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

// Écritures autorisées hors ligne
const QUEUEABLE = [
  /^\/tasks(\/|$)/,
  /^\/interventions(\/|$)/,
  /^\/invoices(\/|$)/,
  /^\/clients(\/|$)/,
  /^\/products(\/|$)/,
];
const NEVER_QUEUE = [/send-reminder/, /deletion-requests/, /\/forever/, /\/auth\//];
// Jamais mis en cache IndexedDB
const NEVER_CACHE = [/^\/auth\//];
// /auth/me : copie locale (localStorage) pour rester connecté offline
const ME_CACHE_KEY = 'helpdz_me_cache';
const isMePath = (p: string) => /^\/auth\/me\/?$/.test(p);

const isBrowser = () => typeof window !== 'undefined';

function isNetworkError(err: AxiosError) {
  return !err.response && (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || (isBrowser() && !navigator.onLine));
}

function currentUserId(): string {
  try {
    const token = localStorage.getItem('helpdz_token');
    if (!token) return 'anon';
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return String(payload.sub || payload.id || 'anon');
  } catch {
    return 'anon';
  }
}

function normalizePath(url = '') {
  return url.replace(API_URL, '').split('?')[0];
}

function cacheKey(config: InternalAxiosRequestConfig) {
  const [path, qs = ''] = (config.url || '').replace(API_URL, '').split('?');
  const params = new URLSearchParams(qs);
  const extra = config.params || {};
  Object.keys(extra).forEach((k) => params.set(k, String(extra[k])));
  params.delete('_');
  params.sort();
  return `${currentUserId()}|${path}?${params.toString()}`;
}

function fakeResponse(config: InternalAxiosRequestConfig, data: any, status = 200): AxiosResponse {
  return { data, status, statusText: 'OFFLINE', headers: {}, config, request: {} } as AxiosResponse;
}

async function applyOptimistic(method: string, path: string, body: any, tempId: string) {
  const parts = path.split('/').filter(Boolean);
  const collection = parts[0];
  const itemId = parts[1];
  const uid = currentUserId();
  const entries = await getAllApiCache();
  for (const e of entries) {
    if (!e.key.startsWith(uid + '|/' + collection)) continue;
    const entryPath = e.key.slice(uid.length + 1).split('?')[0].split('/').filter(Boolean);
    const patch = { ...(body && typeof body === 'object' ? body : {}), _pendingSync: true };
    let data = e.data;
    const patchItem = (it: any) => (it && String(it.id) === String(itemId) ? { ...it, ...patch } : it);

    if (method === 'post' && parts.length === 1 && entryPath.length === 1) {
      const item = { ...patch, id: tempId, createdAt: new Date().toISOString() };
      if (Array.isArray(data)) data = [item, ...data];
      else if (data && Array.isArray(data.data)) data = { ...data, data: [item, ...data.data] };
      else continue;
    } else if (method !== 'post' && itemId) {
      if (Array.isArray(data)) data = data.map(patchItem);
      else if (data && Array.isArray(data.data)) data = { ...data, data: data.data.map(patchItem) };
      else if (entryPath.length === 2 && entryPath[1] === String(itemId) && data) data = { ...data, ...patch };
      else continue;
    } else continue;
    await putApiCache(e.key, data);
  }
}

api.interceptors.request.use((config) => {
  if (isBrowser()) {
    const token = localStorage.getItem('helpdz_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  async (res) => {
    if (isBrowser() && (res.config.method || 'get') === 'get' && res.status === 200) {
      const path = normalizePath(res.config.url);

      // Copie locale de /auth/me (même format que le backend)
      if (isMePath(path)) {
        try { localStorage.setItem(ME_CACHE_KEY, JSON.stringify(res.data)); } catch { /* ignore */ }
      }

      const isJson = !res.config.responseType || res.config.responseType === 'json';
      if (isJson && !NEVER_CACHE.some((r) => r.test(path))) {
        try { await putApiCache(cacheKey(res.config), res.data); } catch { /* quota / privé */ }
      }
    }
    return res;
  },
  async (err: AxiosError) => {
    const config = err.config as InternalAxiosRequestConfig | undefined;

    // --- Pas de réseau ---
    if (isBrowser() && config && isNetworkError(err)) {
      const method = (config.method || 'get').toLowerCase();
      const path = normalizePath(config.url);

      if (method === 'get') {
        // Offline : /auth/me servi depuis la copie locale -> pas de déconnexion
        if (isMePath(path) && localStorage.getItem('helpdz_token')) {
          try {
            const raw = localStorage.getItem(ME_CACHE_KEY);
            if (raw) return fakeResponse(config, JSON.parse(raw));
            const user = localStorage.getItem('helpdz_user');
            if (user) return fakeResponse(config, JSON.parse(user));
          } catch { /* ignore */ }
        }
        const hit = await getApiCache(cacheKey(config)).catch(() => undefined);
        if (hit) return fakeResponse(config, hit.data);
      } else if (
        QUEUEABLE.some((r) => r.test(path)) &&
        !NEVER_QUEUE.some((r) => r.test(path)) &&
        !(config as any)._offlineReplay
      ) {
        let body: any = config.data;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch { /* garde tel quel */ } }
        const ts = Date.now();
        const tempId = `offline-${ts}`;
        await addToOfflineQueue({ method, url: path, data: body, params: config.params, timestamp: ts });
        await applyOptimistic(method, path, body, tempId).catch(() => {});
        window.dispatchEvent(new Event('helpdz:queue-changed'));
        const base = body && typeof body === 'object' ? body : {};
        return fakeResponse(config, { ...base, id: base.id ?? tempId, _pendingSync: true, _offline: true }, 202);
      }
    }

    // --- Session expirée (uniquement une vraie réponse 401) ---
    if (err.response?.status === 401 && isBrowser() && !(config as any)?._offlineReplay) {
      localStorage.removeItem('helpdz_token');
      localStorage.removeItem('helpdz_user');
      localStorage.removeItem(ME_CACHE_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ---------------------------------------------------------------------------
// Rejeu de la file d'attente
// ---------------------------------------------------------------------------
export interface FlushResult { synced: number; failed: number; remaining: number }

let flushing = false;

export async function flushOfflineQueue(): Promise<FlushResult> {
  const result: FlushResult = { synced: 0, failed: 0, remaining: 0 };
  if (!isBrowser() || flushing || !navigator.onLine) return result;
  flushing = true;
  try {
    const queue = (await getOfflineQueue()).sort((a, b) => a.timestamp - b.timestamp);
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        await api.request({
          method: item.method as any,
          url: item.url,
          data: item.data,
          params: (item as any).params,
          headers: { 'X-Offline-Id': String(item.timestamp) },
          _offlineReplay: true,
        } as any);
        await removeOfflineQueueItem(item.key);
        result.synced++;
      } catch (e) {
        const er = e as AxiosError;
        if (!er.response) { result.remaining = queue.length - i; break; }
        if (er.response.status === 401) { result.remaining = queue.length - i; break; }
        await removeOfflineQueueItem(item.key);
        result.failed++;
      }
    }
  } finally {
    flushing = false;
    window.dispatchEvent(new Event('helpdz:queue-changed'));
  }
  return result;
}

export default api;
