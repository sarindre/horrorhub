// `tags` match a film in your own library (tags you or TMDb keywords added).
// `keywords` are matched against TMDb titles/overviews for films you don't own
// yet, where no tags exist. It is a heuristic, so hits are used to boost, not filter.
export const MOOD_PRESETS = [
  { id: "all", label: "All vibes", tags: [], keywords: [] },
  {
    id: "atmospheric",
    label: "Atmospheric",
    tags: ["slow-burn", "folk-horror", "haunted", "psychological", "arthouse"],
    keywords: ["haunt", "eerie", "isolated", "remote", "village", "grief", "mysterious", "strange", "lonely", "dread"],
  },
  {
    id: "slasher",
    label: "Slasher",
    tags: ["slasher", "home-invasion", "survival", "campy", "classic"],
    keywords: ["killer", "masked", "stalk", "slay", "murder", "babysitter", "campers", "serial", "survivors"],
  },
  {
    id: "found-footage",
    label: "Found Footage",
    tags: ["found-footage", "found footage", "survival", "supernatural", "haunted"],
    keywords: ["footage", "camera", "camcorder", "documentary", "recording", "tape", "filmed", "video"],
  },
  {
    id: "body-horror",
    label: "Body Horror",
    tags: ["gore", "body-horror", "disturbing", "sci-horror"],
    keywords: ["flesh", "mutat", "infect", "transform", "parasite", "surgery", "disease", "grotesque", "body"],
  },
  {
    id: "creature",
    label: "Creature Feature",
    tags: ["creature", "zombie", "vampire", "sci-horror", "campy"],
    keywords: ["creature", "monster", "beast", "zombie", "vampire", "werewolf", "shark", "outbreak", "swamp", "alien"],
  },
  {
    id: "occult",
    label: "Occult",
    tags: ["occult", "possession", "vampire", "supernatural", "haunted"],
    keywords: ["demon", "possess", "cult", "ritual", "satan", "exorcis", "witch", "curse", "occult", "coven"],
  },
  {
    id: "cosmic",
    label: "Cosmic",
    tags: ["cosmic", "sci-horror", "psychological", "arthouse", "occult"],
    keywords: ["cosmic", "otherworld", "dimension", "ancient", "entity", "void", "eldritch", "lovecraft", "meteor", "alien"],
  },
];

const presetById = (moodId) => MOOD_PRESETS.find((p) => p.id === moodId);

export function matchesMood(tags = [], moodId) {
  if (!moodId || moodId === "all") return true;
  const preset = presetById(moodId);
  if (!preset) return true;
  const lowered = (tags || []).map((tag) => String(tag || "").trim().toLowerCase());
  return preset.tags.some((tag) => lowered.includes(tag.toLowerCase()));
}

// How many of the preset's keywords appear in the text (0 for "all"/unknown).
export function moodTextHits(text = "", moodId) {
  const preset = presetById(moodId);
  if (!preset || !preset.keywords.length) return 0;
  const haystack = String(text || "").toLowerCase();
  return preset.keywords.filter((kw) => haystack.includes(kw)).length;
}
