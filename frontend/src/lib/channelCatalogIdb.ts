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

function readIdbPayload(allowStale: boolean): Promise<Channel[] | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return openDb()
    .then(
      (db) =>
        new Promise<Channel[] | null>((resolve, reject) => {
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).get(KEY);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const p = req.result as Payload | undefined;
            if (!p?.t || !Array.isArray(p.items)) {
              resolve(null);
              return;
            }
            if (!allowStale && Date.now() - p.t > TTL_MS) {
              resolve(null);
              return;
            }
            resolve(p.items);
          };
          tx.oncomplete = () => db.close();
        }),
    )
    .catch(() => null);
}

export async function getChannelCatalogFromIdb(): Promise<Channel[] | null> {
  return readIdbPayload(false);
}

/** Returns cached catalog even past TTL — for instant display on app open. */
export async function getStaleChannelCatalogFromIdb(): Promise<Channel[] | null> {
  return readIdbPayload(true);
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
