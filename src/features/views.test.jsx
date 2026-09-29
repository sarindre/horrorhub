import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LibraryView } from "./library/LibraryView.jsx";
import { WatchlistView } from "./watchlist/WatchlistView.jsx";
import { RecommendationsView } from "./recs/RecommendationsView.jsx";
import { ContinuityGraph } from "./recs/ContinuityGraph.jsx";
import { RatingRoulette } from "./recs/RatingRoulette.jsx";
import { StatsView } from "./stats/StatsView.jsx";
import { Discover } from "./discover/Discover.jsx";
import { MovieDetails } from "./details/MovieDetails.jsx";
import { Settings } from "./settings/Settings.jsx";
import { MovieCard } from "../components/MovieCard.jsx";

const items = [
  { id: 1, title: "Hereditary", year: 2018, rating: 4.5, scares: 8, tags: ["occult", "psychological"], watchedDates: ["2024-10-01T00:00:00.000Z"], watchlist: false, addedAt: "2024-10-01T00:00:00.000Z" },
  { id: 2, title: "The Thing", year: 1982, rating: 5, scares: 7, tags: ["creature"], watchedDates: [], watchlist: true, addedAt: "2024-10-02T00:00:00.000Z" },
];
const noop = () => {};

// Smoke-renders each extracted view so a broken import or hook shows up as a failing test.
describe("feature views render", () => {
  afterEach(() => vi.unstubAllGlobals());
  const render = (el) => renderToString(el);

  it("LibraryView", () => expect(render(<LibraryView items={items} onUpdate={noop} onRemove={noop} onOpenDetails={noop} />)).toContain("Hereditary"));
  it("WatchlistView", () => expect(render(<WatchlistView items={[items[1]]} onUpdate={noop} onRemove={noop} onOpenDetails={noop} />)).toContain("The Thing"));
  it("RecommendationsView", () =>
    expect(render(<RecommendationsView items={items} onAdd={noop} onUpdate={noop} onRemove={noop} onOpenDetails={noop} inLibraryIds={new Set([1, 2])} watchlistIds={new Set([2])} ratingById={{}} />)).toContain("Night vibe"));
  it("ContinuityGraph", () => expect(() => render(<ContinuityGraph items={items} onOpenDetails={noop} />)).not.toThrow());
  it("RatingRoulette", () => expect(() => render(<RatingRoulette onAdd={noop} onOpenDetails={noop} />)).not.toThrow());
  it("StatsView", () => expect(() => render(<StatsView items={items} />)).not.toThrow());
  it("Discover", () => expect(() => render(<Discover onAdd={noop} onRemove={noop} inLibraryIds={new Set()} onToggleWatchlist={noop} onOpenDetails={noop} watchlistIds={new Set()} ratingById={{}} />)).not.toThrow());
  it("MovieDetails", () => expect(render(<MovieDetails item={items[0]} localItem={items[0]} onUpdate={noop} onAdd={noop} />)).toContain("Hereditary"));
  it("Settings", () => expect(render(<Settings settings={{}} onChange={noop} onImport={noop} watchlist={[]} data={items} />)).toContain("Backup"));
  it("MovieCard", () => expect(render(<MovieCard item={items[0]} onUpdate={noop} onRemove={noop} />)).toContain("Hereditary"));
});
