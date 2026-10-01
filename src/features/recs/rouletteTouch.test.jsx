// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RatingRoulette } from "./RatingRoulette.jsx";
import { Discover } from "../discover/Discover.jsx";
import { ToastProvider } from "../../components/Toast.jsx";
import { LIBRARY_PLACE, WATCHLIST_PLACE, touchMessage } from "../../lib/touch.js";
import { clearTmdbCache } from "../../lib/tmdb.js";

const WAIT = { timeout: 3000 };
const list = (ids, offset = 0) => ids.map((id) => ({ id: id + offset, title: `Movie ${id + offset}`, release_date: "2020-01-01", poster_path: null, overview: "", vote_average: 6, genre_ids: [27] }));

beforeEach(() => {
  localStorage.clear();
  clearTmdbCache();
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const u = String(url);
    const page = Number((u.match(/[?&]page=(\d+)/) || [])[1] || 1);
    if (u.includes("/discover/movie")) return { ok: true, status: 200, json: async () => ({ results: list([1, 2, 3], (page - 1) * 10), total_pages: 5 }) };
    return { ok: true, status: 200, json: async () => ({ results: [] }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("touchMessage", () => {
  const film = { id: 1, title: "Alien" };
  it("says where a rated film went", () => {
    expect(touchMessage({ ...film, rating: 4 }, {}).text).toBe(`Rated Alien 4★ and added it to your library. Find it in ${LIBRARY_PLACE}.`);
    expect(touchMessage({ ...film, rating: 4 }, { inLibrary: true }).text).toBe(`Rated Alien 4★. Find it in ${LIBRARY_PLACE}.`);
  });
  it("says where a watchlisted film went", () => {
    expect(touchMessage({ ...film, watchlist: true }, {}).text).toBe(`Added Alien to your watchlist. Find it in ${WATCHLIST_PLACE}.`);
    expect(touchMessage({ ...film, watchlist: true }, { onWatchlist: true, inLibrary: true })).toBeNull();
  });
  it("says a watch was logged", () => {
    expect(touchMessage({ ...film, watchedDates: ["2026-01-01T00:00:00.000Z"] }, { inLibrary: true }).text).toContain("Logged Alien as watched");
  });
  it("says when a film is added to the library, once", () => {
    expect(touchMessage({ ...film, scares: 7 }, {}).text).toBe(`Added Alien to your library. Find it in ${LIBRARY_PLACE}.`);
    expect(touchMessage({ ...film, scares: 7 }, { inLibrary: true })).toBeNull(); // dragging the slider on one you own
  });
  it("stays quiet when the rating didn't change", () => {
    expect(touchMessage({ ...film, rating: 3 }, { rating: 3, inLibrary: true })).toBeNull();
  });
});

// A stand-in for the app: rating a film puts it in the library, as the real one does.
function Harness({ screen: Screen = "roulette" }) {
  const [ratings, setRatings] = useState({});
  const [inLib, setInLib] = useState(new Set());
  const [onList, setOnList] = useState(new Set());
  const onAdd = (it) => {
    if (it.rating > 0) setRatings((r) => ({ ...r, [it.id]: it.rating }));
    setInLib((s) => new Set(s).add(it.id));
    if (it.watchlist) setOnList((s) => new Set(s).add(it.id));
  };
  const common = { apiKey: "tok", onAdd, onOpenDetails: () => {}, inLibraryIds: inLib, watchlistIds: onList };
  return (
    <ToastProvider>
      {Screen === "roulette" ? <RatingRoulette {...common} ratingMap={ratings} /> : <Discover {...common} ratingById={ratings} onRemove={() => {}} onToggleWatchlist={() => {}} />}
    </ToastProvider>
  );
}
const titles = () => screen.queryAllByTitle("Open details").filter((n) => n.textContent.trim()).map((n) => n.textContent.replace(/\s*\(\d{4}\).*$/, ""));
const knife = (n) => screen.getAllByLabelText("Star rating")[0].querySelectorAll("button")[n - 1];

describe("Rating Roulette keeps a card you've touched", () => {
  it("doesn't make a rated card disappear, and says where it went", async () => {
    render(<Harness />);
    await waitFor(() => expect(titles()).toEqual(["Movie 1", "Movie 2", "Movie 3"]), WAIT);
    fireEvent.click(knife(4)); // rate Movie 1 four stars while 'Hide already rated' is on (the default)
    expect(await screen.findByText(`Rated Movie 1 4★ and added it to your library. Find it in ${LIBRARY_PLACE}.`, {}, WAIT)).toBeTruthy();
    expect(titles()).toEqual(["Movie 1", "Movie 2", "Movie 3"]); // still there to change your mind
    fireEvent.click(knife(5)); // and change the rating
    expect(await screen.findByText(/Rated Movie 1 5★/, {}, WAIT)).toBeTruthy();
    expect(titles()).toContain("Movie 1");
  });

  it("says it once per change, not on every redraw", async () => {
    render(<Harness />);
    await waitFor(() => expect(titles().length).toBe(3), WAIT);
    fireEvent.click(knife(4));
    fireEvent.click(knife(4)); // the same rating again
    await screen.findByText(/Rated Movie 1 4★/, {}, WAIT);
    expect(screen.getAllByText(/Rated Movie 1 4★/)).toHaveLength(1);
  });

  it("applies the filter again on the next page", async () => {
    render(<Harness />);
    await waitFor(() => expect(titles().length).toBe(3), WAIT);
    fireEvent.click(knife(3));
    await screen.findByText(/Rated Movie 1 3★/, {}, WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(titles()).toEqual(["Movie 11", "Movie 12", "Movie 13"]), WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    await waitFor(() => expect(titles()).toEqual(["Movie 2", "Movie 3"]), WAIT); // the rated one is filtered out now
  });
});

describe("Discover keeps a card you've touched too", () => {
  it("stays visible with 'Skip titles in library' on, and says where it went", async () => {
    localStorage.setItem("horrorhub.prefs.v1", JSON.stringify({ version: 1, values: { "discover.hideInLibrary": true } }));
    render(<Harness screen="discover" />);
    await waitFor(() => expect(titles()).toEqual(["Movie 1", "Movie 2", "Movie 3"]), WAIT);
    fireEvent.click(screen.getAllByRole("button", { name: "Add" })[0]);
    expect(await screen.findByText(`Added Movie 1 to your library. Find it in ${LIBRARY_PLACE}.`, {}, WAIT)).toBeTruthy();
    expect(titles()).toContain("Movie 1");
  });
});
