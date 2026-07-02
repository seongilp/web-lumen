// Persist picker directory handles in IndexedDB so real (on-disk) file deletion
// survives a reload. FileSystemDirectoryHandle is structured-cloneable, so we
// can store it directly. Permission still has to be re-granted via a user
// gesture after reload (handled at delete time).

const DB_NAME = "web-lumen";
const STORE = "roots";

function supported(): boolean {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = run(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/** Save a picker root directory handle, keyed by its name. */
export async function putRoot(handle: FileSystemDirectoryHandle): Promise<void> {
  if (!supported()) return;
  try {
    await tx("readwrite", (s) => s.put(handle, handle.name));
  } catch {
    /* best-effort */
  }
}

/** Load all saved root handles. */
export async function getRoots(): Promise<FileSystemDirectoryHandle[]> {
  if (!supported()) return [];
  try {
    const all = await tx<FileSystemDirectoryHandle[]>("readonly", (s) => s.getAll());
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

export async function clearRoots(): Promise<void> {
  if (!supported()) return;
  try {
    await tx("readwrite", (s) => s.clear());
  } catch {
    /* ignore */
  }
}
