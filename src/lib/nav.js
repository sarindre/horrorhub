// Navigation model. Twelve views, grouped into seven sections so the top bar stays
// short. A view id is what the app tracks (and what shows up in the URL hash);
// a section is just a way of presenting related views together.

export const NAV = [
  {
    id: "tonight",
    label: "Tonight",
    views: [
      { id: "tonight", label: "Tonight's pick" },
      { id: "group", label: "Group night" },
    ],
  },
  {
    id: "discover",
    label: "Discover",
    views: [
      { id: "discover", label: "Browse" },
      { id: "rate", label: "Rate films" },
    ],
  },
  {
    id: "library",
    label: "My Library",
    views: [
      { id: "library", label: "All films" },
      { id: "shelves", label: "Shelves" },
    ],
  },
  {
    id: "foryou",
    label: "For You",
    views: [
      { id: "recs", label: "Tune your picks" },
      { id: "continuity", label: "Because you liked…" },
    ],
  },
  {
    id: "plan",
    label: "Plan",
    views: [
      { id: "watchlist", label: "Watchlist & plans" },
      { id: "challenges", label: "Challenges" },
    ],
  },
  { id: "stats", label: "Stats", views: [{ id: "stats", label: "Stats" }] },
  { id: "settings", label: "Settings", views: [{ id: "settings", label: "Settings" }] },
];

export const VIEW_IDS = NAV.flatMap((g) => g.views.map((v) => v.id));
export const DEFAULT_VIEW = "tonight";

export const isView = (id) => VIEW_IDS.includes(id);
export const groupOf = (viewId) => NAV.find((g) => g.views.some((v) => v.id === viewId)) || NAV[0];

// Wraps around at both ends (used for arrow-key navigation).
export function stepIndex(current, delta, length) {
  return (current + delta + length) % length;
}
