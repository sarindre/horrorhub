import { dayKey } from "./dates.js";
import { streaksFrom, watchDays } from "./challenges.js";

// XP, levels and badges: the playful side of Stats. Pure; the screen renders it.

// Ranks are earned by XP. Each is a step up from the last, and the names are
// horror-flavoured without being gendered.
export const LEVELS = [
  { min: 0, name: "Fresh Meat" },
  { min: 100, name: "Camper" },
  { min: 300, name: "Survivor" },
  { min: 600, name: "Grave Digger" },
  { min: 1000, name: "Nightmare Regular" },
  { min: 1600, name: "Horror Scholar" },
  { min: 2500, name: "Scream Legend" },
  { min: 4000, name: "Elder God" },
];

const isLongAgo = (day, longAgoYear) => Number(day.slice(0, 4)) === longAgoYear;

// Every real watch day (never the "long ago" placeholder dates).
export function realWatchDays(items, longAgoYear = 1900) {
  return (items || []).flatMap((i) => watchDays(i)).filter((d) => !isLongAgo(d, longAgoYear));
}

// 10 XP per logged watch (long-ago ones too: you did watch it) and 5 per day of
// your current streak beyond the first.
export function xpFor(items, { now = new Date(), longAgoYear = 1900 } = {}) {
  const watches = (items || []).reduce((sum, i) => sum + (i.watchedDates?.length || 0), 0);
  const { current } = streaksFrom(realWatchDays(items, longAgoYear), dayKey(now));
  return watches * 10 + Math.max(0, current - 1) * 5;
}

// Where an XP total sits: the level, how far into it, and what's next.
export function levelFor(xp) {
  let index = 0;
  LEVELS.forEach((l, i) => {
    if (xp >= l.min) index = i;
  });
  const level = LEVELS[index];
  const next = LEVELS[index + 1] || null;
  return {
    number: index + 1,
    name: level.name,
    xp,
    next: next ? { name: next.name, min: next.min } : null,
    toNext: next ? next.min - xp : 0,
    pct: next ? Math.round(((xp - level.min) / (next.min - level.min)) * 100) : 100,
  };
}

// Badges, each with how far along you are so an unearned one shows "2 of 3".
export function badgesFor(items, { now = new Date(), longAgoYear = 1900 } = {}) {
  const list = items || [];
  const watched = list.filter((i) => (i.watchedDates || []).length);
  const count = (pred) => watched.filter(pred).length;
  const hasTag = (...tags) => (i) => (i.tags || []).some((t) => tags.includes(t));
  const days = realWatchDays(list, longAgoYear);
  const longestStreak = streaksFrom(days, dayKey(now)).longest;
  const perDay = new Map();
  for (const day of days) perDay.set(day, (perDay.get(day) || 0) + 1);
  const busiestDay = Math.max(0, ...perDay.values());

  const specs = [
    ["folk", "Folk Horror Initiate", 3, count(hasTag("folk-horror"))],
    ["slasher80s", "80s Slasher Fan", 3, count((i) => hasTag("slasher")(i) && (i.year || 0) >= 1980 && (i.year || 0) <= 1989)],
    ["marathon", "Midnight Marathon (3 days in a row)", 3, longestStreak],
    ["ghosts", "Ghost Hunter", 5, count(hasTag("supernatural", "haunted", "possession"))],
    ["occult", "Occult Scholar", 4, count(hasTag("occult"))],
    ["footage", "Found Footage Addict", 3, count(hasTag("found-footage"))],
    ["gore", "Gore Hound", 5, count(hasTag("gore"))],
    ["vampire", "Vamp Acolyte", 2, count(hasTag("vampire"))],
    ["zombie", "Zombie Survivalist", 3, count(hasTag("zombie"))],
    ["classic", "Classic Connoisseur", 5, count((i) => (i.year || 9999) <= 1980)],
    ["newblood", "New Blood", 5, count((i) => (i.year || 0) >= 2015)],
    ["speed", "Speed Watcher (2 in a day)", 2, busiestDay],
    ["reviewer", "Reviewer", 10, count((i) => (i.notes || "").trim().length > 0)],
    ["tags", "Tag Master (20 tags)", 20, new Set(list.flatMap((i) => i.tags || [])).size],
    ["curator", "Curator (10+ Watchlist)", 10, list.filter((i) => i.watchlist).length],
    ["knife", "Knife Juggler (5×4★)", 5, count((i) => (i.rating || 0) >= 4)],
  ];
  return specs.map(([id, label, need, have]) => ({ id, label, need, have: Math.min(have, need), earned: have >= need }));
}
