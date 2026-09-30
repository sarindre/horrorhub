import { readJSON, writeJSON } from "./storage.js";
import { FLAG_IDS, flagLabel, itemFlags } from "./contentFlags.js";
import { MOOD_PRESETS, matchesMood } from "./moods.js";
import { tagAffinity } from "./taste.js";
import { scareOf } from "./scare.js";
import { titleKey } from "./library.js";

// Group Night: find a film from your library that everyone in the room will be
// okay with. Each person has limits (content to avoid, a scare ceiling) and
// vibes they like. Limits are hard rules; among the films that pass, we rank by
// the LEAST happy person (not the average), so nobody gets sacrificed for the
// group's mean. Pure and local; nothing leaves the browser.

export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 4;
const MOOD_IDS = MOOD_PRESETS.filter((m) => m.id !== "all").map((m) => m.id);
const moodLabel = (id) => MOOD_PRESETS.find((m) => m.id === id)?.label || id;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

let counter = 0;
const newId = () => `p${Date.now().toString(36)}${(counter++).toString(36)}`;

// { id, name, you, avoidFlags, maxScares, moods, seen }. `you` marks the person
// whose taste profile and watch history come from your own library.
export function newPerson(name = "Guest", overrides = {}) {
  return normalizePerson({ id: newId(), name, you: false, avoidFlags: [], maxScares: 10, moods: [], seen: [], ...overrides });
}

export function normalizePerson(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, 30) : "";
  if (!name) return null;
  const max = Math.round(Number(raw.maxScares));
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId(),
    name,
    you: raw.you === true,
    avoidFlags: Array.isArray(raw.avoidFlags) ? [...new Set(raw.avoidFlags.filter((f) => FLAG_IDS.includes(f)))] : [],
    maxScares: Number.isFinite(max) ? clamp(max, 0, 10) : 10,
    moods: Array.isArray(raw.moods) ? [...new Set(raw.moods.filter((m) => MOOD_IDS.includes(m)))] : [],
    seen: Array.isArray(raw.seen) ? [...new Set(raw.seen.filter((id) => typeof id === "string" || typeof id === "number"))] : [],
  };
}

// You, filled in from your own comfort settings.
export const personFromYou = (settings = {}) =>
  newPerson("You", { id: "you", you: true, avoidFlags: settings.avoidFlags || [], maxScares: settings.maxScares ?? 10 });

// A film the person has seen: for you, your watch dates; for guests, the list you tick.
const hasSeen = (person, item) => (person.you ? (item.watchedDates || []).length > 0 : person.seen.some((id) => String(id) === String(item.id)));

function personVerdict(person, item, flags, scare) {
  const hit = flags.filter((f) => person.avoidFlags.includes(f));
  if (hit.length) return { ok: false, why: `${person.name} avoids ${hit.map((f) => flagLabel(f).toLowerCase()).join(", ")}` };
  if (scare > person.maxScares) return { ok: false, why: `Scare ${scare} is over ${person.name}'s limit of ${person.maxScares}` };
  return { ok: true };
}

// 0..1, how much this person would enjoy the film (limits already passed).
function personScore(person, item, scare, profile) {
  let score = 0.35;
  const reasons = [];
  if (person.moods.length) {
    const liked = person.moods.find((m) => matchesMood(item.tags || [], m));
    if (liked) {
      score += 0.3;
      reasons.push(`${moodLabel(liked)}, ${person.name}'s vibe`);
    }
  } else {
    score += 0.15; // no stated vibe: neutral
  }
  // near (but under) their ceiling counts as a better fit than a very mild film
  const closeness = person.maxScares >= 10 ? 1 - Math.abs(scare - 6) / 10 : 1 - (person.maxScares - scare) / 10;
  score += 0.25 * clamp(closeness, 0, 1);
  if (person.maxScares < 10) reasons.push(`Under ${person.name}'s scare limit of ${person.maxScares}`);
  if (person.you && profile) {
    const affinity = tagAffinity(item, profile);
    score += 0.2 * affinity;
    if (affinity >= 0.15) reasons.push("Fits your taste");
    score += ((item.rating || 0) / 5) * 0.1;
  }
  return { score: clamp(score, 0, 1), reasons };
}

// Films everybody can watch, best compromise first.
//   people:    2-4 people (see newPerson)
//   profile:   your taste profile, used for the person marked `you`
//   allowSeen: include films someone has already seen (they go last)
// Returns { picks, ruledOut, considered } where ruledOut is [{ person, count, examples }].
export function rankForGroup(items, people, { profile = null, allowSeen = false, now = Date.now(), limit = 8 } = {}) {
  const year = new Date(now).getFullYear();
  const bias = profile?.scareBias || 0;
  const seenKeys = new Set();
  const pool = (items || []).filter((i) => {
    if (i.year !== undefined && Number(i.year) > year) return false;
    const key = titleKey(i);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const ruledOut = people.map((person) => ({ person, count: 0, examples: [] }));
  const picks = [];
  for (const item of pool) {
    const flags = itemFlags(item);
    const scare = scareOf(item, { bias }).value;
    const verdicts = people.map((p) => personVerdict(p, item, flags, scare));
    const blocked = verdicts.some((v) => !v.ok);
    verdicts.forEach((v, i) => {
      if (v.ok) return;
      ruledOut[i].count++;
      if (ruledOut[i].examples.length < 2) ruledOut[i].examples.push(item.title);
    });
    if (blocked) continue;

    const seenBy = people.filter((p) => hasSeen(p, item));
    if (seenBy.length && !allowSeen) continue;

    const scores = people.map((p) => ({ person: p, ...personScore(p, item, scare, p.you ? profile : null) }));
    const min = Math.min(...scores.map((s) => s.score));
    const mean = scores.reduce((a, s) => a + s.score, 0) / scores.length;
    const lowest = scores.find((s) => s.score === min);
    picks.push({
      item,
      scare,
      estimated: scareOf(item, { bias }).estimated,
      min,
      mean,
      scores,
      seenBy,
      weakest: scores.length > 1 && mean - min > 0.08 ? lowest.person : null,
    });
  }
  picks.sort((a, b) => (a.seenBy.length > 0) - (b.seenBy.length > 0) || b.min - a.min || b.mean - a.mean || String(a.item.title).localeCompare(String(b.item.title)));
  return { picks: picks.slice(0, limit), ruledOut, considered: pool.length, total: picks.length };
}

// One line per pick that says why it works for the room.
export function groupSummary(pick) {
  const bits = pick.scores.map((s) => s.reasons[0]).filter(Boolean);
  const line = bits.length ? bits.slice(0, 3).join(". ") : "Within everyone's limits";
  return pick.weakest ? `${line}. The compromise is ${pick.weakest.name}'s call.` : line;
}

// ---- saved people ("friends"), reusable between nights ----

export const GROUP_PEOPLE_KEY = "horrorhub.groupPeople.v1";
export const GROUP_PEOPLE_VERSION = 1;

export const normalizePeople = (list) => (Array.isArray(list) ? list.map(normalizePerson).filter(Boolean) : []);
export const loadSavedPeople = () => normalizePeople(readJSON(GROUP_PEOPLE_KEY)?.items).filter((p) => !p.you);
export const saveSavedPeople = (list) => writeJSON(GROUP_PEOPLE_KEY, { version: GROUP_PEOPLE_VERSION, items: normalizePeople(list).filter((p) => !p.you) });
