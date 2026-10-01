import { evaluateItem } from "./contentFlags.js";
import { BREAK_MINUTES, describeFlow, runtimeOf } from "./marathon.js";
import { scareOf } from "./scare.js";
import { scoreLibraryItem } from "./taste.js";
import { titleKey } from "./library.js";
import { canonicalTag } from "./tagging.js";

// Double features: given a film, suggest a companion from your library to watch
// after it. Three ways to pair, each with its own reasoning:
//   deeper    the same corner of horror, at a similar scare level
//   cleanser  something lighter to wind down with after a heavy film
//   short     shorter, so the night stays manageable
// Films you've watched, unreleased ones and anything over your content limits
// are never suggested. Pure; the "Pair with" panel renders it.

export const PAIR_KINDS = [
  { id: "deeper", label: "Same wavelength", blurb: "Another film from the same corner of horror" },
  { id: "cleanser", label: "Palate cleanser", blurb: "Something lighter to wind down with" },
  { id: "short", label: "Quick one", blurb: "Shorter, so the night stays manageable" },
];

const CLEANSER_MIN_BASE = 5; // below this the film is already gentle
const CLEANSER_DROP = 3; // a cleanser is at least this much lighter
const SHORT_MAX_MINUTES = 90;
const DEEPER_SCARE_WINDOW = 2;
const SHORT_SCARE_WINDOW = 3;

const tagsOf = (item) => new Set((item?.tags || []).map(canonicalTag));
const runtimeText = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

// Suggestions for `film` (a library item, or a TMDb film you don't own).
//   perKind: how many films to offer in each group
// Returns { base: { scare, estimated, runtime }, groups: [{ kind, picks, skipped? }] }.
// Each pick: { item, scare, estimated, runtime, totalMinutes, reasons, flow }.
export function pairSuggestions(film, library, { profile, prefs = {}, now = new Date(), perKind = 2 } = {}) {
  const bias = profile?.scareBias || 0;
  const baseScare = scareOf(film, { bias });
  const baseRuntime = runtimeOf(film);
  const baseTags = tagsOf(film);
  const baseKey = titleKey(film);
  const year = now.getFullYear();

  const seen = new Set();
  const pool = (library || []).filter((i) => {
    if (String(i.id) === String(film.id) || titleKey(i) === baseKey) return false;
    if ((i.watchedDates || []).length) return false;
    if (i.year !== undefined && Number(i.year) > year) return false;
    if (evaluateItem(i, prefs).blocked) return false;
    if (seen.has(titleKey(i))) return false;
    seen.add(titleKey(i));
    return true;
  });
  const described = pool.map((item) => {
    const s = scareOf(item, { bias });
    return { item, scare: s.value, estimated: s.estimated, runtime: runtimeOf(item), shared: [...tagsOf(item)].filter((t) => baseTags.has(t)) };
  });
  const taste = (c, target) => (profile ? scoreLibraryItem(c.item, profile, { scare: target }).score : 0);

  const pickFor = (c, reasons) => ({
    item: c.item,
    scare: c.scare,
    estimated: c.estimated,
    runtime: c.runtime,
    totalMinutes: baseRuntime + BREAK_MINUTES + c.runtime,
    reasons,
    flow: describeFlow([{ scares: baseScare.value }, { scares: c.scare }]),
  });

  const rankers = {
    deeper: () =>
      described
        .filter((c) => c.shared.length && Math.abs(c.scare - baseScare.value) <= DEEPER_SCARE_WINDOW)
        .map((c) => ({ c, score: Math.min(c.shared.length, 3) / 3 + taste(c, baseScare.value) * 0.5 - Math.abs(c.scare - baseScare.value) * 0.05 }))
        .sort(bestFirst)
        .map(({ c }) => pickFor(c, [`Both ${c.shared.slice(0, 2).map((t) => `#${t}`).join(" and ")}`, `Scare ${c.scare}/10${c.estimated ? " (est.)" : ""}, close to ${baseScare.value}/10`])),
    cleanser: () =>
      described
        .filter((c) => c.scare <= baseScare.value - CLEANSER_DROP)
        .map((c) => ({ c, score: taste(c, Math.max(1, baseScare.value - 4)) - c.runtime / 600 }))
        .sort(bestFirst)
        .map(({ c }) => pickFor(c, [`Eases off from ${baseScare.value}/10 to ${c.scare}/10${c.estimated ? " (est.)" : ""}`])),
    short: () =>
      described
        .filter((c) => c.runtime <= SHORT_MAX_MINUTES && c.runtime < baseRuntime && Math.abs(c.scare - baseScare.value) <= SHORT_SCARE_WINDOW)
        .map((c) => ({ c, score: taste(c, baseScare.value) + (SHORT_MAX_MINUTES - c.runtime) / SHORT_MAX_MINUTES }))
        .sort(bestFirst)
        .map(({ c }) => pickFor(c, [`${runtimeText(c.runtime)}, ${runtimeText(baseRuntime + BREAK_MINUTES + c.runtime)} for the double feature`])),
  };

  const used = new Set();
  const groups = PAIR_KINDS.map((kind) => {
    if (kind.id === "cleanser" && baseScare.value < CLEANSER_MIN_BASE) {
      return { kind, picks: [], skipped: `This one is already gentle (${baseScare.value}/10), so there's nothing to wind down from.` };
    }
    const picks = [];
    for (const pick of rankers[kind.id]()) {
      if (used.has(pick.item.id)) continue; // a film is offered once, under its best fit
      used.add(pick.item.id);
      picks.push(pick);
      if (picks.length >= perKind) break;
    }
    return { kind, picks };
  });

  return { base: { scare: baseScare.value, estimated: baseScare.estimated, runtime: baseRuntime }, groups };
}

const bestFirst = (a, b) => b.score - a.score || String(a.c.item.title).localeCompare(String(b.c.item.title));

// What the planner needs to show this pair: the two films in order, and why the second.
export const pairLineup = (film, pick) => ({ films: [film, pick.item], reasons: [[], pick.reasons] });
