import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface HelpDZDB extends DBSchema {
  offlineQueue: {
    key: number;
    value: { method: string; url: string; data: any; timestamp: number };
  };
  invoices: { key: string; value: any };
  tasks: { key: string; value: any };
  company: { key: string; value: any };
}

let db: IDBPDatabase<HelpDZDB> | null = null;

async function getDB() {
  if (db) return db;
  db = await openDB<HelpDZDB>('helpdz-offline', 1, {
    upgrade(database) {
      database.createObjectStore('offlineQueue', { autoIncrement: true });
      database.createObjectStore('invoices', { keyPath: 'id' });
      database.createObjectStore('tasks', { keyPath: 'id' });
      database.createObjectStore('company', { keyPath: 'id' });
    },
  });
  return db;
}

export async function addToOfflineQueue(item: { method: string; url: string; data: any; timestamp: number }) {
  const database = await getDB();
  await database.add('offlineQueue', item);
}

export async function getOfflineQueue() {
  const database = await getDB();
  const keys = await database.getAllKeys('offlineQueue');
  const values = await database.getAll('offlineQueue');
  return values.map((value, i) => ({ key: keys[i] as number, ...value }));
}

export async function removeOfflineQueueItem(key: number) {
  const database = await getDB();
  await database.delete('offlineQueue', key);
}

export async function clearOfflineQueue() {
  const database = await getDB();
  await database.clear('offlineQueue');
}

export async function cacheInvoices(invoices: any[]) {
  const database = await getDB();
  const pending = (await database.getAll('invoices')).filter((i) => i._pendingSync);
  const tx = database.transaction('invoices', 'readwrite');
  await Promise.all([...pending, ...invoices].map((inv) => tx.store.put(inv)));
  await tx.done;
}

export async function getCachedInvoices() {
  const database = await getDB();
  return database.getAll('invoices');
}

export async function addCachedInvoice(invoice: any) {
  const database = await getDB();
  await database.put('invoices', invoice);
}

export async function removeCachedInvoice(id: string) {
  const database = await getDB();
  await database.delete('invoices', id);
}

export async function cacheTasks(tasks: any[], userId?: string) {
  const database = await getDB();
  const all = await database.getAll('tasks');
  const pending = all.filter((t) => t._pendingSync);
  const tx = database.transaction('tasks', 'readwrite');
  for (const t of all) {
    if (!t._pendingSync) await tx.store.delete(t.id);
  }
  const toStore = [...pending, ...tasks].map((t) => ({
    ...t,
    _cachedForUserId: userId || t._cachedForUserId,
  }));
  await Promise.all(toStore.map((t) => tx.store.put(t)));
  await tx.done;
}

export async function getCachedTasks(userId?: string) {
  const database = await getDB();
  const all = await database.getAll('tasks');
  if (!userId) return all;
  return all.filter((t) => {
    const assigneeId = t.assignedToId || t.assignedTo?.id;
    return t._pendingSync || (assigneeId && String(assigneeId) === String(userId));
  });
}

export async function addCachedTask(task: any) {
  const database = await getDB();
  await database.put('tasks', task);
}

export async function updateCachedTask(id: string, patch: Record<string, any>) {
  const database = await getDB();
  const existing = await database.get('tasks', id);
  if (existing) {
    await database.put('tasks', { ...existing, ...patch });
  }
}

export async function removeCachedTask(id: string) {
  const database = await getDB();
  await database.delete('tasks', id);
}

export async function clearTasksCache() {
  const database = await getDB();
  await database.clear('tasks');
}

export async function cacheCompany(company: any) {
  const database = await getDB();
  await database.put('company', company);
}

export async function getCachedCompany() {
  const database = await getDB();
  const all = await database.getAll('company');
  return all[0] || null;
}
