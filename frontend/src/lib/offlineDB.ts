import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface FacturoDB extends DBSchema {
  offlineQueue: {
    key: number;
    value: { method: string; url: string; data: any; timestamp: number };
  };
  invoices: { key: string; value: any };
  tasks: { key: string; value: any };
  company: { key: string; value: any };
}

let db: IDBPDatabase<FacturoDB> | null = null;

async function getDB() {
  if (db) return db;
  db = await openDB<FacturoDB>('facturo-offline', 1, {
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
  return database.getAll('offlineQueue');
}

export async function clearOfflineQueue() {
  const database = await getDB();
  await database.clear('offlineQueue');
}

export async function cacheInvoices(invoices: any[]) {
  const database = await getDB();
  const tx = database.transaction('invoices', 'readwrite');
  await Promise.all(invoices.map((inv) => tx.store.put(inv)));
  await tx.done;
}

export async function getCachedInvoices() {
  const database = await getDB();
  return database.getAll('invoices');
}

export async function cacheTasks(tasks: any[]) {
  const database = await getDB();
  const tx = database.transaction('tasks', 'readwrite');
  await Promise.all(tasks.map((t) => tx.store.put(t)));
  await tx.done;
}

export async function getCachedTasks() {
  const database = await getDB();
  return database.getAll('tasks');
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
