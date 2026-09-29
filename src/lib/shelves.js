import { readJSON, writeJSON } from "./storage.js";
import { evaluateItem } from "./contentFlags.js";
import { titleKey } from "./library.js";
import { matchesMood } from "./moods.js";
import { buildTasteProfile, rankLibrary } from "./taste.js";

// Curation: shelves are named, ordered lists of films you make ("Halloween
// marathon", "Comfort horror"), and smart shelves are collections HorrorHub
// builds from your taste. No accounts or servers: shelves live in this browser
// and can be shared as a file or plain text.
//
// A shelf keeps a snapshot of each film (id, title, year, poster) rather than
// pointing into the library, so it still reads correctly if a film leaves your
// library, and an exported shelf makes sense on someone else's machine.

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_NAME = 60;
export const MAX_DESCRIPTION = 300;
export const MAX_SHELF_FILMS = 200;
const SMART_SIZE = 6;
const SMART_MIN = 2; // a shelf of one film isn't a shelf

const sameId = (a, b) => String(a) === String(b);
const validId = (id) => id !== undefined && id !== null && id !== "";
const isDate = (v) => typeof v === "string" && !Number.isNaN(new Date(v).getTime());

// ---------- films on a shelf ----------

export function snapshotFilm(film) {
  const year = Number(film.year);
  return {
    id: film.id,
    title: String(film.title || "").trim(),
    ...(Number.isFinite(year) && year > 0 ? { year } : {}),
    ...(film.poster ? { poster: film.poster } : {}),
  };
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object" || !validId(raw.id) || typeof raw.title !== "string" || !raw.title.trim()) return null;
  return snapshotFilm(raw);
}

// ---------- shelves ----------

export function normalizeShelf(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, MAX_NAME) : "";
  if (!name) return null;
  const seen = new Set();
  const films = [];
  for (const entry of Array.isArray(raw.films) ? raw.films : []) {
    const e = normalizeEntry(entry);
    if (!e || seen.has(String(e.id))) continue;
    seen.add(String(e.id));
    films.push(e);
    if (films.length >= MAX_SHELF_FILMS) break;
  }
  const now = new Date().toISOString();
  return {
    id: raw.id,
    name,
    description: typeof raw.description === "string" ? raw.description.trim().slice(0, MAX_DESCRIPTION) : "",
    films,
    createdAt: isDate(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isDate(raw.updatedAt) ? raw.updatedAt : isDate(raw.createdAt) ? raw.createdAt : now,
  };
}
export const normalizeShelves = (list) => (Array.isArray(list) ? list.map(normalizeShelf).filter(Boolean) : []);

// Returns null if there's no usable name.
export function createShelf({ name, description = "", films = [], now = new Date(), id } = {}) {
  const stamp = now.toISOString();
  return normalizeShelf({
    id: id || `s-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    description,
    films: films.map(snapshotFilm),
    createdAt: stamp,
    updatedAt: stamp,
  });
}

const touch = (shelf, patch, now) => ({ ...shelf, ...patch, updatedAt: (now || new Date()).toISOString() });

export const hasFilm = (shelf, id) => shelf.films.some((f) => sameId(f.id, id));
export const shelvesContaining = (shelves, id) => shelves.filter((s) => hasFilm(s, id)).map((s) => s.id);

export function addFilm(shelf, film, now) {
  if (hasFilm(shelf, film.id) || shelf.films.length >= MAX_SHELF_FILMS) return shelf;
  const entry = normalizeEntry(film);
  return entry ? touch(shelf, { films: [...shelf.films, entry] }, now) : shelf;
}

export function removeFilm(shelf, id, now) {
  return hasFilm(shelf, id) ? touch(shelf, { films: shelf.films.filter((f) => !sameId(f.id, id)) }, now) : shelf;
}

// Move a film up (delta -1) or down (+1); stops at the ends.
export function moveFilm(shelf, id, delta, now) {
  const from = shelf.films.findIndex((f) => sameId(f.id, id));
  const to = from + delta;
  if (from < 0 || to < 0 || to >= shelf.films.length) return shelf;
  const films = [...shelf.films];
  [films[from], films[to]] = [films[to], films[from]];
  return touch(shelf, { films }, now);
}

// Keeps the old value for a field that isn't given or would become empty (a shelf can't lose its name).
export function editShelf(shelf, { name, description } = {}, now) {
  const next = {};
  if (typeof name === "string" && name.trim()) next.name = name.trim().slice(0, MAX_NAME);
  if (typeof description === "string") next.description = description.trim().slice(0, MAX_DESCRIPTION);
  return touch(shelf, next, now);
}

// When an imported film is matched to TMDb its id changes; keep shelves pointing at it.
export function relinkShelves(shelves, oldId, movie) {
  return shelves.map((shelf) => {
    if (!hasFilm(shelf, oldId)) return shelf;
    const seen = new Set();
    const films = [];
    for (const f of shelf.films) {
      const entry = sameId(f.id, oldId) ? snapshotFilm({ ...f, ...movie }) : f;
      if (seen.has(String(entry.id))) continue; // the shelf already had the TMDb film
      seen.add(String(entry.id));
      films.push(entry);
    }
    return { ...shelf, films };
  });
}

// Add incoming shelves (an import) without replacing ones you already have.
export function mergeShelves(existing, incoming) {
  const result = normalizeShelves(existing);
  const ids = new Set(result.map((s) => s.id));
  let added = 0;
  for (const s of normalizeShelves(incoming)) {
    if (ids.has(s.id)) continue;
    result.push(s);
    ids.add(s.id);
    added++;
  }
  return { shelves: result, added };
}

// A shelf's entries joined with the matching library films (by id, else by title + year).
export function entriesWithItems(shelf, library) {
  const byId = new Map(library.map((i) => [String(i.id), i]));
  const byTitle = new Map(library.map((i) => [titleKey(i), i]));
  return shelf.films.map((entry) => ({ entry, item: byId.get(String(entry.id)) || byTitle.get(titleKey(entry)) || null }));
}

// ---------- sharing ----------

export function shelfExport(shelf, now = new Date()) {
  return { app: "horrorhub", type: "shelf", version: 1, exportedAt: now.toISOString(), shelf };
}

export function shelfToText(shelf) {
  const lines = [shelf.name];
  if (shelf.description) lines.push(shelf.description);
  lines.push("");
  shelf.films.forEach((f, i) => lines.push(`${i + 1}. ${f.title}${f.year ? ` (${f.year})` : ""}`));
  lines.push("", "Made with HorrorHub");
  return lines.join("\n");
}

// Shelves from a parsed JSON file: a single-shelf export, a full backup with
// `shelves`, or a bare shelf. Anything unusable is counted and dropped.
export function parseShelfPayload(payload) {
  const raw = Array.isArray(payload?.shelves) ? payload.shelves : payload?.shelf ? [payload.shelf] : payload?.films && payload?.name ? [payload] : [];
  const shelves = normalizeShelves(raw);
  return { shelves, skipped: raw.length - shelves.length };
}

// ---------- smart shelves ----------

// Collections built from your library and taste; recomputed, never stored. Films
// over your content limits are left out, and a shelf needs at least two films.
//   [{ id, title, blurb, films: [{ item, reasons }] }]
export function smartShelves(library, { profile, prefs = {}, now = new Date() } = {}) {
  const p = profile || buildTasteProfile(library, { now: now.getTime() });
  const allowed = library.filter((i) => !evaluateItem(i, prefs).blocked);
  const watched = (i) => (i.watchedDates || []).length > 0;
  const lastWatch = (i) => Math.max(0, ...(i.watchedDates || []).map((d) => new Date(d).getTime() || 0));
  const shelves = [];
  const add = (shelf) => shelf.films.length >= SMART_MIN && shelves.push(shelf);

  // 1. what to watch next, in the mood you love most
  const mood = p.lovedMoods[0];
  if (mood) {
    const scare = p.scarePref != null ? Math.round(p.scarePref) : 5;
    const picks = rankLibrary(allowed, p, { moodId: mood.id, scare }, { limit: 24, now: now.getTime() })
      .filter((r) => !watched(r.item) && matchesMood(r.item.tags, mood.id))
      .slice(0, SMART_SIZE);
    add({ id: `next-${mood.id}`, title: `Top picks for your ${mood.label} mood`, blurb: `Unwatched films in your library that fit what you love most`, films: picks.map((r) => ({ item: r.item, reasons: r.reasons })) });
  }

  // 2. your best of each subgenre you clearly love
  for (const m of p.moods.filter((x) => x.score > 0.15 && x.count >= 3).slice(0, 3)) {
    const best = allowed
      .filter((i) => watched(i) && (i.rating || 0) >= 4 && matchesMood(i.tags, m.id))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0) || lastWatch(b) - lastWatch(a))
      .slice(0, SMART_SIZE);
    add({ id: `best-${m.id}`, title: `Your best ${m.label}`, blurb: `Your highest-rated ${m.label.toLowerCase()} films`, films: best.map((item) => ({ item, reasons: [`Rated ${item.rating}★`] })) });
  }

  // 3. favorites you haven't seen in a while
  const yearAgo = now.getTime() - 365 * DAY_MS;
  const rewatch = allowed
    .filter((i) => watched(i) && (i.rating || 0) >= 4.5 && lastWatch(i) <= yearAgo)
    .sort((a, b) => lastWatch(a) - lastWatch(b))
    .slice(0, SMART_SIZE);
  add({
    id: "rewatch",
    title: "Time for a rewatch",
    blurb: "Favorites you haven't seen in over a year",
    films: rewatch.map((item) => {
      const years = Math.floor((now.getTime() - lastWatch(item)) / (365 * DAY_MS));
      return { item, reasons: [`Last watched ${years === 1 ? "a year" : `${years} years`} ago`] };
    }),
  });

  return shelves;
}

// ---------- persistence ----------
// { version: 1, items: [...] } under "horrorhub.shelves.v1"

export const SHELVES_KEY = "horrorhub.shelves.v1";
export const SHELVES_VERSION = 1;
export const loadShelves = () => normalizeShelves(readJSON(SHELVES_KEY)?.items);
export const saveShelves = (list) => writeJSON(SHELVES_KEY, { version: SHELVES_VERSION, items: list });
