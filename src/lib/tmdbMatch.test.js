import { afterEach, describe, expect, it, vi } from "vitest";
import { findTmdbMatch, imdbIdOf, isImported, isUnmatched, matchFields, needsMatching, pickBestMatch, relinkItem, searchTmdb } from "./tmdbMatch.js";
import { clearTmdbCache, TmdbError } from "./tmdb.js";
import { normalizeItem } from "./library.js";

const NOW = new Date("2025-10-15T12:00:00Z");
const alien = { id: 348, title: "Alien", original_title: "Alien", release_date: "1979-05-25", poster_path: "/alien.jpg", overview: "In space...", popularity: 60 };
const remake = { id: 999, title: "Alien", original_title: "Alien", release_date: "2003-01-01", popularity: 5 };
const item = (extra = {}) => normalizeItem({ id: "letterboxd:Alien:1979", title: "Alien", year: 1979, rating: 4.5, tags: ["sci-horror"], watchedDates: ["2024-10-01T00:00:00.000Z"], notes: "so good", ...extra });

describe("classifying imported films", () => {
  it("recognizes imported, unmatched and to-be-matched films", () => {
    expect(isImported({ id: "letterboxd:X:2000" })).toBe(true);
    expect(isImported({ id: "imdb:tt1" })).toBe(true);
    expect(isImported({ id: 348 })).toBe(false);
    expect(needsMatching({ id: "imdb:tt1" })).toBe(true);
    expect(needsMatching({ id: "imdb:tt1", tmdbMatchTriedAt: "2025-01-01T00:00:00.000Z" })).toBe(false);
    expect(isUnmatched({ id: "imdb:tt1", tmdbMatchTriedAt: "2025-01-01T00:00:00.000Z" })).toBe(true);
    expect(isUnmatched({ id: 348, tmdbMatchTriedAt: "2025-01-01T00:00:00.000Z" })).toBe(false);
  });

  it("finds the IMDb id from the id or a stored field", () => {
    expect(imdbIdOf({ id: "imdb:tt0078748" })).toBe("tt0078748");
    expect(imdbIdOf({ id: "letterboxd:Alien:1979", imdbId: "tt0078748" })).toBe("tt0078748");
    expect(imdbIdOf({ id: "imdb:Alien:1979" })).toBeNull();
    expect(imdbIdOf({ id: 348 })).toBeNull();
  });
});

describe("pickBestMatch", () => {
  it("needs an exact title and a release year within one of yours", () => {
    expect(pickBestMatch({ title: "Alien", year: 1979 }, [remake, alien]).id).toBe(348);
    expect(pickBestMatch({ title: "Alien", year: 1980 }, [alien]).id).toBe(348); // regional release dates differ by a year
    expect(pickBestMatch({ title: "Alien", year: 1990 }, [alien, remake])).toBeNull();
    expect(pickBestMatch({ title: "Aliens", year: 1979 }, [alien])).toBeNull(); // not the same title
  });

  it("ignores case and punctuation, and can match the original title", () => {
    expect(pickBestMatch({ title: "the texas chain saw massacre", year: 1974 }, [{ id: 1, title: "The Texas Chain Saw Massacre", release_date: "1974-10-01" }]).id).toBe(1);
    expect(pickBestMatch({ title: "Nosferatu, eine Symphonie des Grauens", year: 1922 }, [{ id: 2, title: "Nosferatu", original_title: "Nosferatu, eine Symphonie des Grauens", release_date: "1922-03-04" }]).id).toBe(2);
  });

  it("prefers the closest year, then the more popular film", () => {
    const a = { id: 1, title: "Twin", release_date: "2000-01-01", popularity: 1 };
    const b = { id: 2, title: "Twin", release_date: "2001-01-01", popularity: 99 };
    expect(pickBestMatch({ title: "Twin", year: 2000 }, [a, b]).id).toBe(1);
    expect(pickBestMatch({ title: "Twin", year: 2000.5 }, [a, b]).id).toBe(2);
  });

  it("without a year only accepts a single unambiguous exact match", () => {
    expect(pickBestMatch({ title: "Alien" }, [alien]).id).toBe(348);
    expect(pickBestMatch({ title: "Alien" }, [alien, remake])).toBeNull();
    expect(pickBestMatch({ title: "" }, [alien])).toBeNull();
    expect(pickBestMatch({ title: "Alien", year: 1979 }, [])).toBeNull();
  });
});

describe("relinkItem", () => {
  it("swaps in the TMDb id and metadata but keeps everything you entered", () => {
    const { library, merged } = relinkItem([item()], "letterboxd:Alien:1979", alien, { now: NOW });
    expect(merged).toBe(false);
    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({
      id: 348, title: "Alien", year: 1979, poster: "/alien.jpg", overview: "In space...", releaseDate: "1979-05-25",
      rating: 4.5, tags: ["sci-horror"], notes: "so good", tmdbMatchedAt: NOW.toISOString(),
    });
    expect(library[0].watchedDates).toEqual(["2024-10-01T00:00:00.000Z"]);
    expect(library[0].taggedAt).toBeUndefined(); // queued for auto-tagging
  });

  it("keeps the film's position in the library and leaves others alone", () => {
    const other = normalizeItem({ id: 5, title: "Other" });
    const { library } = relinkItem([other, item(), normalizeItem({ id: 6, title: "Last" })], "letterboxd:Alien:1979", alien, { now: NOW });
    expect(library.map((i) => i.id)).toEqual([5, 348, 6]);
  });

  it("remembers the IMDb id when the import came from IMDb", () => {
    const imdb = item({ id: "imdb:tt0078748" });
    expect(relinkItem([imdb], "imdb:tt0078748", alien, { now: NOW }).library[0].imdbId).toBe("tt0078748");
  });

  it("merges into a film you already have, combining tags and watch dates without losing either", () => {
    const existing = normalizeItem({ id: 348, title: "Alien", year: 1979, rating: 0, tags: ["classic"], watchedDates: ["2023-05-05T00:00:00.000Z"], watchlist: true });
    const { library, merged } = relinkItem([existing, item()], "letterboxd:Alien:1979", alien, { now: NOW });
    expect(merged).toBe(true);
    expect(library).toHaveLength(1);
    expect(library[0].id).toBe(348);
    expect(library[0].rating).toBe(4.5); // your imported rating fills the blank
    expect(library[0].tags.sort()).toEqual(["classic", "sci-horror"]);
    expect(library[0].watchedDates).toHaveLength(2);
    expect(library[0].notes).toBe("so good");
    expect(library[0].watchlist).toBe(true); // the imported copy's default (false) doesn't drop it
  });

  it("changes nothing for an unknown film", () => {
    const lib = [item()];
    expect(relinkItem(lib, "nope", alien).library).toBe(lib);
    expect(relinkItem(lib, "letterboxd:Alien:1979", {}).library).toBe(lib);
  });

  it("extracts only the fields it copies", () => {
    expect(matchFields(alien)).toEqual({ id: 348, title: "Alien", year: 1979, poster: "/alien.jpg", overview: "In space...", releaseDate: "1979-05-25" });
  });
});

describe("network: findTmdbMatch / searchTmdb", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearTmdbCache();
  });
  const ok = (body) => ({ ok: true, status: 200, json: async () => body });

  it("resolves an IMDb id exactly with /find", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ movie_results: [alien] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findTmdbMatch({ id: "imdb:tt0078748", title: "Whatever" }, { apiKey: "k" })).toBe(alien);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/find/tt0078748?external_source=imdb_id");
  });

  it("searches by title and year, then relaxes the year filter, then drops it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ results: [] }))
      .mockResolvedValueOnce(ok({ results: [] }))
      .mockResolvedValueOnce(ok({ results: [alien] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findTmdbMatch({ id: "letterboxd:Alien:1979", title: "Alien", year: 1979 }, { apiKey: "k" })).toBe(alien);
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls[0]).toContain("primary_release_year=1979");
    expect(urls[1]).toContain("&year=1979");
    expect(urls[2]).not.toContain("year=");
  });

  it("falls back to a title search when an IMDb id isn't a film TMDb knows", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok({ movie_results: [] })).mockResolvedValueOnce(ok({ results: [alien] }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await findTmdbMatch({ id: "imdb:tt0078748", title: "Alien", year: 1979 }, { apiKey: "k" })).toBe(alien);
  });

  it("returns null when nothing is confident, and propagates TMDb errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ results: [remake] })));
    expect(await findTmdbMatch({ id: "letterboxd:Alien:1979", title: "Alien", year: 1979 }, { apiKey: "k" })).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    await expect(findTmdbMatch({ id: "letterboxd:X:2000", title: "X", year: 2000 }, { apiKey: "k" })).rejects.toBeInstanceOf(TmdbError);
  });

  it("free-text search returns at most eight results and nothing for a blank query", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ results: Array.from({ length: 20 }, (_, i) => ({ id: i, title: `T${i}` })) })));
    expect(await searchTmdb("alien", { apiKey: "k" })).toHaveLength(8);
    expect(await searchTmdb("  ", { apiKey: "k" })).toEqual([]);
  });
});
