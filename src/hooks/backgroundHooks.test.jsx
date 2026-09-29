// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLibrary } from "./useLibrary.js";
import { useImportMatcher } from "./useImportMatcher.js";
import { useAutoTagger } from "./useAutoTagger.js";
import { LIBRARY_KEY } from "../lib/library.js";
import { clearTmdbCache } from "../lib/tmdb.js";

// These run the real hooks (effects, async loops, state updates) against a
// stubbed TMDb, which is where restart-on-every-render and dropped-completion
// bugs live.

const seed = (items) => localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 3, items }));
const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const WAIT = { timeout: 4000 };

const alien = { id: 348, title: "Alien", original_title: "Alien", release_date: "1979-05-25", poster_path: "/alien.jpg", overview: "In space...", popularity: 50 };
const thing = { id: 1091, title: "The Thing", original_title: "The Thing", release_date: "1982-06-25", poster_path: "/thing.jpg", overview: "Antarctica.", popularity: 40 };

function stubTmdb(handler) {
  const fetchMock = vi.fn(async (url) => {
    const out = handler(String(url));
    return out.ok === false ? out : ok(out);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
  clearTmdbCache();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useImportMatcher", () => {
  const setup = (options = {}) => {
    const onDone = vi.fn();
    const onProblem = vi.fn();
    const hook = renderHook(() => {
      const lib = useLibrary();
      const matcher = useImportMatcher({ ...lib, apiKey: "tok", enabled: true, onDone, onProblem, ...options });
      return { lib, matcher };
    });
    return { ...hook, onDone, onProblem };
  };
  const ids = (result) => result.current.lib.library.map((i) => i.id);

  it("links Letterboxd and IMDb imports to TMDb, keeping what you entered, and reports once", async () => {
    seed([
      { id: "letterboxd:Alien:1979", title: "Alien", year: 1979, rating: 4.5, notes: "so good", tags: ["classic"], watchedDates: ["2024-10-01T00:00:00.000Z"] },
      { id: "imdb:tt0084787", title: "The Thing", year: 1982, rating: 5 },
    ]);
    const fetchMock = stubTmdb((url) => (url.includes("/find/tt0084787") ? { movie_results: [thing] } : { results: [alien] }));
    const { result, onDone } = setup();

    await waitFor(() => expect([...ids(result)].sort((a, b) => a - b)).toEqual([348, 1091]), WAIT);
    const linked = result.current.lib.library.find((i) => i.id === 348);
    expect(linked).toMatchObject({ title: "Alien", poster: "/alien.jpg", rating: 4.5, notes: "so good", tags: ["classic"] });
    expect(linked.watchedDates).toHaveLength(1);
    expect(result.current.lib.library.find((i) => i.id === 1091)).toMatchObject({ imdbId: "tt0084787", rating: 5 });

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1), WAIT);
    expect(onDone).toHaveBeenCalledWith({ matched: 2, failed: 0 });
    expect(result.current.matcher.pending).toBe(0);
    const calls = fetchMock.mock.calls.length;
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(fetchMock.mock.calls.length).toBe(calls); // nothing left to do, nothing re-fetched
  });

  it("marks films it can't place as tried (and doesn't retry them)", async () => {
    seed([{ id: "letterboxd:Obscure Film:1971", title: "Obscure Film", year: 1971, rating: 3 }]);
    const fetchMock = stubTmdb(() => ({ results: [] }));
    const { result, onDone } = setup();

    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ matched: 0, failed: 1 }), WAIT);
    const film = result.current.lib.library[0];
    expect(film.id).toBe("letterboxd:Obscure Film:1971");
    expect(film.tmdbMatchTriedAt).toBeTruthy();
    const calls = fetchMock.mock.calls.length;
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("merges into a film you already have instead of duplicating it", async () => {
    seed([
      { id: 348, title: "Alien", year: 1979, tags: ["sci-horror"], watchlist: true },
      { id: "letterboxd:Alien:1979", title: "Alien", year: 1979, rating: 4, watchedDates: ["2024-10-01T00:00:00.000Z"] },
    ]);
    stubTmdb(() => ({ results: [alien] }));
    const { result, onDone } = setup();

    await waitFor(() => expect(onDone).toHaveBeenCalled(), WAIT);
    expect(ids(result)).toEqual([348]);
    expect(result.current.lib.library[0]).toMatchObject({ rating: 4, watchlist: true, tags: ["sci-horror"] });
    expect(result.current.lib.library[0].watchedDates).toHaveLength(1);
  });

  it("pauses with a message on a bad token and leaves the films to try later", async () => {
    seed([{ id: "letterboxd:Alien:1979", title: "Alien", year: 1979 }]);
    stubTmdb(() => ({ ok: false, status: 401, json: async () => ({}) }));
    const { result, onProblem, onDone } = setup();

    await waitFor(() => expect(onProblem).toHaveBeenCalledTimes(1), WAIT);
    expect(onProblem.mock.calls[0][0]).toMatch(/token/i);
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.lib.library[0].id).toBe("letterboxd:Alien:1979");
    expect(result.current.matcher.pending).toBe(1);
  });

  it("does nothing when disabled or when there's no token", async () => {
    seed([{ id: "letterboxd:Alien:1979", title: "Alien", year: 1979 }]);
    const fetchMock = stubTmdb(() => ({ results: [alien] }));
    setup({ enabled: false });
    setup({ apiKey: "" });
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useAutoTagger", () => {
  const meta = (extra = {}) => ({
    title: "Halloween", overview: "A masked killer stalks babysitters.", runtime: 91, release_date: "1978-10-25",
    genres: [{ id: 27 }], keywords: { keywords: [{ name: "slasher" }, { name: "masked killer" }, { name: "babysitter" }] }, ...extra,
  });
  const setup = (options = {}) =>
    renderHook(() => {
      const lib = useLibrary();
      const tagger = useAutoTagger({ ...lib, apiKey: "tok", enabled: true, ...options });
      return { lib, tagger };
    });

  it("tags an untagged film once, from TMDb data, and stays put across re-renders", async () => {
    seed([{ id: 948, title: "Halloween", year: 1978 }]);
    const fetchMock = stubTmdb(() => meta());
    const { result, rerender } = setup();

    await waitFor(() => expect(result.current.lib.library[0].taggedAt).toBeTruthy(), WAIT);
    const film = result.current.lib.library[0];
    expect(film.tags).toEqual(expect.arrayContaining(["slasher", "classic"]));
    expect(film.autoTags).toEqual(expect.arrayContaining(["slasher"]));
    expect(film).toMatchObject({ runtime: 91 });
    expect(film.keywords).toContain("masked killer");

    rerender();
    rerender();
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(fetchMock).toHaveBeenCalledTimes(1); // one request total: the loop didn't restart per render
  });

  it("never re-adds a tag you removed and never touches tags you typed", async () => {
    seed([{ id: 948, title: "Halloween", year: 1978, tags: ["my-favorite"], removedTags: ["slasher"] }]);
    stubTmdb(() => meta());
    const { result } = setup();

    await waitFor(() => expect(result.current.lib.library[0].taggedAt).toBeTruthy(), WAIT);
    const film = result.current.lib.library[0];
    expect(film.tags).toContain("my-favorite");
    expect(film.tags).not.toContain("slasher");
    expect(film.autoTags).not.toContain("my-favorite");
  });

  it("flags content from the same request", async () => {
    seed([{ id: 1, title: "Rough One", year: 2010 }]);
    stubTmdb(() => meta({ keywords: { keywords: [{ name: "torture" }, { name: "animal cruelty" }] } }));
    const { result } = setup();
    await waitFor(() => expect(result.current.lib.library[0].taggedAt).toBeTruthy(), WAIT);
    expect(result.current.lib.library[0].contentFlags).toEqual(expect.arrayContaining(["torture", "animal-harm"]));
  });

  it("tags films from local data when TMDb has no record (404) rather than retrying forever", async () => {
    seed([{ id: 5, title: "Lost Film", year: 1975, overview: "A camcorder captures the truth." }]);
    stubTmdb(() => ({ ok: false, status: 404, json: async () => ({}) }));
    const { result } = setup();
    await waitFor(() => expect(result.current.lib.library[0].taggedAt).toBeTruthy(), WAIT);
    expect(result.current.lib.library[0].tags).toEqual(expect.arrayContaining(["found-footage", "classic"]));
  });

  it("pauses with a message on rate limiting", async () => {
    seed([{ id: 1, title: "A", year: 2000 }, { id: 2, title: "B", year: 2000 }]);
    const fetchMock = stubTmdb(() => ({ ok: false, status: 429, json: async () => ({}) }));
    const onProblem = vi.fn();
    const { result } = setup({ onProblem });
    await waitFor(() => expect(onProblem).toHaveBeenCalledTimes(1), WAIT);
    expect(onProblem.mock.calls[0][0]).toMatch(/rate limiting/i);
    expect(fetchMock).toHaveBeenCalledTimes(1); // stopped, didn't hammer the API
    expect(result.current.lib.library.every((i) => !i.taggedAt)).toBe(true);
  });

  it("skips films TMDb can't look up (text ids) and does nothing when disabled", async () => {
    seed([{ id: "letterboxd:X:2000", title: "X", year: 2000 }]);
    const fetchMock = stubTmdb(() => meta());
    setup();
    setup({ enabled: false });
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
