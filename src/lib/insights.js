import { watchDays } from "./challenges.js";
import { addDays, dayKey, parseDay } from "./dates.js";
import { isScareRated } from "./scare.js";
import { plural } from "./text.js";

// Insights: short, plain sentences about your own habits and taste, worked out
// from your library. Each one only appears when there's enough behind it, says
// how much that is, and describes what you did rather than guessing why.
// Pure; the Stats screen renders the result.

const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const MIN_FILMS_FOR_INSIGHTS = 5;

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const one = (n) => (Math.round(n * 10) / 10).toFixed(1);

// Every watch as { item, day }, oldest first. Watches dated in `longAgoYear`
// ("seen it long ago" placeholders) carry no real date, so they're left out.
export function watchLog(items, longAgoYear = 1900) {
  const out = [];
  for (const item of items || []) {
    for (const day of watchDays(item)) {
      if (Number(day.slice(0, 4)) === longAgoYear) continue;
      out.push({ item, day });
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day) || String(a.item.title).localeCompare(String(b.item.title)));
}

const weekday = (day) => parseDay(day).getDay();
const ratedFilms = (items) => (items || []).filter((i) => (i.rating || 0) > 0);

// ---- individual insights: each returns null, or { id, text, evidence, score } ----

function tagGap(items) {
  const byTag = new Map();
  for (const film of ratedFilms(items)) for (const tag of new Set(film.tags || [])) byTag.set(tag, [...(byTag.get(tag) || []), film.rating]);
  const tags = [...byTag.entries()].filter(([, r]) => r.length >= 3).map(([tag, r]) => ({ tag, n: r.length, avg: mean(r) }));
  if (tags.length < 2) return null;
  tags.sort((a, b) => b.avg - a.avg || b.n - a.n || a.tag.localeCompare(b.tag));
  const best = tags[0];
  const worst = tags[tags.length - 1];
  const gap = best.avg - worst.avg;
  if (gap < 0.75) return null;
  return {
    id: "tag-gap",
    text: `You rate #${best.tag} films ${one(best.avg)}★ on average, but #${worst.tag} only ${one(worst.avg)}★.`,
    evidence: `${best.n} and ${worst.n} rated films`,
    score: gap * Math.sqrt(Math.min(best.n, worst.n)),
  };
}

function scareVersusRating(items) {
  const films = ratedFilms(items).filter(isScareRated);
  const high = films.filter((f) => f.scares >= 7).map((f) => f.rating);
  const low = films.filter((f) => f.scares <= 4).map((f) => f.rating);
  if (high.length < 3 || low.length < 3) return null;
  const diff = mean(high) - mean(low);
  if (Math.abs(diff) < 0.6) return null;
  const text =
    diff > 0
      ? `You rate the scary ones higher: films you scored 7 or more for scares average ${one(mean(high))}★, against ${one(mean(low))}★ for the mild ones (4 or under).`
      : `You like them gentler: films you scored 7 or more for scares average ${one(mean(high))}★, against ${one(mean(low))}★ for the mild ones (4 or under).`;
  return { id: "scare-vs-rating", text, evidence: `${high.length} scary and ${low.length} mild films`, score: Math.abs(diff) * Math.sqrt(Math.min(high.length, low.length)) };
}

function scareTrend(log) {
  const firstWatch = new Map();
  for (const w of log) if (isScareRated(w.item) && !firstWatch.has(w.item.id)) firstWatch.set(w.item.id, w);
  const films = [...firstWatch.values()];
  if (films.length < 8) return null;
  const half = Math.floor(films.length / 2);
  const earlier = films.slice(0, half);
  const recent = films.slice(films.length - half);
  const diff = mean(recent.map((w) => w.item.scares)) - mean(earlier.map((w) => w.item.scares));
  if (Math.abs(diff) < 1) return null;
  const since = parseDay(recent[0].day);
  return {
    id: "scare-trend",
    text: `Your recent watches run ${diff > 0 ? "scarier" : "gentler"}: they average ${one(mean(recent.map((w) => w.item.scares)))}/10 for scares, against ${one(mean(earlier.map((w) => w.item.scares)))}/10 before ${MONTH_NAMES[since.getMonth()]} ${since.getFullYear()}.`,
    evidence: `${films.length} films with a scare rating`,
    score: Math.abs(diff) * 2,
  };
}

function weekdays(log) {
  const insights = [];
  if (log.length < 10) return insights;
  const counts = Array(7).fill(0);
  for (const w of log) counts[weekday(w.day)]++;
  const top = counts.indexOf(Math.max(...counts));
  const share = counts[top] / log.length;
  if (share >= 0.28) {
    insights.push({ id: "weekday", text: `You do most of your watching on ${DAY_NAMES[top]}: ${counts[top]} of your ${log.length} watches.`, evidence: `${plural(log.length, "watch")}`, score: share * 10 });
  }
  const rated = log.filter((w) => isScareRated(w.item));
  const byDay = Array.from({ length: 7 }, (_, d) => rated.filter((w) => weekday(w.day) === d).map((w) => w.item.scares));
  let best = null;
  byDay.forEach((scares, d) => {
    const others = byDay.flatMap((s, o) => (o === d ? [] : s));
    if (scares.length < 4 || others.length < 4) return;
    const diff = mean(scares) - mean(others);
    if (diff >= 1 && (!best || diff > best.diff)) best = { d, diff, avg: mean(scares), others: mean(others), n: scares.length };
  });
  if (best) {
    insights.push({
      id: "scary-night",
      text: `${DAY_NAMES[best.d]} are your scary nights: those watches average ${one(best.avg)}/10 for scares, against ${one(best.others)}/10 on other days.`,
      evidence: `${plural(best.n, "watch")} on ${DAY_NAMES[best.d]}`,
      score: best.diff * 2,
    });
  }
  return insights;
}

function favoriteDecade(items) {
  const films = ratedFilms(items).filter((f) => f.year);
  if (films.length < 6) return null;
  const overall = mean(films.map((f) => f.rating));
  const byDecade = new Map();
  for (const f of films) {
    const decade = Math.floor(f.year / 10) * 10;
    byDecade.set(decade, [...(byDecade.get(decade) || []), f.rating]);
  }
  const decades = [...byDecade.entries()].filter(([, r]) => r.length >= 3).map(([decade, r]) => ({ decade, n: r.length, avg: mean(r) }));
  if (decades.length < 2) return null;
  decades.sort((a, b) => b.avg - a.avg || b.n - a.n);
  const best = decades[0];
  if (best.avg - overall < 0.4) return null;
  return { id: "decade", text: `The ${best.decade}s are your favorite decade: ${one(best.avg)}★ on average across ${best.n} films.`, evidence: `${films.length} rated films`, score: (best.avg - overall) * Math.sqrt(best.n) };
}

function backlogPace(items, log, now) {
  const backlog = (items || []).filter((i) => i.watchlist && !(i.watchedDates || []).length).length;
  const since = addDays(dayKey(now), -90);
  const recent = log.filter((w) => w.day >= since).length;
  if (backlog < 5 || recent < 3) return null;
  const perMonth = recent / 3;
  const months = backlog / perMonth;
  const span = months < 1.5 ? "about a month" : months < 18 ? `about ${Math.round(months)} months` : "well over a year";
  return { id: "backlog", text: `At your recent pace (about ${one(perMonth)} a month), your ${backlog}-film watchlist would take ${span}.`, evidence: `${plural(recent, "watch")} in the last 90 days`, score: 1 };
}

// Insights for the whole library, strongest first. `ready` says whether there
// is enough to look at yet; `hint` says what to do when there isn't.
export function computeInsights(items, { now = new Date(), longAgoYear = 1900, limit = 5 } = {}) {
  const log = watchLog(items, longAgoYear);
  // films you've watched or rated (a film can be both)
  const known = new Set([...log.map((w) => w.item.id), ...ratedFilms(items).map((f) => f.id)]).size;
  if (known < MIN_FILMS_FOR_INSIGHTS) {
    const need = MIN_FILMS_FOR_INSIGHTS - known;
    return { ready: false, insights: [], hint: `Rate or log ${plural(need, "more film")} and patterns in your taste will start to show up here.` };
  }
  const insights = [tagGap(items), scareVersusRating(items), scareTrend(log), ...weekdays(log), favoriteDecade(items), backlogPace(items, log, now)]
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return {
    ready: true,
    insights: insights.slice(0, limit),
    hint: insights.length ? "" : "Nothing stands out yet. Patterns show up after a few dozen ratings and watches, especially with scare levels set.",
  };
}
