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

export async function cacheTasks(tasks: any[]) {
  const database = await getDB();
  const pending = (await database.getAll('tasks')).filter((t) => t._pendingSync);
  const tx = database.transaction('tasks', 'readwrite');
  await Promise.all([...pending, ...tasks].map((t) => tx.store.put(t)));
  await tx.done;
}

export async function getCachedTasks() {
  const database = await getDB();
  return database.getAll('tasks');
}

export async function addCachedTask(task: any) {
  const database = await getDB();
  await database.put('tasks', task);
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
