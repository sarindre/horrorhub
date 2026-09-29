export const MOOD_PRESETS = [
  { id: "all", label: "All vibes", tags: [] },
  { id: "atmospheric", label: "Atmospheric", tags: ["slow-burn", "folk-horror", "haunted", "psychological", "arthouse"] },
  { id: "slasher", label: "Slasher", tags: ["slasher", "home-invasion", "survival", "campy", "classic"] },
  { id: "found-footage", label: "Found Footage", tags: ["found-footage", "found footage", "survival", "supernatural", "haunted"] },
  { id: "body-horror", label: "Body Horror", tags: ["gore", "body-horror", "disturbing", "sci-horror"] },
  { id: "creature", label: "Creature Feature", tags: ["creature", "zombie", "vampire", "sci-horror", "campy"] },
  { id: "occult", label: "Occult", tags: ["occult", "possession", "vampire", "supernatural", "haunted"] },
  { id: "cosmic", label: "Cosmic", tags: ["cosmic", "sci-horror", "psychological", "arthouse", "occult"] },
];

export function matchesMood(tags = [], moodId) {
  if (!moodId || moodId === "all") return true;
  const preset = MOOD_PRESETS.find((p) => p.id === moodId);
  if (!preset) return true;
  const lowered = (tags || []).map((tag) => String(tag || "").trim().toLowerCase());
  return preset.tags.some((tag) => lowered.includes(tag.toLowerCase()));
}
