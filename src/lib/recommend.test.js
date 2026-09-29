import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSeedResults, pickSeeds, rankCandidates, slimResult } from "./recommend.js";
import { TmdbError, tmdbGet } from "./tmdb.js";
import { moodTextHits } from "./moods.js";
import { ownedTitleKeys } from "./library.js";
import { buildTasteProfile } from "./taste.js";

const NOW = new Date("2025-10-15T12:00:00Z").getTime();

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), _map: map };
}
const okJson = (body) => ({ ok: true, status: 200, json: async () => body });
const failWith = (status) => ({ ok: false, status, json: async () => ({}) });

const cand = (id, extra = {}) => ({
  id, title: `Film ${id}`, year: "2020", releaseDate: "2020-01-01", poster: `/p${id}.jpg`, overview: "", voteAvg: 7, voteCount: 500, genreIds: [27], ...extra,
});

describe("pickSeeds", () => {
  const item = (id, rating, extra = {}) => ({ id, title: `T${id}`, rating, watchedDates: [], ...extra });

  it("uses only numeric-id titles rated 4+, best first, capped", () => {
    const items = [item(1, 5), item(2, 4), item("letterboxd:X:2000", 5), item(3, 3), item(4, 4.5), item(5, 4), item(6, 4), item(7, 4)];
    const seeds = pickSeeds(items, { max: 3, now: NOW });
    expect(seeds.map((s) => s.id)).toEqual([1, 4, 2]);
  });

  it("falls back to 3+ when nothing is rated 4+", () => {
    expect(pickSeeds([item(1, 3), item(2, 2)], { now: NOW }).map((s) => s.id)).toEqual([1]);
    expect(pickSeeds([item(1, 2)], { now: NOW })).toEqual([]);
  });

  it("uses tags: a favorite that matches your taste beats an equally rated one that doesn't, and seeds are spread", () => {
    const profile = buildTasteProfile(
      [1, 2, 3].map((i) => item(100 + i, 5, { tags: ["occult"], watchedDates: ["2025-09-01T00:00:00.000Z"] })),
      { now: NOW }
    );
    const items = [
      item(1, 4.5, { tags: ["occult"] }),
      item(2, 4.5, { tags: ["occult"] }),
      item(3, 4.5, { tags: ["comedy"] }),
    ];
    // without taste they tie on rating; with it the occult ones lead, but the third slot still differs
    expect(pickSeeds(items, { now: NOW, profile, max: 1 }).map((s) => s.id)).toEqual([1]);
    const two = pickSeeds(items, { now: NOW, profile, max: 2 }).map((s) => s.id);
    expect(two).toContain(3); // diversity: not two occult films when a different subgenre is close
  });

  it("gives a recent watch a small edge over an old one at the same rating", () => {
    const recent = item(1, 4, { watchedDates: ["2025-10-01T00:00:00.000Z"] });
    const old = item(2, 4, { watchedDates: ["2019-01-01T00:00:00.000Z"] });
    expect(pickSeeds([old, recent], { now: NOW }).map((s) => s.id)).toEqual([1, 2]);
  });
});

describe("rankCandidates", () => {
  const seeds = [{ id: 10, title: "Hereditary", weight: 1 }, { id: 20, title: "The Thing", weight: 0.8 }];

  it("keeps only released horror titles you don't own", () => {
    const resultsBySeed = {
      10: [cand(1), cand(2, { genreIds: [35] }), cand(3, { releaseDate: "2030-01-01" }), cand(4)],
    };
    const picks = rankCandidates({ seeds, resultsBySeed, libraryIds: [4], now: NOW });
    expect(picks.map((p) => p.id)).toEqual([1]);
  });

  it("accumulates score for films suggested by several seeds and names the strongest seed", () => {
    const resultsBySeed = { 10: [cand(1), cand(2)], 20: [cand(2), cand(3)] };
    const picks = rankCandidates({ seeds, resultsBySeed, libraryIds: [], now: NOW });
    expect(picks[0].id).toBe(2);
    expect(picks.find((p) => p.id === 2).reason).toBe("Because you liked Hereditary and 1 other favorite");
    expect(picks.find((p) => p.id === 1).reason).toBe("Because you liked Hereditary");
  });

  it("treats a film you imported from Letterboxd/IMDb (string id) as already seen", () => {
    const resultsBySeed = { 10: [cand(1, { title: "Hereditary", year: "2018" }), cand(2, { title: "Other", year: "2020" })] };
    const libraryKeys = ownedTitleKeys([{ id: "letterboxd:Hereditary:2018", title: "Hereditary", year: 2018 }]);
    const picks = rankCandidates({ seeds, resultsBySeed, libraryIds: [], libraryKeys, now: NOW });
    expect(picks.map((p) => p.id)).toEqual([2]);
  });

  it("drops the same film listed under two TMDb ids", () => {
    const resultsBySeed = { 10: [cand(1, { title: "Twin", year: "2019" }), cand(2, { title: "Twin", year: "2019" }), cand(3)] };
    const picks = rankCandidates({ seeds, resultsBySeed, libraryIds: [], now: NOW });
    expect(picks.filter((p) => p.title === "Twin")).toHaveLength(1);
  });

  it("leans toward the moods you love and says so, without hiding other films", () => {
    const profile = { lovedMoods: [{ id: "occult", label: "Occult", score: 0.6 }] };
    const resultsBySeed = {
      10: [cand(1, { overview: "A quiet family drama." }), cand(2, { overview: "A cult performs a ritual to summon a demon." })],
    };
    const neutral = rankCandidates({ seeds, resultsBySeed, libraryIds: [], now: NOW });
    expect(neutral[0].id).toBe(1);
    const tasted = rankCandidates({ seeds, resultsBySeed, libraryIds: [], profile, now: NOW });
    expect(tasted.map((p) => p.id)).toEqual([2, 1]);
    expect(tasted[0].reasons).toContain("Leans Occult, like your favorites");
    expect(tasted[1].reasons).toEqual(["Because you liked Hereditary"]);
  });

  it("explains a mood match", () => {
    const resultsBySeed = { 10: [cand(2, { overview: "A masked killer stalks the campers." })] };
    const [pick] = rankCandidates({ seeds, resultsBySeed, libraryIds: [], moodId: "slasher", now: NOW });
    expect(pick.reasons).toContain("Matches your Slasher vibe");
  });

  it("boosts films matching the chosen mood without hiding others", () => {
    const resultsBySeed = {
      10: [cand(1, { overview: "A family quietly unravels." }), cand(2, { overview: "A masked killer stalks the campers." })],
    };
    const neutral = rankCandidates({ seeds, resultsBySeed, libraryIds: [], now: NOW });
    expect(neutral[0].id).toBe(1);
    const slasher = rankCandidates({ seeds, resultsBySeed, libraryIds: [], moodId: "slasher", now: NOW });
    expect(slasher.map((p) => p.id)).toEqual([2, 1]);
  });

  it("respects the limit and tolerates empty input", () => {
    const many = { 10: Array.from({ length: 30 }, (_, i) => cand(i + 1)) };
    expect(rankCandidates({ seeds, resultsBySeed: many, libraryIds: [], limit: 5, now: NOW })).toHaveLength(5);
    expect(rankCandidates({ seeds: [], resultsBySeed: {}, libraryIds: [] })).toEqual([]);
  });
});

describe("moodTextHits", () => {
  it("counts distinct keyword hits and ignores all/unknown moods", () => {
    expect(moodTextHits("A demon possesses a girl during a ritual", "occult")).toBeGreaterThanOrEqual(3);
    expect(moodTextHits("anything", "all")).toBe(0);
    expect(moodTextHits("anything", "nope")).toBe(0);
  });
});

describe("slimResult", () => {
  it("keeps the poster as a TMDb path, not a full URL", () => {
    const s = slimResult({ id: 1, title: "X", release_date: "2020-05-01", poster_path: "/abc.jpg", genre_ids: [27], vote_average: 6.5, vote_count: 10 });
    expect(s).toMatchObject({ poster: "/abc.jpg", year: "2020", genreIds: [27] });
  });
});

describe("tmdbGet / loadSeedResults", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps HTTP failures to typed errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failWith(401)));
    await expect(tmdbGet("/x", { apiKey: "k" })).rejects.toMatchObject({ kind: "auth" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(failWith(429)));
    await expect(tmdbGet("/x", { apiKey: "k" })).rejects.toMatchObject({ kind: "rate-limit" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(tmdbGet("/x", { apiKey: "k" })).rejects.toBeInstanceOf(TmdbError);
  });

  it("lets aborts through untouched", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));
    await expect(tmdbGet("/x", { apiKey: "k" })).rejects.toBe(abort);
  });

  it("caches a seed's results so a second call doesn't hit the network", async () => {
    vi.stubGlobal("localStorage", fakeStorage());
    const fetchMock = vi.fn().mockResolvedValue(okJson({ results: [{ id: 5, title: "A", genre_ids: [27], poster_path: "/a.jpg" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const first = await loadSeedResults(10, { apiKey: "k", now: NOW });
    const second = await loadSeedResults(10, { apiKey: "k", now: NOW + 1000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(fetchMock.mock.calls[0][0]).toContain("/movie/10/recommendations");
  });

  it("refetches once the cache is a day old", async () => {
    vi.stubGlobal("localStorage", fakeStorage());
    const fetchMock = vi.fn().mockResolvedValue(okJson({ results: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await loadSeedResults(10, { apiKey: "k", now: NOW });
    await loadSeedResults(10, { apiKey: "k", now: NOW + 25 * 60 * 60 * 1000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
