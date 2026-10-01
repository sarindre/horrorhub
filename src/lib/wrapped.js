import { streaksFrom } from "./challenges.js";
import { dayKey, parseDay } from "./dates.js";
import { MOOD_PRESETS, matchesMood } from "./moods.js";
import { scareOf } from "./scare.js";
import { watchLog } from "./insights.js";
import { plural } from "./text.js";

// Horror Wrapped: your year in horror, worked out from your watch dates.
// Pure; the card on the Stats screen renders it and lib/wrappedImage.js draws it.

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DEFAULT_RUNTIME = 100; // minutes, when a film's runtime isn't known
const MIN_FILMS_FOR_PERSONALITY = 3;
const MIN_SHARE_FOR_PERSONALITY = 0.25;

// What your favorite vibe says about you.
export const PERSONALITIES = {
  atmospheric: "The Dread Connoisseur",
  slasher: "The Slasher Devotee",
  "found-footage": "The Shaky-Cam Survivor",
  "body-horror": "The Flesh Fanatic",
  creature: "The Monster Mash Regular",
  occult: "The Coven Regular",
  cosmic: "The Void Gazer",
};
export const OMNIVORE = "The Horror Omnivore";

// Years you have watches in (never the long-ago placeholder), newest first.
export function wrappedYears(items, { longAgoYear = 1900 } = {}) {
  return [...new Set(watchLog(items, longAgoYear).map((w) => Number(w.day.slice(0, 4))))].sort((a, b) => b - a);
}

// The year to open on: this year if it has watches, else the latest one that does.
export function defaultWrappedYear(items, { now = new Date(), longAgoYear = 1900 } = {}) {
  const years = wrappedYears(items, { longAgoYear });
  return years.includes(now.getFullYear()) ? now.getFullYear() : years[0] ?? null;
}

const top = (counts, limit) =>
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));

function personalityFor(films) {
  const counts = new Map();
  for (const film of films) {
    for (const mood of MOOD_PRESETS) {
      if (mood.id === "all") continue;
      if (matchesMood(film.tags || [], mood.id)) counts.set(mood.id, (counts.get(mood.id) || 0) + 1);
    }
  }
  const [best] = top(counts, 1);
  if (!best || films.length < MIN_FILMS_FOR_PERSONALITY || best.count / films.length < MIN_SHARE_FOR_PERSONALITY) return { title: OMNIVORE, mood: null };
  return { title: PERSONALITIES[best.key] || OMNIVORE, mood: best.key };
}

// Your year, or null if you logged nothing in it.
export function buildWrapped(items, year, { longAgoYear = 1900, bias = 0 } = {}) {
  const all = watchLog(items, longAgoYear);
  const log = all.filter((w) => Number(w.day.slice(0, 4)) === year);
  if (!log.length) return null;

  const films = [...new Map(log.map((w) => [w.item.id, w.item])).values()];
  // watches dated in the long-ago placeholder year also mean you had seen it before
  const seenBefore = (item) => (item.watchedDates || []).some((d) => dayKey(new Date(d)) < `${year}-01-01`);
  const newFilms = films.filter((f) => !seenBefore(f)).length;

  const minutes = log.reduce((sum, w) => sum + (w.item.runtime > 0 ? w.item.runtime : DEFAULT_RUNTIME), 0);
  const estimatedHours = log.some((w) => !(w.item.runtime > 0));

  const tagCounts = new Map();
  for (const w of log) for (const tag of new Set(w.item.tags || [])) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);

  const scares = films.map((f) => ({ film: f, ...scareOf(f, { bias }) }));
  const scariest = [...scares].sort((a, b) => b.value - a.value || (b.film.rating || 0) - (a.film.rating || 0) || String(a.film.title).localeCompare(String(b.film.title)))[0];

  const byMonth = new Map();
  const byWeekday = new Map();
  const byDay = new Map();
  for (const w of log) {
    const d = parseDay(w.day);
    byMonth.set(d.getMonth(), (byMonth.get(d.getMonth()) || 0) + 1);
    byWeekday.set(d.getDay(), (byWeekday.get(d.getDay()) || 0) + 1);
    byDay.set(w.day, (byDay.get(w.day) || 0) + 1);
  }
  const [busiestMonth] = top(byMonth, 1);
  const [favoriteDay] = top(byWeekday, 1);
  const [bigNight] = top(byDay, 1);
  const first = log[0];
  const last = log[log.length - 1];
  const oldest = [...films].filter((f) => f.year).sort((a, b) => a.year - b.year || String(a.title).localeCompare(String(b.title)))[0];

  return {
    year,
    watches: log.length,
    films: films.length,
    newFilms,
    rewatches: log.length - films.length,
    hours: Math.round(minutes / 60),
    estimatedHours,
    topTags: top(tagCounts, 3).map(({ key, count }) => ({ tag: key, count })),
    personality: personalityFor(films),
    averageScare: Math.round((scares.reduce((s, x) => s + x.value, 0) / scares.length) * 10) / 10,
    scariest: { title: scariest.film.title, year: scariest.film.year, scare: scariest.value, estimated: scariest.estimated },
    topRated: films
      .filter((f) => (f.rating || 0) >= 4)
      .sort((a, b) => b.rating - a.rating || String(a.title).localeCompare(String(b.title)))
      .slice(0, 3)
      .map((f) => ({ title: f.title, year: f.year, rating: f.rating })),
    busiestMonth: { name: MONTH_NAMES[busiestMonth.key], count: busiestMonth.count },
    favoriteDay: { name: DAY_NAMES[favoriteDay.key], count: favoriteDay.count },
    longestStreak: streaksFrom(log.map((w) => w.day), `${year}-12-31`).longest,
    bigNight: bigNight.count >= 2 ? { day: bigNight.key, count: bigNight.count } : null,
    marathonNights: [...byDay.values()].filter((c) => c >= 3).length,
    first: { title: first.item.title, day: first.day },
    last: { title: last.item.title, day: last.day },
    oldest: oldest ? { title: oldest.title, year: oldest.year } : null,
  };
}

const stars = (n) => `${n}★`;

// The same story as plain text, for pasting anywhere.
export function wrappedText(w) {
  const lines = [
    `My ${w.year} in horror — ${w.personality.title}`,
    `${plural(w.films, "film")} (${plural(w.watches, "watch")}), about ${w.hours} hours${w.estimatedHours ? " (estimated)" : ""}`,
  ];
  if (w.newFilms) lines.push(`${w.newFilms} new to me${w.rewatches ? `, ${plural(w.rewatches, "rewatch")}` : ""}`);
  if (w.topTags.length) lines.push(`Most watched: ${w.topTags.map((t) => `#${t.tag}`).join(" ")}`);
  lines.push(`Scariest: ${w.scariest.title}${w.scariest.year ? ` (${w.scariest.year})` : ""}, ${w.scariest.scare}/10${w.scariest.estimated ? " (est.)" : ""}`);
  if (w.topRated.length) lines.push(`Top rated: ${w.topRated.map((f) => `${f.title} ${stars(f.rating)}`).join(", ")}`);
  lines.push(`Busiest month: ${w.busiestMonth.name} (${plural(w.busiestMonth.count, "watch")}). Favorite night: ${w.favoriteDay.name}s`);
  if (w.longestStreak >= 2) lines.push(`Longest streak: ${plural(w.longestStreak, "day")}`);
  if (w.bigNight) lines.push(`Biggest night: ${plural(w.bigNight.count, "film")} in one sitting`);
  return lines.join("\n");
}
