import { clearHandle } from "./folderBackup.js";
import { emptyCalibration } from "./calibration.js";
import { loadSettings, saveSettings } from "./settings.js";

// Reset app: erase everything HorrorHub keeps in this browser. Everything it
// stores is under one prefix ("horrorhub."), so nothing is missed, including the
// old-version copies it normally leaves behind as backups. Files in a backup
// folder are never touched: they are yours.

export const APP_PREFIX = "horrorhub.";
export const POSTER_CACHE = "horrorhub-posters-v1";
export const CONFIRM_WORD = "RESET";

// The storage keys that belong to the app.
export function appKeys(storage = localStorage) {
  const keys = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(APP_PREFIX)) keys.push(key);
  }
  return keys;
}

// Removes the app's data from `storage`. With keepSettings, your settings and API
// keys survive, but the taste quiz answers (your taste, not a preference) do not.
// Returns how many keys were removed.
export function clearAppStorage({ keepSettings = false, storage = localStorage } = {}) {
  const kept = keepSettings ? { ...loadSettings(), calibration: emptyCalibration() } : null;
  const keys = appKeys(storage);
  keys.forEach((k) => storage.removeItem(k));
  if (kept) saveSettings(kept);
  return keys.length;
}

// Everything: stored data, the remembered backup folder, the saved poster images,
// then a reload so the app starts clean from memory too.
export async function resetApp({ keepSettings = false, reload = () => window.location.assign(window.location.pathname) } = {}) {
  const removed = clearAppStorage({ keepSettings });
  await clearHandle().catch(() => {});
  try {
    await globalThis.caches?.delete(POSTER_CACHE);
  } catch {
    /* no cache storage: nothing to clear */
  }
  reload();
  return { removed };
}
