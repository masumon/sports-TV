import type { Channel } from "@/lib/types";

const DB_NAME = "gstv-catalog";
const STORE = "channels";
const KEY = "catalog-v1";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h — IDB holds stale data longer; network refresh updates silently

type Payload = { t: number; items: Channel[] };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function getChannelCatalogFromIdb(): Promise<Channel[] | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.get(KEY);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const p = req.result as Payload | undefined;
        if (!p?.t || !Array.isArray(p.items)) {
          resolve(null);
          return;
        }
        if (Date.now() - p.t > TTL_MS) {
          resolve(null);
          return;
        }
        resolve(p.items);
      };
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

export async function setChannelCatalogToIdb(channels: Channel[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    const payload: Payload = { t: Date.now(), items: channels };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(payload, KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* quota / private mode */
  }
}

export async function clearChannelCatalogIdb(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* */
  }
}
