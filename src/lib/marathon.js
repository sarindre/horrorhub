import { readJSON, writeJSON } from "./storage.js";
import { evaluateItem } from "./contentFlags.js";
import { matchesClause } from "./challenges.js";
import { MOOD_PRESETS } from "./moods.js";
import { buildTasteProfile, scoreLibraryItem } from "./taste.js";
import { scareOf } from "./scare.js";

// Marathon planner: pick a lineup of films for one night that fits a theme, a
// time budget and your limits, then order it so the scare level flows the way
// you want (build up, peak then wind down, or ebb and flow). Pure functions;
// only the load/save helpers at the bottom touch storage.

export const BREAK_MINUTES = 15;
export const DEFAULT_RUNTIME = 100; // used when a film's runtime isn't known yet
export const FLOW_SHAPES = {
  ramp: { label: "Build up", blurb: "Starts gentle and gets scarier all night" },
  peak: { label: "Peak, then wind down", blurb: "Builds to the scariest film near the end, then eases off" },
  wave: { label: "Ebb and flow", blurb: "Alternates lighter and heavier films so you don't wear out" },
};

export const runtimeOf = (film) => (film.runtime > 0 ? film.runtime : DEFAULT_RUNTIME);
export const totalMinutes = (films) => films.reduce((sum, f) => sum + runtimeOf(f), 0) + BREAK_MINUTES * Math.max(0, films.length - 1);

// ---------- themes ----------
// A theme is { id, label, match: [clause...] } using the same clauses as
// challenges (tagsAny, keywordsAny, yearMax, runtimeMax...). No match = anything.

export const ANY_THEME = { id: "any", label: "Anything", match: [] };

export function themeFromMood(moodId) {
  const preset = MOOD_PRESETS.find((p) => p.id === moodId);
  return preset && preset.id !== "all" ? { id: `mood:${preset.id}`, label: preset.label, match: [{ tagsAny: preset.tags }] } : ANY_THEME;
}

// Themes that suit the calendar (shown as quick picks).
export function seasonalThemes(now = new Date()) {
  const m = now.getMonth();
  const themes = [];
  if (m === 8 || m === 9) themes.push({ id: "season:halloween", label: "Halloween night", match: [{ tagsAny: ["occult", "haunted", "supernatural", "possession"] }] });
  if (m === 11 || (m === 10 && now.getDate() >= 20)) themes.push({ id: "season:holiday", label: "Holiday horror", match: [{ keywordsAny: ["christmas", "holiday", "santa claus", "new year", "thanksgiving"] }] });
  if ([5, 6, 7].includes(m)) themes.push({ id: "season:summer", label: "Summer camp slashers", match: [{ tagsAny: ["slasher", "survival"] }] });
  return themes;
}

export const matchesTheme = (film, theme) => !theme?.match?.length || theme.match.some((c) => matchesClause(film, c));

// ---------- ordering by intensity ----------

const byScare = (a, b) => (a.scares ?? 5) - (b.scares ?? 5) || runtimeOf(a) - runtimeOf(b) || String(a.title).localeCompare(String(b.title));

// Arranges films so their scare levels follow the chosen shape.
export function sequenceByShape(films, shape = "ramp") {
  const asc = [...films].sort(byScare);
  const n = asc.length;
  if (n <= 2 || shape === "ramp") return asc;

  if (shape === "peak") {
    // scariest film at ~70% of the way through; the gentlest ones after it, easing down
    const peakIndex = Math.round(0.7 * (n - 1));
    const peak = asc[n - 1];
    const rest = asc.slice(0, n - 1);
    const after = rest.slice(0, n - 1 - peakIndex).reverse();
    const before = rest.slice(n - 1 - peakIndex);
    return [...before, peak, ...after];
  }

  // wave: gentle, heavy, gentle, heavy...
  const lows = asc.slice(0, Math.ceil(n / 2));
  const highs = asc.slice(Math.ceil(n / 2));
  const out = [];
  for (let i = 0; i < lows.length; i++) {
    out.push(lows[i]);
    if (highs[i]) out.push(highs[i]);
  }
  return out;
}

// Plain-English read on the lineup's pacing.
export function describeFlow(films) {
  const scares = films.map((f) => f.scares ?? 5);
  if (scares.length < 2) return "A single film. No pacing to worry about.";
  const spread = Math.max(...scares) - Math.min(...scares);
  if (spread <= 1) return `Every film sits around ${Math.round(scares[0])}/10, so there's little build. Rate scare levels on your films for a more shaped night.`;
  const peakAt = scares.indexOf(Math.max(...scares)) + 1;
  if (peakAt === scares.length) return `Builds from ${scares[0]}/10 to ${scares[scares.length - 1]}/10, ending on the scariest film.`;
  if (peakAt === 1) return `Opens with the scariest film (${scares[0]}/10) and eases off. Consider a build-up shape.`;
  return `Peaks at ${Math.max(...scares)}/10 with film ${peakAt} of ${scares.length}, ${scares[scares.length - 1] < Math.max(...scares) ? "then eases off" : "and stays high"}.`;
}

// ---------- building a marathon ----------

// A stable pseudo-random nudge per film and seed, so "Shuffle" gives a
// different (but still good) lineup without leaving the top of the ranking.
function jitter(id, seed) {
  if (!seed) return 0;
  let h = 2166136261;
  for (const ch of `${id}:${seed}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (((h >>> 0) % 1000) / 1000) * 0.25;
}

// Choose `count` films from `pool` (library-shaped items) within `budgetMinutes`.
// Returns { films: [{ item, score, reasons, runtime }], totalMinutes, flow }.
// Films are left out if they're unreleased, over your content limits, or off
// theme; unwatched films are preferred and watched ones only fill the gaps.
export function buildMarathon(pool, { count = 3, budgetMinutes = 360, theme = ANY_THEME, shape = "ramp", profile, prefs = {}, seed = 0, now = new Date() } = {}) {
  const p = profile || buildTasteProfile(pool, { now: now.getTime() });
  const year = now.getFullYear();
  const seen = new Set();
  const eligible = (pool || [])
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return (item.year === undefined || Number(item.year) <= year) && matchesTheme(item, theme) && !evaluateItem(item, prefs).blocked;
    })
    // films without your own scare rating carry an estimate, flagged so it can be labelled
    .map((item) => {
      const s = scareOf(item, { bias: p.scareBias || 0 });
      return s.estimated ? { ...item, scares: s.value, scaresEst: true } : item;
    });

  const scare = p.scarePref != null ? Math.round(p.scarePref) : 5;
  const ranked = eligible
    .map((item) => {
      const s = scoreLibraryItem(item, p, { scare });
      const watched = (item.watchedDates || []).length > 0;
      return { item, score: s.score - (watched ? 1 : 0) + jitter(item.id, seed), reasons: s.reasons, runtime: runtimeOf(item) };
    })
    .sort((a, b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title)));

  // Best first, skipping anything that would blow the time budget. Two passes so
  // one very long film can't eat the whole night: first only films within ~1.5x
  // their fair share of the budget, then (if the lineup is still short) the rest.
  const share = (budgetMinutes - BREAK_MINUTES * Math.max(0, count - 1)) / Math.max(1, count);
  const chosen = [];
  const take = (candidates) => {
    for (const candidate of candidates) {
      if (chosen.length >= count) break;
      if (chosen.includes(candidate)) continue;
      const next = [...chosen, candidate].map((c) => c.item);
      if (chosen.length > 0 && totalMinutes(next) > budgetMinutes) continue;
      chosen.push(candidate);
    }
  };
  take(ranked.filter((c) => c.runtime <= share * 1.5));
  take(ranked);

  const ordered = sequenceByShape(chosen.map((c) => c.item), shape).map((item) => chosen.find((c) => c.item === item));
  return { films: ordered, totalMinutes: totalMinutes(ordered.map((c) => c.item)), flow: describeFlow(ordered.map((c) => c.item)) };
}

// Start/end times for each film, with a break between them.
export function marathonTimeline(films, startAt) {
  let cursor = new Date(startAt);
  return films.map((film) => {
    const start = new Date(cursor);
    const end = new Date(start.getTime() + runtimeOf(film) * 60000);
    cursor = new Date(end.getTime() + BREAK_MINUTES * 60000);
    return { film, start, end };
  });
}

// Calendar events for a plan's timeline (see lib/ics.js).
export function marathonEvents(name, films, startAt) {
  return marathonTimeline(films, startAt).map(({ film, start, end }, i) => ({
    title: `${name}: ${film.title}${film.year ? ` (${film.year})` : ""}`,
    start,
    end,
    description: `Film ${i + 1} of ${films.length}${film.scares != null ? ` · scare level ${film.scares}/10` : ""}`,
  }));
}

// ---------- saved plans ----------
// { version: 1, items: [...] } under "horrorhub.marathons.v1"

export const MARATHONS_KEY = "horrorhub.marathons.v1";
export const MARATHONS_VERSION = 1;

// A saved plan keeps a snapshot of each film so it still makes sense if the film later leaves the library.
export function normalizeMarathon(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || !raw.id || typeof raw.name !== "string" || !raw.name.trim()) return null;
  const startAt = new Date(raw.startAt);
  if (Number.isNaN(startAt.getTime())) return null;
  const films = (Array.isArray(raw.films) ? raw.films : [])
    .filter((f) => f && f.id !== undefined && f.id !== null && typeof f.title === "string" && f.title.trim())
    .map((f) => ({
      id: f.id,
      title: f.title.trim(),
      year: Number.isFinite(Number(f.year)) && Number(f.year) > 0 ? Number(f.year) : undefined,
      scares: Number.isFinite(Number(f.scares)) ? Math.min(10, Math.max(0, Math.round(Number(f.scares)))) : undefined,
      scaresEst: f.scaresEst === true ? true : undefined,
      runtime: Number(f.runtime) > 0 ? Math.round(Number(f.runtime)) : undefined,
    }));
  if (!films.length) return null;
  return {
    id: raw.id,
    name: raw.name.trim(),
    startAt: startAt.toISOString(),
    shape: FLOW_SHAPES[raw.shape] ? raw.shape : "ramp",
    themeLabel: typeof raw.themeLabel === "string" ? raw.themeLabel : "Anything",
    films,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  };
}
export const normalizeMarathons = (list) => (Array.isArray(list) ? list.map(normalizeMarathon).filter(Boolean) : []);

export function mergeMarathons(existing, incoming) {
  const result = normalizeMarathons(existing);
  const ids = new Set(result.map((m) => m.id));
  let added = 0;
  for (const m of normalizeMarathons(incoming)) {
    if (ids.has(m.id)) continue;
    result.push(m);
    ids.add(m.id);
    added++;
  }
  return { marathons: result, added };
}

export const snapshotFilm = (item) => ({ id: item.id, title: item.title, year: item.year, scares: item.scares, scaresEst: item.scaresEst || undefined, runtime: item.runtime });

export const loadMarathons = () => normalizeMarathons(readJSON(MARATHONS_KEY)?.items);
export const saveMarathons = (list) => writeJSON(MARATHONS_KEY, { version: MARATHONS_VERSION, items: list });
