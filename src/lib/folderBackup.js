import { LATEST_BACKUP_NAME, KEEP_DATED_BACKUPS, datedBackupName, datedBackupsToDelete } from "./backup.js";

// Automatic backups to a folder you choose, using the File System Access API
// (Chrome, Edge and other Chromium browsers; Firefox and Safari don't have it).
// The chosen folder's handle is remembered in IndexedDB between visits. The
// browser may ask you to allow access again after a restart; that can only
// happen from a click, so the app shows a "Reconnect" button rather than
// failing quietly.

export const supportsFolderBackup = () => typeof window !== "undefined" && typeof window.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";

// ---- remembering the folder ----

const DB_NAME = "horrorhub";
const STORE = "handles";
const KEY = "backup-folder";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function withStore(mode, run) {
  const db = await openDb();
  try {
    return await run(db.transaction(STORE, mode).objectStore(STORE));
  } finally {
    db.close?.();
  }
}

export const saveHandle = (handle) => withStore("readwrite", (store) => request(store.put(handle, KEY)));
export const clearHandle = () => withStore("readwrite", (store) => request(store.delete(KEY)));
export async function loadHandle() {
  try {
    return (await withStore("readonly", (store) => request(store.get(KEY)))) || null;
  } catch {
    return null; // private mode or blocked storage: behave as "no folder chosen"
  }
}

// ---- permission ----

// "granted" | "prompt" | "denied". With { ask: true } (only from a click) the
// browser may show its permission prompt.
export async function folderPermission(handle, { ask = false } = {}) {
  const options = { mode: "readwrite" };
  try {
    let state = await handle.queryPermission(options);
    if (state !== "granted" && ask) state = await handle.requestPermission(options);
    return state;
  } catch {
    return "denied";
  }
}

// ---- writing ----

async function writeFile(dir, name, text) {
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  try {
    await writable.write(text);
  } finally {
    await writable.close();
  }
}

// Writes the latest copy plus one copy per day, and removes dated copies past
// the newest `keep`. Only files named like ours are ever deleted.
export async function writeFolderBackup(dir, text, { now = new Date(), keep = KEEP_DATED_BACKUPS } = {}) {
  await writeFile(dir, LATEST_BACKUP_NAME, text);
  await writeFile(dir, datedBackupName(now), text);
  const names = [];
  for await (const entry of dir.values()) if (entry.kind === "file") names.push(entry.name);
  for (const name of datedBackupsToDelete(names, keep)) {
    try {
      await dir.removeEntry(name);
    } catch {
      /* already gone, or not allowed: a stray old copy is harmless */
    }
  }
}
