import { afterEach, describe, expect, it, vi } from "vitest";
import { clearTmdbCache, describeError, mapMovie, parseProviders, TmdbError, tmdbGet } from "./tmdb.js";

const okJson = (body) => ({ ok: true, status: 200, json: async () => body });

describe("mapMovie", () => {
  it("maps a TMDb row and carries no library-owned fields", () => {
    const item = mapMovie({ id: 9, title: "X", release_date: "1999-05-01", poster_path: "/p.jpg", overview: "o", vote_average: 7.1 });
    expect(item).toEqual({ id: 9, title: "X", year: 1999, poster: "/p.jpg", overview: "o", voteAvg: 7.1 });
    // these would be written to your library on add and overwrite existing data
    for (const key of ["watchedDates", "tags", "addedAt", "rating"]) expect(item).not.toHaveProperty(key);
  });

  it("tolerates missing fields", () => {
    expect(mapMovie({ id: 1, title: "Y" })).toMatchObject({ id: 1, year: undefined, voteAvg: undefined });
  });
});

describe("parseProviders", () => {
  it("collects known US streaming services once, from flatrate and ad tiers", () => {
    const data = {
      results: {
        US: {
          flatrate: [{ provider_name: "Netflix" }, { provider_name: "Amazon Prime Video" }, { provider_name: "Some Other" }],
          ads: [{ provider_name: "Hulu" }, { provider_name: "Netflix Basic with Ads" }],
        },
      },
    };
    expect(parseProviders(data).sort()).toEqual(["hulu", "netflix", "prime"]);
  });

  it("returns an empty list when there is no US data", () => {
    expect(parseProviders({})).toEqual([]);
    expect(parseProviders(null)).toEqual([]);
  });
});

describe("describeError", () => {
  it("uses TmdbError messages and a generic fallback", () => {
    expect(describeError(new TmdbError("auth"))).toMatch(/token/i);
    expect(describeError(new Error("boom"))).toMatch(/something went wrong/i);
  });
});

describe("tmdbGet cacheMs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearTmdbCache();
  });

  it("reuses a response within the window and refetches for a different token or after clearing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await tmdbGet("/a", { apiKey: "k1", cacheMs: 60_000 });
    await tmdbGet("/a", { apiKey: "k1", cacheMs: 60_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await tmdbGet("/a", { apiKey: "k2", cacheMs: 60_000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    clearTmdbCache();
    await tmdbGet("/a", { apiKey: "k1", cacheMs: 60_000 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not cache when cacheMs is omitted or when the request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okJson({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await tmdbGet("/b", { apiKey: "k" });
    await tmdbGet("/b", { apiKey: "k" });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const failing = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal("fetch", failing);
    await expect(tmdbGet("/c", { apiKey: "k", cacheMs: 60_000 })).rejects.toBeInstanceOf(TmdbError);
    await expect(tmdbGet("/c", { apiKey: "k", cacheMs: 60_000 })).rejects.toBeInstanceOf(TmdbError);
    expect(failing).toHaveBeenCalledTimes(2);
  });
});
