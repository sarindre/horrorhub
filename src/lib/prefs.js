import { readJSON, writeJSON } from "./storage.js";

// Per-viewer UI preferences (filters, page sizes...) in ONE versioned object
// instead of a separate localStorage key per checkbox.
//   { version: 1, values: { "discover.hideInLibrary": true, ... } }
// The first time a preference is read, an old-style "horrorhub.<name>" key is
// adopted (and left in place as a backup).
export const PREFS_KEY = "horrorhub.prefs.v1";
export const PREFS_VERSION = 1;

const readValues = () => {
  const stored = readJSON(PREFS_KEY);
  return stored && typeof stored.values === "object" && stored.values ? stored.values : {};
};

export function getPref(name, fallback) {
  const values = readValues();
  if (name in values) return values[name];
  const legacy = readJSON(`horrorhub.${name}`);
  return legacy === null ? fallback : legacy;
}

export function setPref(name, value) {
  return writeJSON(PREFS_KEY, { version: PREFS_VERSION, values: { ...readValues(), [name]: value } });
}
