import { lazy } from "react";

// Heavier screens load on demand, so the first visit only downloads what the
// landing tabs need (Recharts, for one, is only used by Stats).
const loaders = {
  stats: () => import("./features/stats/StatsView.jsx"),
  details: () => import("./features/details/MovieDetails.jsx"),
  challenges: () => import("./features/challenges/ChallengesView.jsx"),
  continuity: () => import("./features/recs/ContinuityGraph.jsx"),
  roulette: () => import("./features/recs/RatingRoulette.jsx"),
  shelves: () => import("./features/shelves/ShelvesView.jsx"),
  group: () => import("./features/tonight/GroupNight.jsx"),
};

export const StatsView = lazy(() => loaders.stats().then((m) => ({ default: m.StatsView })));
export const MovieDetails = lazy(() => loaders.details().then((m) => ({ default: m.MovieDetails })));
export const ChallengesView = lazy(() => loaders.challenges().then((m) => ({ default: m.ChallengesView })));
export const ContinuityGraph = lazy(() => loaders.continuity().then((m) => ({ default: m.ContinuityGraph })));
export const RatingRoulette = lazy(() => loaders.roulette().then((m) => ({ default: m.RatingRoulette })));
export const ShelvesView = lazy(() => loaders.shelves().then((m) => ({ default: m.ShelvesView })));
export const GroupNight = lazy(() => loaders.group().then((m) => ({ default: m.GroupNight })));

// Fetch the small screens while the browser is idle, so switching tabs is
// instant without slowing the first load. Stats (the charting library, ~95 KB
// gzipped) is left to load when you open it.
export function preloadLazyViews() {
  const { stats: _stats, ...small } = loaders;
  Object.values(small).forEach((load) => load().catch(() => {}));
}
