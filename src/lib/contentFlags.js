// Content warnings: infer what a film contains from TMDb keywords (and a few
// unambiguous overview phrases), then check films against your limits. Flags
// name a category ("Animal harm"), never a plot point, so they warn without
// spoiling. Inference is best-effort: an absent flag means "no sign of it in
// the metadata", not a guarantee. Pure functions, no network.

export const CONTENT_FLAGS = [
  { id: "gore", label: "Graphic gore", keywords: ["gore", "gory", "splatter", "dismember*", "decapitat*", "mutilat*", "graphic violence"], text: ["gory", "dismember*"] },
  { id: "body-horror", label: "Body horror", keywords: ["body horror", "body transformation", "body modification", "mutation"], text: ["body horror"] },
  { id: "torture", label: "Torture", keywords: ["torture*", "sadism", "sadistic"], text: ["torture*"] },
  { id: "animal-harm", label: "Animal harm", keywords: ["animal cruelty", "animal abuse", "animal death", "animal killing", "animal sacrifice", "dog dies", "pet killed"], text: [] },
  { id: "sexual-violence", label: "Sexual violence", keywords: ["rape", "sexual assault", "sexual abuse", "sexual violence"], text: ["rape", "raped", "sexual assault"] },
  { id: "child-harm", label: "Harm to children", keywords: ["child abuse", "child murder", "child death", "infanticide", "child in peril", "child in danger"], text: [] },
  { id: "self-harm", label: "Suicide / self-harm", keywords: ["suicide", "self-harm", "self harm", "self mutilation"], text: ["suicide"] },
  { id: "extreme-violence", label: "Extreme violence", keywords: ["extreme violence", "brutality", "massacre", "bloodbath", "mass murder"], text: ["massacre", "bloodbath"] },
  // from DoesTheDogDie counts (see itemFlags); never inferred from keywords
  { id: "disturbing", label: "Disturbing content", keywords: [], text: [] },
  { id: "jump-scares", label: "Frequent jump scares", keywords: [], text: [] },
];

export const FLAG_IDS = CONTENT_FLAGS.map((f) => f.id);
const byId = new Map(CONTENT_FLAGS.map((f) => [f.id, f]));
export const flagLabel = (id) => byId.get(id)?.label || id;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// whole word (plural allowed) unless the phrase ends with * (prefix match)
const phraseSource = (p) => (p.endsWith("*") ? escapeRe(p.slice(0, -1)) : `${escapeRe(p)}(?:s|es)?\\b`);
const phraseRe = (phrases) => (phrases.length ? new RegExp(`\\b(?:${phrases.map(phraseSource).join("|")})`, "i") : null);
const COMPILED = CONTENT_FLAGS.map((f) => ({ id: f.id, keywords: f.keywords.map((p) => phraseRe([p])), text: phraseRe(f.text) }));

// Flags the metadata supports, in vocabulary order.
export function inferFlags({ keywords = [], overview = "" } = {}) {
  const names = (keywords || []).map((k) => String(k).toLowerCase());
  const text = String(overview || "");
  return COMPILED.filter(
    (f) => f.keywords.some((re) => names.some((k) => re.test(k))) || (f.text && text && f.text.test(text))
  ).map((f) => f.id);
}

// DoesTheDogDie-derived counts you may have on a film (Details page, optional key).
const DDD_THRESHOLD = { gore: 3, disturbing: 3, "jump-scares": 10 };
function dddFlags(item) {
  const flags = [];
  if ((item.goreCount || 0) >= DDD_THRESHOLD.gore) flags.push("gore");
  if ((item.disturbCount || 0) >= DDD_THRESHOLD.disturbing) flags.push("disturbing");
  if ((item.jumpScares || 0) >= DDD_THRESHOLD["jump-scares"]) flags.push("jump-scares");
  return flags;
}

// Everything known about a library film: inferred/edited flags plus DDD counts.
export function itemFlags(item) {
  return [...new Set([...(item.contentFlags || []), ...dddFlags(item)])].sort((a, b) => FLAG_IDS.indexOf(a) - FLAG_IDS.indexOf(b));
}

// Preferences: { avoidFlags: string[], maxScares: 0-10 }.
// `scares` is your own scare rating and only exists for films you own (an
// unscored library film defaults to 5).
export function evaluateContent({ flags = [], scares }, prefs = {}) {
  const avoid = new Set(prefs.avoidFlags || []);
  const reasons = flags.filter((f) => avoid.has(f)).map((f) => `Contains ${flagLabel(f).toLowerCase()}`);
  const max = prefs.maxScares ?? 10;
  if (typeof scares === "number" && scares > max) reasons.push(`Scare level ${scares} is above your limit of ${max}`);
  return { blocked: reasons.length > 0, reasons };
}

// Convenience for a library item.
export const evaluateItem = (item, prefs) => evaluateContent({ flags: itemFlags(item), scares: item.scares }, prefs);

// True when the user has any active filter, so callers can skip work otherwise.
export const hasContentLimits = (prefs = {}) => (prefs.avoidFlags || []).length > 0 || (prefs.maxScares ?? 10) < 10;

// Splits films you own into those within your limits and those over them.
// (Whether the "over" ones are hidden or just flagged is the caller's choice,
// per the content mode setting.)
export function filterByContent(items, prefs) {
  const visible = [];
  const hidden = [];
  for (const item of items || []) (evaluateItem(item, prefs).blocked ? hidden : visible).push(item);
  return { visible, hidden };
}
