import { itemFlags, flagLabel } from "./contentFlags.js";
import { MOOD_PRESETS, matchesMood } from "./moods.js";
import { scareOf } from "./scare.js";
import { scoreLibraryItem } from "./taste.js";
import { canonicalTag } from "./tagging.js";

// Ask HorrorHub: turn a sentence like "slow-burn folk horror under 100 minutes,
// no animal harm" into filters, and apply them to your library. Rule-based and
// entirely local: it only understands the words below, and it always shows what
// it understood and what it ignored, so you can see why you got what you got.
// Pure; features/ask renders it.

// ---- vocabulary (spelled with spaces; hyphens in the question are read as spaces) ----

// Content flags you can rule out: "no gore", "without animal cruelty"...
const FLAG_WORDS = {
  gore: ["gore", "gory", "blood", "bloody", "splatter", "gruesome"],
  "body-horror": ["body horror"],
  torture: ["torture", "torturing"],
  "animal-harm": ["animal harm", "animal cruelty", "animal abuse", "animal death", "animal deaths", "animals dying", "animal violence", "dog dying", "dogs dying", "dog dies", "dogs die", "pet death", "pets dying", "hurt animals", "animals being hurt"],
  "sexual-violence": ["sexual violence", "sexual assault", "sexual abuse", "rape"],
  "child-harm": ["child harm", "harm to children", "child abuse", "children in danger", "kids in danger", "child death", "child deaths", "dead kids", "child violence"],
  "self-harm": ["suicide", "self harm"],
  "extreme-violence": ["extreme violence", "brutal violence", "brutality", "massacre", "bloodbath"],
  disturbing: ["disturbing", "disturbing content"],
  "jump-scares": ["jump scares", "jump scare", "jumpscares", "jumpscare"],
};

// Tags you can ask for ("folk horror") or rule out ("no slashers").
const TAG_WORDS = {
  "slow-burn": ["slow burn", "slowburn"],
  "folk-horror": ["folk horror", "folk", "pagan"],
  "found-footage": ["found footage", "faux documentary"],
  slasher: ["slasher", "slashers"],
  psychological: ["psychological", "mind bending", "mindbending", "head trip"],
  gore: ["gore", "gory", "splatter"],
  "body-horror": ["body horror"],
  disturbing: ["disturbing", "unsettling", "upsetting"],
  creature: ["creature feature", "creature", "creatures", "monster", "monsters"],
  haunted: ["haunted house", "ghost story", "haunted", "haunting", "ghost", "ghosts"],
  possession: ["possession", "possessed", "exorcism", "demonic"],
  vampire: ["vampire", "vampires"],
  zombie: ["zombie", "zombies", "undead"],
  occult: ["occult", "satanic", "witchcraft", "witch", "witches", "coven", "cult", "ritual"],
  "sci-horror": ["sci fi horror", "science fiction horror", "sci horror", "space horror"],
  cosmic: ["cosmic horror", "cosmic", "lovecraftian", "eldritch"],
  "home-invasion": ["home invasion"],
  survival: ["survival"],
  arthouse: ["arthouse", "art house", "elevated"],
  campy: ["campy", "camp", "cheesy", "b movie", "silly", "schlocky", "trashy"],
  classic: ["cult classic", "classics", "classic", "old school", "vintage"],
  supernatural: ["supernatural", "paranormal"],
};

// Moods by their own name (the rest are covered by tags above).
const MOOD_WORDS = { atmospheric: ["atmospheric", "moody", "eerie", "dreadful"] };

// Words that mean nothing on their own.
const FILLER = new Set(
  "a an the some me my i we you show find give want need would like to watch see something anything movie movies film films horror scary something good great nice please can could tonight tonights for of in on at is are be that this it and or but with from just really very kind sort type thats whats also maybe about featuring involving starring".split(" ")
);

const flagLabelLower = (id) => flagLabel(id).toLowerCase();

// ---- text helpers ----

const norm = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[-–—_/]/g, " ")
    .replace(/[^a-z0-9'+<>=.,&\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const alternation = (words) => [...new Set(words)].sort((a, b) => b.length - a.length).map(escapeRe).join("|");

const flagRe = new RegExp(`(?:${alternation(Object.values(FLAG_WORDS).flat())})`);
const entries = (kind, table) => Object.entries(table).map(([id, words]) => ({ kind, id, words, start: new RegExp(`^(?:${alternation(words)})\\b`) }));
const NEGATABLE = [...entries("flag", FLAG_WORDS), ...entries("tag", TAG_WORDS)];

// The entry whose phrase begins `text`, preferring the longest phrase.
function phraseAt(text, kind) {
  let best = null;
  for (const e of NEGATABLE) {
    if (kind && e.kind !== kind) continue;
    const m = e.start.exec(text);
    if (m && (!best || m[0].length > best.length)) best = { entry: e, length: m[0].length, phrase: m[0] };
  }
  return best;
}

// Ruling something out: a phrase that is both a content flag and a tag ("gory", "body horror")
// rules out both, since a film may carry either.
function addExclusion(hit, out) {
  const { entry, phrase } = hit;
  (entry.kind === "flag" ? out.flags : out.tags).add(entry.id);
  const other = entry.kind === "flag" ? TAG_WORDS : FLAG_WORDS;
  if (other[entry.id]?.includes(phrase)) (entry.kind === "flag" ? out.tags : out.flags).add(entry.id);
}

const NEGATION = /\b(?:no|without|avoid|avoiding|skip|nothing with|nothing|not too|not|minus|zero|hold the|free of)\b\s+(?:(?:any|too|much|really|the|with|of)\s+)*/g;
const CONTINUE = /^\s*(?:,\s*)?(?:and|or|nor|&|,)\s*(?:(?:no|any|too|much|the|without)\s+)*/;

// "no gore or animal harm", "nothing too gory", "gore free": what to rule out.
// Returns the text left over, with what was understood removed.
function takeExclusions(text, out) {
  let result = text;
  // "gore free"
  result = result.replace(new RegExp(`\\b(${flagRe.source}|${alternation(Object.values(TAG_WORDS).flat())})\\s+free\\b`, "g"), (m, word) => {
    const hit = phraseAt(word);
    if (!hit) return m;
    addExclusion(hit, out);
    return " ";
  });
  for (;;) {
    NEGATION.lastIndex = 0;
    let found = null;
    let m;
    while ((m = NEGATION.exec(result))) {
      const hit = phraseAt(result.slice(m.index + m[0].length));
      if (hit) {
        found = { start: m.index, end: m.index + m[0].length + hit.length, hits: [hit] };
        // follow a list: "no gore, animal harm or torture"
        let rest = result.slice(found.end);
        for (;;) {
          const cont = CONTINUE.exec(rest);
          if (!cont) break;
          const more = phraseAt(rest.slice(cont[0].length));
          if (!more) break;
          found.hits.push(more);
          found.end += cont[0].length + more.length;
          rest = result.slice(found.end);
        }
        break;
      }
    }
    if (!found) return result;
    for (const hit of found.hits) addExclusion(hit, out);
    result = `${result.slice(0, found.start)} ${result.slice(found.end)}`;
  }
}

// ---- runtime, years, scare, status ----

const toMinutes = (n, unit) => {
  const value = Number(n);
  const u = (unit || "").toLowerCase();
  if (/^h/.test(u)) return Math.round(value * 60);
  if (/^m/.test(u)) return Math.round(value);
  return value <= 5 ? Math.round(value * 60) : Math.round(value); // "under 2" means hours, "under 100" minutes
};
const UNIT = "(hours?|hrs?|h|minutes?|mins?|m)";
const NUM = "(\\d+(?:\\.\\d+)?)";

function takeRuntime(text, f) {
  let t = text;
  const rules = [
    [new RegExp(`\\b(?:under|below|less than|shorter than|no longer than|max|maximum|at most|up to|within|<=?)\\s*${NUM}\\s*${UNIT}?\\b`), (m) => (f.runtimeMax = toMinutes(m[1], m[2]))],
    [new RegExp(`\\b(?:over|above|more than|longer than|at least|min|minimum|>=?)\\s*${NUM}\\s*${UNIT}?\\b`), (m) => (f.runtimeMin = toMinutes(m[1], m[2]))],
    [new RegExp(`\\b${NUM}\\s*${UNIT}\\s*(?:or\\s*)?(?:less|shorter|under|max)\\b`), (m) => (f.runtimeMax = toMinutes(m[1], m[2]))],
    [new RegExp(`\\b${NUM}\\s*${UNIT}\\s*(?:or\\s*)?(?:more|longer|over|plus)\\b`), (m) => (f.runtimeMin = toMinutes(m[1], m[2]))],
    [/\b(?:short|quick|brisk|bite sized)\b/, () => (f.runtimeMax = Math.min(f.runtimeMax ?? 90, 90))],
    [/\b(?:long|epic|sprawling)\b/, () => (f.runtimeMin = Math.max(f.runtimeMin ?? 130, 130))],
  ];
  for (const [re, apply] of rules) {
    const m = re.exec(t);
    if (!m) continue;
    apply(m);
    t = `${t.slice(0, m.index)} ${t.slice(m.index + m[0].length)}`;
  }
  return t;
}

const DECADE_WORDS = { fifties: 1950, sixties: 1960, seventies: 1970, eighties: 1980, nineties: 1990, noughties: 2000, aughts: 2000 };

function takeYears(text, f, now) {
  let t = text;
  const thisYear = now.getFullYear();
  const cut = (m) => (t = `${t.slice(0, m.index)} ${t.slice(m.index + m[0].length)}`);
  let m;

  // before / after a year
  if ((m = /\b(?:before|prior to|older than|pre)\s*(\d{4})\b/.exec(t))) { f.yearMax = Number(m[1]) - 1; cut(m); }
  if ((m = /\b(?:after|newer than|later than|post)\s*(\d{4})\b/.exec(t))) { f.yearMin = Number(m[1]) + 1; cut(m); }
  if ((m = /\b(?:since|from)\s*(\d{4})\s*(?:on|onwards?|forward)\b/.exec(t)) || (m = /\bsince\s*(\d{4})\b/.exec(t))) { f.yearMin = Number(m[1]); cut(m); }

  // decades: "the 80s", "1980s", "eighties", "'90s"
  if ((m = /\b(?:the\s+)?(?:(?:19|20)(\d)0s|'?(\d)0s)\b/.exec(t))) {
    const full = /(19|20)\d0s/.exec(m[0]);
    const decade = full ? Number(full[0].slice(0, 4)) : Number(m[2]) < 3 ? 2000 + Number(m[2]) * 10 : 1900 + Number(m[2]) * 10;
    f.yearMin = decade;
    f.yearMax = decade + 9;
    cut(m);
  } else if ((m = new RegExp(`\\b(?:the\\s+)?(${Object.keys(DECADE_WORDS).join("|")})\\b`).exec(t))) {
    f.yearMin = DECADE_WORDS[m[1]];
    f.yearMax = DECADE_WORDS[m[1]] + 9;
    cut(m);
  }

  // one specific year: "from 1982", "in 2015", or just "1982"
  if (f.yearMin === undefined && f.yearMax === undefined && (m = /\b(?:from|in|of|released in)?\s*((?:19|20)\d{2})\b/.exec(t)) && Number(m[1]) <= thisYear) {
    f.yearMin = Number(m[1]);
    f.yearMax = Number(m[1]);
    cut(m);
  }

  // "recent", "old"
  if ((m = /\b(?:recent|recently released|newer|modern|latest|brand new|new)\b/.exec(t))) { f.yearMin = Math.max(f.yearMin ?? 0, thisYear - 5); cut(m); }
  if ((m = /\b(?:older|old)\b/.exec(t))) { f.yearMax = Math.min(f.yearMax ?? 1989, 1989); cut(m); }
  return t;
}

function takeScare(text, f) {
  let t = text;
  let m;
  const cut = () => (t = `${t.slice(0, m.index)} ${t.slice(m.index + m[0].length)}`);
  if ((m = /\bscare(?:s| level| rating)?\s*(?:of\s*)?(under|below|<=?|at most|max|up to)\s*(\d+)\b/.exec(t))) { f.scareMax = Number(m[2]); cut(); }
  if ((m = /\bscare(?:s| level| rating)?\s*(?:of\s*)?(over|above|>=?|at least|min)\s*(\d+)\b/.exec(t))) { f.scareMin = Number(m[2]); cut(); }
  if ((m = /\b(?:not|isn't|nothing)\s+(?:too|that|very|overly|so)\s+(?:scary|intense|frightening|terrifying|heavy)\b/.exec(t))) { f.scareMax = 5; cut(); }
  if ((m = /\b(?:mild|gentle|light|cozy|cosy|chill|easy|tame|soft|family friendly|spooky|not scary)\b/.exec(t))) { f.scareMax = Math.min(f.scareMax ?? 4, 4); cut(); }
  if ((m = /\b(?:terrifying|really scary|very scary|super scary|scariest|intense|hardcore|nightmare fuel|punishing|brutal)\b/.exec(t))) { f.scareMin = Math.max(f.scareMin ?? 7, 7); cut(); }
  else if ((m = /\b(?:scary|frightening|creepy)\b/.exec(t))) { f.scareMin = Math.max(f.scareMin ?? 6, 6); cut(); }
  return t;
}

function takeStatus(text, f) {
  let t = text;
  let m;
  const cut = () => (t = `${t.slice(0, m.index)} ${t.slice(m.index + m[0].length)}`);
  if ((m = /\b(?:haven't seen|have not seen|not seen|never seen|not yet seen|not watched|haven't watched|unwatched|unseen|new to me|something new)\b/.exec(t))) { f.watched = false; cut(); }
  else if ((m = /\b(?:already watched|already seen|watched|seen|rewatch(?:able)?|re watch)\b/.exec(t))) { f.watched = true; cut(); }
  if ((m = /\b(?:on|from|in)\s+my\s+watchlist\b|\bwatchlist\b/.exec(t))) { f.watchlist = true; cut(); }
  if ((m = /\b(?:rated|rating)\s*(?:over|above|at least)?\s*(\d(?:\.\d)?)\s*\+?\s*(?:stars?)?(?:\s*(?:or\s*)?(?:more|higher|better|up))?\b/.exec(t)) || (m = /\b(\d(?:\.\d)?)\s*\+?\s*stars?(?:\s*(?:or\s*)?(?:more|higher|better|up))?\b/.exec(t))) { f.ratingMin = Number(m[1]); cut(); }
  else if ((m = /\b(?:top rated|highly rated|best rated|favorites?|favourites?|loved|best)\b/.exec(t))) { f.ratingMin = 4; cut(); }
  if ((m = /\bunrated\b/.exec(t))) { f.ratingMax = 0; cut(); }
  return t;
}

// ---- what the question is about ----

function takeTerms(text, f) {
  let t = text;
  const re = /\b(?:about|featuring|involving|starring)\s+([a-z0-9' ]+?)(?=\s*(?:,|\band\b|\bor\b|\bunder\b|\bover\b|\bfrom\b|\bbefore\b|\bafter\b|\bwith\b|\bno\b|\bwithout\b|$))/g;
  const vocab = new RegExp(`\\b(?:${alternation([...Object.values(TAG_WORDS).flat(), ...Object.values(MOOD_WORDS).flat()])})\\b`);
  let m;
  while ((m = re.exec(t))) {
    const words = m[1].split(" ").filter((w) => w && !FILLER.has(w));
    // "about vampires" is a subgenre, left for the tag step; only other topics become search terms
    if (!words.length || vocab.test(m[1])) {
      t = `${t.slice(0, m.index)} ${m[1]} ${t.slice(m.index + m[0].length)}`;
    } else {
      f.terms.push(words.join(" "));
      t = `${t.slice(0, m.index)} ${t.slice(m.index + m[0].length)}`;
    }
    re.lastIndex = 0;
    if (words.length === 0 || vocab.test(m[1])) break; // nothing consumed: don't loop on the same text
  }
  return t;
}

function takeTagsAndMoods(text, f) {
  let t = text;
  const moodRe = new RegExp(`\\b(?:${alternation(Object.values(MOOD_WORDS).flat())})\\b`, "g");
  t = t.replace(moodRe, (word) => {
    const id = Object.entries(MOOD_WORDS).find(([, words]) => words.includes(word))?.[0];
    if (id && !f.moods.includes(id)) f.moods.push(id);
    return " ";
  });
  const tagRe = new RegExp(`\\b(?:${alternation(Object.values(TAG_WORDS).flat())})\\b`, "g");
  t = t.replace(tagRe, (word) => {
    const hit = phraseAt(word, "tag");
    if (hit && !f.tags.includes(hit.entry.id)) f.tags.push(hit.entry.id);
    return " ";
  });
  return t;
}

// ---- parse ----

const emptyFilters = () => ({ tags: [], excludeTags: [], moods: [], excludeFlags: [], terms: [] });

// Understand a question. Returns { filters, understood, ignored } where `understood`
// is a list of { id, label } chips and `ignored` are words that were left unused.
export function parseQuery(question, { now = new Date() } = {}) {
  const f = emptyFilters();
  let t = ` ${norm(question)} `;

  const out = { flags: new Set(), tags: new Set() };
  t = takeExclusions(t, out);
  f.excludeFlags = [...out.flags];
  f.excludeTags = [...out.tags];

  // order matters: "something new" is a status (not "recent"), "old school" a tag (not "old"),
  // and "about vampires" a subgenre (not a search term)
  t = takeStatus(t, f);
  t = takeTerms(t, f);
  t = takeTagsAndMoods(t, f);
  t = takeScare(t, f); // first, so "scare level under 6" isn't read as a 6-hour runtime
  t = takeRuntime(t, f);
  t = takeYears(t, f, now);

  const ignored = t
    .split(/[\s,.]+/)
    .filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w) && w.length > 1);
  return { filters: f, understood: describeFilters(f), ignored: [...new Set(ignored)] };
}

const hoursText = (min) => (min % 60 === 0 && min >= 60 ? `${min / 60} h` : `${min} min`);

// Chips that say what was understood.
export function describeFilters(f) {
  const chips = [];
  const add = (id, label) => chips.push({ id, label });
  f.tags.forEach((t) => add(`tag:${t}`, `#${t}`));
  f.moods.forEach((m) => add(`mood:${m}`, MOOD_PRESETS.find((p) => p.id === m)?.label || m));
  f.excludeTags.forEach((t) => add(`no-tag:${t}`, `no #${t}`));
  f.excludeFlags.forEach((fl) => add(`no-flag:${fl}`, `no ${flagLabelLower(fl)}`));
  if (f.runtimeMax !== undefined) add("runtimeMax", `under ${hoursText(f.runtimeMax)}`);
  if (f.runtimeMin !== undefined) add("runtimeMin", `over ${hoursText(f.runtimeMin)}`);
  if (f.yearMin !== undefined && f.yearMax !== undefined) add("years", f.yearMin === f.yearMax ? String(f.yearMin) : f.yearMax - f.yearMin === 9 && f.yearMin % 10 === 0 ? `${f.yearMin}s` : `${f.yearMin}–${f.yearMax}`);
  else if (f.yearMin !== undefined) add("yearMin", `${f.yearMin} or later`);
  else if (f.yearMax !== undefined) add("yearMax", `${f.yearMax} or earlier`);
  if (f.scareMax !== undefined) add("scareMax", `scare ${f.scareMax} or less`);
  if (f.scareMin !== undefined) add("scareMin", `scare ${f.scareMin} or more`);
  if (f.watched === false) add("unwatched", "not watched yet");
  if (f.watched === true) add("watched", "already watched");
  if (f.watchlist) add("watchlist", "on your watchlist");
  if (f.ratingMin !== undefined) add("ratingMin", `rated ${f.ratingMin}★ or more`);
  if (f.ratingMax === 0) add("unrated", "unrated");
  f.terms.forEach((t) => add(`term:${t}`, `about “${t}”`));
  return chips;
}

export const hasFilters = (f) =>
  !!(f.tags.length || f.moods.length || f.excludeTags.length || f.excludeFlags.length || f.terms.length ||
    ["runtimeMax", "runtimeMin", "yearMin", "yearMax", "scareMax", "scareMin", "ratingMin", "ratingMax"].some((k) => f[k] !== undefined) ||
    f.watched !== undefined || f.watchlist);

// ---- applying it to your library ----

const textOf = (item) => `${item.title || ""} ${item.overview || ""} ${(item.keywords || []).join(" ")}`.toLowerCase();

// Films from `items` that fit, best match first. Each result: { item, score, reasons, notes }.
// `left out` counts what the exclusions removed, by reason, so nothing disappears silently.
export function applyQuery(items, filters, { profile = null, now = new Date() } = {}) {
  const f = filters;
  const year = now.getFullYear();
  const bias = profile?.scareBias || 0;
  const results = [];
  const leftOut = {};
  const left = (why) => (leftOut[why] = (leftOut[why] || 0) + 1);

  for (const item of items || []) {
    const tags = (item.tags || []).map(canonicalTag);
    const flags = itemFlags(item);
    if (item.year !== undefined && Number(item.year) > year) continue; // not out yet

    const hitFlags = f.excludeFlags.filter((id) => flags.includes(id));
    const hitTags = f.excludeTags.filter((t) => tags.includes(t));
    if (hitFlags.length || hitTags.length) {
      for (const id of hitFlags) left(`has ${flagLabelLower(id)}`);
      for (const t of hitTags) left(`is #${t}`);
      continue;
    }

    const watched = (item.watchedDates || []).length > 0;
    if (f.watched === false && watched) continue;
    if (f.watched === true && !watched) continue;
    if (f.watchlist && !item.watchlist) continue;
    if (f.ratingMin !== undefined && !((item.rating || 0) >= f.ratingMin)) continue;
    if (f.ratingMax === 0 && (item.rating || 0) > 0) continue;

    const notes = [];
    const reasons = [];
    if (f.runtimeMax !== undefined || f.runtimeMin !== undefined) {
      if (item.runtime > 0) {
        if (f.runtimeMax !== undefined && item.runtime > f.runtimeMax) continue;
        if (f.runtimeMin !== undefined && item.runtime < f.runtimeMin) continue;
        reasons.push(`${item.runtime} min`);
      } else notes.push("runtime unknown");
    }
    if (f.yearMin !== undefined || f.yearMax !== undefined) {
      if (item.year === undefined) continue;
      if (f.yearMin !== undefined && item.year < f.yearMin) continue;
      if (f.yearMax !== undefined && item.year > f.yearMax) continue;
    }
    const scare = scareOf(item, { bias });
    if (f.scareMax !== undefined && scare.value > f.scareMax) continue;
    if (f.scareMin !== undefined && scare.value < f.scareMin) continue;
    if (f.scareMax !== undefined || f.scareMin !== undefined) reasons.push(`Scare ${scare.value}/10${scare.estimated ? " (est.)" : ""}`);

    if (f.terms.length) {
      const text = textOf(item);
      if (!f.terms.every((term) => text.includes(term))) continue;
      reasons.push(`Mentions ${f.terms.join(", ")}`);
    }

    // asked-for subgenres and moods: any one is enough, more is better
    const wantedTags = f.tags.filter((t) => tags.includes(t));
    const wantedMoods = f.moods.filter((m) => matchesMood(tags, m));
    const asked = f.tags.length + f.moods.length;
    if (asked) {
      if (!wantedTags.length && !wantedMoods.length) continue;
      const names = [...wantedTags.map((t) => `#${t}`), ...wantedMoods.map((m) => MOOD_PRESETS.find((p) => p.id === m)?.label)];
      reasons.unshift(`Matches ${names.join(" and ")}${asked > 1 ? ` (${wantedTags.length + wantedMoods.length} of ${asked})` : ""}`);
    }

    const matchScore = (wantedTags.length + wantedMoods.length) * 2;
    const taste = profile ? scoreLibraryItem(item, profile, { scare: scare.value }).score : 0;
    results.push({ item, score: matchScore + taste + (item.rating || 0) * 0.1, reasons, notes });
  }
  results.sort((a, b) => b.score - a.score || String(a.item.title).localeCompare(String(b.item.title)));
  return { results, leftOut };
}
