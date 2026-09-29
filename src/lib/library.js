import { readJSON, writeJSON } from "./storage.js";

// Library schema versions
//   v2 (legacy): bare array of items under "horrorhub.library.v2"
//   v3: { version: 3, items: [...] } under "horrorhub.library.v3"
// The v2 key is left untouched after migrating so it doubles as a backup.
export const LIBRARY_VERSION = 3;
export const LIBRARY_KEY = "horrorhub.library.v3";
export const LEGACY_LIBRARY_KEY = "horrorhub.library.v2";
const CORRUPT_BACKUP_KEY = "horrorhub.library.corrupt";

export const DEFAULT_SCARES = 5;

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const isValidDate = (v) => typeof v === "string" && !Number.isNaN(new Date(v).getTime());

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const out = [];
  for (const t of tags) {
    const v = String(t ?? "").trim().toLowerCase();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

// Drops junk and exact duplicates only; a deliberate same-day rewatch is kept.
function normalizeWatchedDates(dates) {
  if (!Array.isArray(dates)) return [];
  return [...new Set(dates.filter(isValidDate))];
}

// Import-only: the same viewing shows up as different timestamps across
// sources, so imports collapse to one watch per calendar day (first wins).
function dedupeByDay(dates) {
  const seen = new Set();
  return dates.filter((d) => {
    const day = d.slice(0, 10);
    if (seen.has(day)) return false;
    seen.add(day);
    return true;
  });
}

// Coerces anything item-shaped into the canonical item, or null if it has no
// usable id/title. Unknown fields (jumpScares, goreCount, ...) pass through.
export function normalizeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id;
  if (id === undefined || id === null || id === "") return null;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return null;

  const year = Number(raw.year);
  const rating = Number(raw.rating);
  const scares = Number(raw.scares);

  return {
    ...raw,
    id,
    title,
    year: Number.isFinite(year) && year > 0 ? year : undefined,
    rating: Number.isFinite(rating) ? clamp(Math.round(rating * 2) / 2, 0, 5) : 0,
    scares: Number.isFinite(scares) ? clamp(Math.round(scares), 0, 10) : DEFAULT_SCARES,
    tags: normalizeTags(raw.tags),
    watchedDates: normalizeWatchedDates(raw.watchedDates),
    watchlist: !!raw.watchlist,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    addedAt: isValidDate(raw.addedAt) ? raw.addedAt : new Date().toISOString(),
  };
}

export function normalizeLibrary(items) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeItem).filter(Boolean);
}

const normTitle = (title) => String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export const titleKey = (item) => `${normTitle(item.title)}|${item.year || ""}`;

// Recognize films you already have even when the ids differ (a Letterboxd/IMDb
// import has string ids, TMDb has numbers). A library entry without a year
// matches on title alone.
export function ownedTitleKeys(items) {
  const keys = new Set();
  for (const item of items || []) {
    keys.add(titleKey(item));
    if (!item.year) keys.add(`${normTitle(item.title)}|`);
  }
  return keys;
}
export const isOwnedTitle = (keys, candidate) => keys.has(titleKey(candidate)) || keys.has(`${normTitle(candidate.title)}|`);

// An unrated import row must not wipe an existing rating; other zeroes (e.g. scares 0) are real values.
const isEmpty = (field, v) =>
  v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (field === "rating" && v === 0);

// Accepts a raw parsed import (bare array, or { items } from an export) and
// returns the usable items plus a count of rows that had to be dropped.
export function validateImport(payload) {
  const list = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : null;
  if (!list) return { error: "This file isn't a HorrorHub export (expected a list of movies).", items: [], skipped: 0 };
  const items = list.filter((i) => i && typeof i === "object" && i.id !== undefined && i.id !== null && i.id !== "" && typeof i.title === "string" && i.title.trim());
  if (!items.length) return { error: "No importable movies found in this file.", items: [], skipped: list.length };
  return { items, skipped: list.length - items.length };
}

// Merges incoming items into the existing library without ever deleting data.
//  - matches on id first, then on normalized title + year (so a Letterboxd row
//    lands on the TMDb entry you already have)
//  - non-empty incoming values win; empty ones never overwrite what you have
//  - tags and watch dates are unioned
export function mergeLibraries(existing, incoming) {
  const result = normalizeLibrary(existing);
  const byId = new Map(result.map((it, idx) => [String(it.id), idx]));
  const byTitle = new Map(result.map((it, idx) => [titleKey(it), idx]));
  let added = 0;
  let updated = 0;

  for (const raw of incoming) {
    const key = titleKey(raw);
    const idx = byId.has(String(raw.id)) ? byId.get(String(raw.id)) : byTitle.get(key);
    if (idx === undefined) {
      const fresh = normalizeItem(raw);
      if (!fresh) continue;
      result.push(fresh);
      byId.set(String(fresh.id), result.length - 1);
      byTitle.set(titleKey(fresh), result.length - 1);
      added++;
      continue;
    }
    const current = result[idx];
    const merged = { ...current };
    for (const [field, value] of Object.entries(raw)) {
      if (field === "id" || field === "addedAt" || field === "tags" || field === "watchedDates" || isEmpty(field, value)) continue;
      merged[field] = value;
    }
    merged.tags = [...(current.tags || []), ...(Array.isArray(raw.tags) ? raw.tags : [])];
    merged.watchedDates = dedupeByDay(
      normalizeWatchedDates([...(current.watchedDates || []), ...(Array.isArray(raw.watchedDates) ? raw.watchedDates : [])]).sort()
    );
    result[idx] = normalizeItem(merged);
    updated++;
  }
  return { items: result, added, updated };
}

export function loadLibrary() {
  const stored = readJSON(LIBRARY_KEY);
  if (stored && Array.isArray(stored.items)) return normalizeLibrary(stored.items);

  // v3 key exists but couldn't be read: keep the raw text so it isn't lost
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw !== null) localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
  } catch {
    // storage unavailable; nothing more we can do
  }

  const legacy = readJSON(LEGACY_LIBRARY_KEY);
  if (Array.isArray(legacy)) {
    const items = normalizeLibrary(legacy);
    saveLibrary(items);
    return items;
  }
  return [];
}

// Returns false if the browser refused the write (quota, blocked storage).
export function saveLibrary(items) {
  return writeJSON(LIBRARY_KEY, { version: LIBRARY_VERSION, items });
}

export function buildExport(items) {
  return { app: "horrorhub", version: LIBRARY_VERSION, exportedAt: new Date().toISOString(), items };
}
