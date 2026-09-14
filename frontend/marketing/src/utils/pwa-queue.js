const DB_NAME = 'globyedu_pwa_db';
const DB_VERSION = 1;
const STORE_NAME = 'offlineQueue';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('signature', 'signature', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = callback(store);

    tx.oncomplete = () => resolve(request?.result);
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

export async function addOfflineQueueEntry(entry) {
  const id = entry.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const payload = { ...entry, id, timestamp: entry.timestamp || Date.now() };
  await transaction('readwrite', (store) => store.add(payload));
  return payload;
}

export async function getOfflineQueueEntries() {
  return transaction('readonly', (store) => store.getAll());
}

export async function removeOfflineQueueEntry(id) {
  return transaction('readwrite', (store) => store.delete(id));
}

export async function clearOfflineQueue() {
  return transaction('readwrite', (store) => store.clear());
}

export async function findOfflineQueueEntry(signature) {
  return transaction('readonly', (store) => {
    const index = store.index('signature');
    return index.get(signature);
  });
}

export function makeOfflineQueueSignature(method, url, body) {
  const normalizedBody = body && typeof body === 'object' ? JSON.stringify(body) : String(body || '');
  return `${method.toUpperCase()}::${url}::${normalizedBody}`;
}
