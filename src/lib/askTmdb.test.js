import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { askPath, askTags, fetchAskIdeas } from "./askTmdb.js";
import { parseQuery } from "./query.js";
import { clearTmdbCache } from "./tmdb.js";

const filters = (q) => parseQuery(q, { now: new Date(2026, 5, 1) }).filters;

describe("askTags", () => {
  it("includes the tags behind a mood", () => {
    expect(askTags(filters("slasher atmospheric"))).toEqual(expect.arrayContaining(["slasher", "slow-burn"]));
  });
});

describe("askPath", () => {
  it("carries runtime, dates and keywords into a horror discover request", () => {
    const path = askPath(filters("under 100 minutes from the 80s"), { keywordIds: [11, 22], region: "GB" });
    expect(path).toContain("/discover/movie?");
    expect(path).toContain("with_genres=27");
    expect(path).toContain("with_runtime.lte=100");
    expect(path).toContain("primary_release_date.gte=1980-01-01");
    expect(path).toContain("primary_release_date.lte=1989-12-31");
    expect(path).toContain("with_keywords=11|22");
    expect(path).toContain("region=GB");
  });
  it("carries a minimum runtime", () => {
    expect(askPath(filters("over 2 hours"))).toContain("with_runtime.gte=120");
  });
  it("searches by words when there is a topic", () => {
    expect(askPath(filters("movies about killer clowns"))).toBe("/search/movie?include_adult=false&language=en-US&query=killer%20clowns");
  });
});

describe("fetchAskIdeas", () => {
  let calls;
  const respond = (routes) =>
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      calls.push(String(url));
      const hit = Object.entries(routes).find(([k]) => String(url).includes(k));
      return { ok: true, status: 200, json: async () => (hit ? hit[1] : { results: [] }) };
    }));
  beforeEach(() => { calls = []; clearTmdbCache(); });
  afterEach(() => vi.unstubAllGlobals());

  const movie = (id, title, year, extra = {}) => ({ id, title, release_date: `${year}-05-01`, genre_ids: [27], poster_path: null, overview: "", vote_average: 7, ...extra });

  it("looks up keywords for the subgenres and returns films you don't own", async () => {
    respond({ "/search/keyword": { results: [{ id: 5, name: "folk horror" }] }, "/discover/movie": { results: [movie(1, "New One", 2019), movie(2, "Owned", 2018)] } });
    const r = await fetchAskIdeas(filters("folk horror"), { apiKey: "t", library: [{ id: 2, title: "Owned", year: 2018 }] });
    expect(r.films.map((m) => m.title)).toEqual(["New One"]);
    expect(calls.some((c) => c.includes("with_keywords=5"))).toBe(true);
  });
  it("recognises an owned film by title and year even under another id", async () => {
    respond({ "/search/keyword": { results: [{ id: 5, name: "slasher" }] }, "/discover/movie": { results: [movie(1, "Halloween", 1978)] } });
    const r = await fetchAskIdeas(filters("slasher"), { apiKey: "t", library: [{ id: "letterboxd:Halloween:1978", title: "Halloween", year: 1978 }] });
    expect(r.films).toEqual([]);
    expect(r.note).toMatch(/nothing new/);
  });
  it("says so when TMDb has no keyword for the subgenre rather than showing generic horror", async () => {
    respond({ "/search/keyword": { results: [] } });
    const r = await fetchAskIdeas(filters("slasher"), { apiKey: "t" });
    expect(r.films).toEqual([]);
    expect(r.note).toMatch(/nothing to search/i);
    expect(calls.some((c) => c.includes("/discover/movie"))).toBe(false);
  });
  it("needs no keywords for a plain length or decade request", async () => {
    respond({ "/discover/movie": { results: [movie(1, "Short", 1985)] } });
    const r = await fetchAskIdeas(filters("under 90 minutes from the 80s"), { apiKey: "t" });
    expect(r.films).toHaveLength(1);
    expect(calls.some((c) => c.includes("/search/keyword"))).toBe(false);
  });
  it("on a topic search, keeps only horror and respects the years asked for", async () => {
    respond({ "/search/movie": { results: [movie(1, "Horror Clowns", 2016), movie(2, "Comedy Clowns", 2016, { genre_ids: [35] }), movie(3, "Old Clowns", 1990)] } });
    const r = await fetchAskIdeas(filters("about clowns after 2010"), { apiKey: "t" });
    expect(r.films.map((m) => m.title)).toEqual(["Horror Clowns"]);
  });
  it("respects the limit", async () => {
    respond({ "/discover/movie": { results: Array.from({ length: 30 }, (_, i) => movie(i + 1, `F${i}`, 2010)) } });
    expect((await fetchAskIdeas(filters("under 2 hours"), { apiKey: "t", limit: 5 })).films).toHaveLength(5);
  });
});
