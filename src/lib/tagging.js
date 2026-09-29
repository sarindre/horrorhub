// Catalog intelligence: turn TMDb metadata into HorrorHub's curated tags, and
// keep track of which tags were inferred so your own edits always win.
// Everything here is pure (no network, no storage).

// The curated vocabulary. These feed the mood presets, the subgenre mixer, the
// taste engine and the Stats badges, so inference targets them rather than
// dumping raw TMDb keywords into your tags.
export const SUGGESTED_TAGS = [
  "supernatural",
  "slasher",
  "found-footage",
  "psychological",
  "gore",
  "body-horror",
  "disturbing",
  "slow-burn",
  "folk-horror",
  "creature",
  "haunted",
  "possession",
  "vampire",
  "zombie",
  "occult",
  "sci-horror",
  "cosmic",
  "home-invasion",
  "survival",
  "arthouse",
  "campy",
  "classic",
];
const VOCAB = new Set(SUGGESTED_TAGS);

// One spelling per tag: "Folk Horror", "#folk_horror" and "folk-horror" are the same.
const ALIASES = {
  ghost: "haunted",
  ghosts: "haunted",
  monster: "creature",
  monsters: "creature",
  zombies: "zombie",
  vampires: "vampire",
  foundfootage: "found-footage",
  folkhorror: "folk-horror",
  bodyhorror: "body-horror",
  slowburn: "slow-burn",
  "sci-fi-horror": "sci-horror",
};

export function canonicalTag(input) {
  const cleaned = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return ALIASES[cleaned] || cleaned;
}

// Each rule: `keywords` match TMDb keyword names (strong signal), `text` match
// the overview (only for phrases specific enough to trust). A phrase matches as
// a whole word (plural allowed), so "cult" never matches "cultural". A trailing
// * makes it a prefix: "possess*" covers "possessed" and "possession".
const RULES = {
  slasher: { keywords: ["slasher", "masked killer", "final girl"], text: ["slasher", "masked killer", "masked stranger"] },
  "found-footage": { keywords: ["found footage", "handheld camera", "camcorder", "pov"], text: ["found footage", "camcorder", "recovered footage", "documentary crew"] },
  "folk-horror": { keywords: ["folk horror", "pagan", "wicker man"], text: ["pagan"] },
  "body-horror": { keywords: ["body horror", "body transformation", "mutation", "body modification"], text: ["body horror", "mutat*"] },
  haunted: { keywords: ["haunt*", "ghost", "poltergeist", "spirit"], text: ["haunt*", "ghost", "poltergeist"] },
  supernatural: { keywords: ["supernatural", "paranormal", "demon", "demonic", "curse", "cursed", "evil spirit"], text: ["supernatural", "paranormal", "demon", "demonic", "curse", "cursed"] },
  possession: { keywords: ["possess*", "exorcis*"], text: ["possess*", "exorcis*"] },
  occult: { keywords: ["occult", "satan*", "cult", "witch", "witchcraft", "ritual", "black magic", "devil", "coven"], text: ["occult", "satan*", "cult", "witch", "ritual", "coven"] },
  vampire: { keywords: ["vampire", "dracula", "nosferatu"], text: ["vampire", "dracula"] },
  zombie: { keywords: ["zombie", "undead", "living dead"], text: ["zombie", "undead", "living dead"] },
  creature: { keywords: ["creature", "monster", "werewolf", "werewolves", "mutant", "kaiju", "sea monster", "giant animal"], text: ["creature", "monster", "werewolf", "werewolves", "beast"] },
  cosmic: { keywords: ["cosmic horror", "lovecraft*", "eldritch", "cthulhu"], text: ["cosmic", "eldritch", "lovecraft*", "ancient entity"] },
  "sci-horror": { keywords: ["alien", "outer space", "space", "experiment", "cyborg", "artificial intelligence", "sci-fi horror"], text: ["alien", "spaceship", "experiment gone"] },
  "home-invasion": { keywords: ["home invasion", "intruder", "break-in"], text: ["home invasion", "intruder", "break into"] },
  survival: { keywords: ["survival", "stranded", "wilderness", "trapped"], text: ["survive", "stranded", "trapped"] },
  psychological: { keywords: ["psychological", "paranoia", "mental illness", "hallucinat*", "delusion*", "madness", "unreliable narrator"], text: ["paranoia", "madness", "hallucinat*", "unravel*"] },
  gore: { keywords: ["gore", "splatter", "gory", "dismember*", "decapitat*", "mutilat*"], text: ["gory", "bloodbath", "dismember*"] },
  "slow-burn": { keywords: ["slow burn"], text: [] },
  arthouse: { keywords: ["art house", "arthouse", "surreal*", "avant-garde"], text: [] },
  campy: { keywords: ["campy", "b movie", "b-movie", "cheesy", "spoof", "parody", "horror comedy", "so bad it's good"], text: [] },
  disturbing: { keywords: ["disturbing", "torture*", "sadism", "sadistic", "extreme violence"], text: [] },
};
const GENRE_TAGS = { 878: "sci-horror", 35: "campy" }; // TMDb genre ids (Sci-Fi, Comedy) alongside Horror
const CLASSIC_BEFORE = 1986;
const MAX_INFERRED = 6;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// whole word (plural allowed) unless the phrase ends with * (prefix match)
const phraseSource = (p) => (p.endsWith("*") ? escapeRe(p.slice(0, -1)) : `${escapeRe(p)}(?:s|es)?\\b`);
const phraseRe = (phrases) => (phrases.length ? new RegExp(`\\b(?:${phrases.map(phraseSource).join("|")})`, "i") : null);
const COMPILED = Object.fromEntries(
  Object.entries(RULES).map(([tag, r]) => [tag, { keywords: r.keywords.map((p) => phraseRe([p])), text: phraseRe(r.text) }])
);

// Which curated tags does this film's metadata support? Strongest evidence
// first, capped so a film doesn't get a wall of tags.
export function inferTags({ keywords = [], overview = "", genreIds = [], year } = {}) {
  const scores = new Map();
  const bump = (tag, n) => scores.set(tag, (scores.get(tag) || 0) + n);
  const names = (keywords || []).map((k) => String(k).toLowerCase());
  const text = String(overview || "");

  for (const [tag, rule] of Object.entries(COMPILED)) {
    const keywordHits = rule.keywords.reduce((n, re) => n + (names.some((k) => re.test(k)) ? 1 : 0), 0);
    if (keywordHits) bump(tag, keywordHits * 2);
    if (rule.text && text && rule.text.test(text)) bump(tag, 1);
  }
  for (const id of genreIds || []) if (GENRE_TAGS[id]) bump(GENRE_TAGS[id], 1);
  if (Number(year) > 0 && Number(year) < CLASSIC_BEFORE) bump("classic", 2);

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_INFERRED)
    .map(([tag]) => tag);
}

// ---- provenance: inferred vs. yours ----
// A list field (tags, or content flags) comes with the subset that was
// inferred and the inferred values you removed, so re-running inference adds
// new evidence but never re-adds what you deleted or clobbers what you typed.
//   state = { list: [], auto: [], removed: [] }

const uniq = (list) => [...new Set(list)];

// Add newly inferred values, skipping ones you removed.
export function mergeInferred(state, inferred) {
  const list = uniq(state.list || []);
  const removed = new Set(state.removed || []);
  const auto = new Set((state.auto || []).filter((v) => list.includes(v)));
  for (const value of inferred) {
    if (removed.has(value) || list.includes(value)) continue;
    list.push(value);
    auto.add(value);
  }
  return { list, auto: [...auto], removed: [...removed] };
}

// You edited the list by hand. Removing an inferred value is remembered;
// re-adding one forgets that.
export function applyManualEdit(state, next) {
  const nextList = uniq(next);
  const removed = new Set(state.removed || []);
  for (const value of state.auto || []) if (!nextList.includes(value)) removed.add(value);
  for (const value of nextList) removed.delete(value);
  return { list: nextList, auto: (state.auto || []).filter((v) => nextList.includes(v)), removed: [...removed] };
}

// Convenience wrappers for the provenance-tracked fields on a library item.
export const tagState = (item) => ({ list: item.tags || [], auto: item.autoTags || [], removed: item.removedTags || [] });
export const tagPatch = ({ list, auto, removed }) => ({ tags: list, autoTags: auto, removedTags: removed });
export const editTags = (item, nextTags) => tagPatch(applyManualEdit(tagState(item), nextTags.map(canonicalTag).filter(Boolean)));

export const flagState = (item) => ({ list: item.contentFlags || [], auto: item.autoFlags || [], removed: item.removedFlags || [] });
export const flagPatch = ({ list, auto, removed }) => ({ contentFlags: list, autoFlags: auto, removedFlags: removed });
export const editFlags = (item, nextFlags) => flagPatch(applyManualEdit(flagState(item), nextFlags));

// ---- one-time cleanup of the old auto-tagger ----
// Older versions copied every TMDb keyword into `tags` (e.g. "based-on-novel",
// "female-protagonist"), which drowns the curated tags. For films whose
// keywords have been stored, a tag that is (a) outside the curated vocabulary
// and (b) exactly one of the film's keywords was almost certainly auto-added.
// This finds them so they can be moved out of tags (search still uses keywords).
export function legacyKeywordTags(item) {
  const keywords = new Set((item.keywords || []).map(canonicalTag));
  if (!keywords.size) return [];
  return (item.tags || []).filter((t) => !VOCAB.has(t) && keywords.has(t) && !(item.autoTags || []).includes(t));
}

export function cleanupLegacyKeywordTags(items) {
  let films = 0;
  let tags = 0;
  const next = items.map((item) => {
    const stale = legacyKeywordTags(item);
    if (!stale.length) return item;
    films++;
    tags += stale.length;
    return { ...item, tags: item.tags.filter((t) => !stale.includes(t)) };
  });
  return { items: next, films, tags };
}
