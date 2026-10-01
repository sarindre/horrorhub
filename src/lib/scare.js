// Scare levels. A film has a scare level (0-10) you set yourself; until you do,
// HorrorHub estimates one from what it knows (tags, content flags, keywords)
// and labels it "est." so it never passes for your own rating. Pure, no network.

import { canonicalTag } from "./tagging.js";
import { diaryScare } from "./diary.js";

export const NEUTRAL_SCARE = 5;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// How much each signal moves the estimate away from the middle. Tags and
// content flags share one table: "gore" as a tag and as a flag is one signal.
const SIGNAL_WEIGHT = {
  gore: 1.5,
  "body-horror": 1.5,
  disturbing: 1.5,
  torture: 1.5,
  "extreme-violence": 1.5,
  "sexual-violence": 1,
  "child-harm": 0.5,
  "jump-scares": 1,
  possession: 1,
  "home-invasion": 1,
  slasher: 0.5,
  occult: 0.5,
  supernatural: 0.5,
  haunted: 0.5,
  survival: 0.5,
  "found-footage": 0.5,
  "slow-burn": 0.5,
  psychological: 0.5,
  cosmic: 0.5,
  "folk-horror": 0.5,
  zombie: 0.3,
  vampire: -0.3,
  arthouse: -0.5,
  classic: -0.8,
  campy: -2,
};

// Raw TMDb keywords that mean "played for laughs".
const LIGHT_KEYWORDS = ["horror comedy", "parody", "spoof", "slapstick", "dark comedy", "comedy horror"];

const BASE = 4.5;
const MIN_ESTIMATE = 1;
const MAX_ESTIMATE = 9;

// You rated a scare level when you moved the slider. Older libraries only
// stored the number (5 was the default), so a bare 5 with no marker is
// treated as "never rated" and any other number as yours.
export function isScareRated(item) {
  if (item?.scaresRated === true) return true;
  if (item?.scaresRated === false) return false;
  return typeof item?.scares === "number" && item.scares !== NEUTRAL_SCARE;
}

// { value, signals }: signals is how many clues the estimate rests on, so the
// UI can say "est." only when there's something behind it.
export function estimateScare(item) {
  const names = new Set([...(item?.tags || []), ...(item?.contentFlags || [])].map(canonicalTag));
  let total = BASE;
  let signals = 0;
  for (const name of names) {
    const w = SIGNAL_WEIGHT[name];
    if (w !== undefined) {
      total += w;
      signals++;
    }
  }
  const keywords = (item?.keywords || []).map((k) => String(k).toLowerCase());
  if (keywords.some((k) => LIGHT_KEYWORDS.some((l) => k.includes(l)))) {
    total -= 2;
    signals++;
  }
  return { value: Math.round(clamp(total, MIN_ESTIMATE, MAX_ESTIMATE)), signals };
}

// How far your own scare levels (the slider, or what your diary says) run from
// the estimates, on films where you have one: a positive number means horror hits you harder than the formula
// thinks. Shrunk toward zero until there are enough rated films, and capped.
const BIAS_MIN_FILMS = 3;
const BIAS_SHRINK = 3;
const BIAS_CAP = 2;
export function scareBias(items) {
  const diffs = (items || [])
    .map((i) => ({ observed: ownScare(i), est: estimateScare(i) }))
    .filter((d) => d.observed !== null && d.est.signals > 0)
    .map((d) => d.observed - d.est.value);
  if (diffs.length < BIAS_MIN_FILMS) return 0;
  return clamp(mean(diffs) * (diffs.length / (diffs.length + BIAS_SHRINK)), -BIAS_CAP, BIAS_CAP);
}

// Your own word on a film's scare level: the slider if you set it, else the
// average of your diary entries, else null.
export function ownScare(item) {
  return isScareRated(item) ? item.scares : diaryScare(item);
}

// The scare level to use for a film: yours if you set one (or your diary has
// one), else the estimate (shifted by `bias`). `estimated` is what the UI labels "est.".
export function scareOf(item, { bias = 0 } = {}) {
  if (isScareRated(item)) return { value: item.scares, estimated: false, signals: 0 };
  const diary = diaryScare(item);
  if (diary !== null) return { value: diary, estimated: false, signals: 0, source: "diary" };
  const est = estimateScare(item);
  if (!est.signals) return { value: NEUTRAL_SCARE, estimated: true, signals: 0 };
  return { value: Math.round(clamp(est.value + bias, MIN_ESTIMATE, MAX_ESTIMATE)), estimated: true, signals: est.signals };
}

// Where a scare dial starts: your usual level, never above what the taste quiz
// said was too much or your own limit.
export function defaultScare(profile, prefs = {}) {
  let s = profile.scarePref != null ? Math.round(profile.scarePref) : NEUTRAL_SCARE;
  if (profile.scareCeiling != null) s = Math.min(s, profile.scareCeiling);
  s = Math.min(s, prefs.maxScares ?? 10);
  return clamp(s, 0, 10);
}

export const scareValue = (item, opts) => scareOf(item, opts).value;
