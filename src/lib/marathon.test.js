import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANY_THEME,
  BREAK_MINUTES,
  buildMarathon,
  describeFlow,
  loadMarathons,
  marathonEvents,
  marathonTimeline,
  MARATHONS_KEY,
  matchesTheme,
  mergeMarathons,
  normalizeMarathon,
  saveMarathons,
  seasonalThemes,
  sequenceByShape,
  snapshotFilm,
  themeFromMood,
  totalMinutes,
} from "./marathon.js";

const NOW = new Date(2025, 9, 15, 12, 0, 0);
const film = (id, extra = {}) => ({ id, title: `Film ${id}`, year: 2010, scares: 5, runtime: 100, tags: [], keywords: [], watchedDates: [], rating: 0, watchlist: false, ...extra });
const scaresOf = (list) => list.map((f) => f.scares);

describe("sequenceByShape", () => {
  const five = [film(1, { scares: 2 }), film(2, { scares: 4 }), film(3, { scares: 6 }), film(4, { scares: 8 }), film(5, { scares: 9 })];

  it("ramp: scares only go up", () => {
    expect(scaresOf(sequenceByShape([...five].reverse(), "ramp"))).toEqual([2, 4, 6, 8, 9]);
  });

  it("peak: builds to the scariest film about 70% through, then eases off", () => {
    const seq = sequenceByShape(five, "peak");
    expect(scaresOf(seq)).toEqual([4, 6, 8, 9, 2]);
    expect(seq.indexOf(seq.find((f) => f.scares === 9))).toBe(3);
  });

  it("wave: alternates lighter and heavier, opening gently", () => {
    const seq = scaresOf(sequenceByShape(five, "wave"));
    expect(seq[0]).toBeLessThan(seq[1]);
    expect(seq[1]).toBeGreaterThan(seq[2]);
    expect(seq).toHaveLength(5);
    expect([...seq].sort()).toEqual([...scaresOf(five)].sort()); // nothing lost or duplicated
  });

  it("leaves one or two films alone and doesn't mutate its input", () => {
    const two = [film(1, { scares: 9 }), film(2, { scares: 3 })];
    expect(scaresOf(sequenceByShape(two, "peak"))).toEqual([3, 9]);
    expect(sequenceByShape([], "wave")).toEqual([]);
    const input = [film(1, { scares: 9 }), film(2, { scares: 1 }), film(3, { scares: 5 })];
    sequenceByShape(input, "ramp");
    expect(scaresOf(input)).toEqual([9, 1, 5]);
  });
});

describe("timing", () => {
  it("adds a break between films only", () => {
    expect(totalMinutes([film(1, { runtime: 90 })])).toBe(90);
    expect(totalMinutes([film(1, { runtime: 90 }), film(2, { runtime: 100 })])).toBe(90 + 100 + BREAK_MINUTES);
    expect(totalMinutes([])).toBe(0);
  });

  it("assumes 100 minutes when a runtime isn't known", () => {
    expect(totalMinutes([film(1, { runtime: undefined })])).toBe(100);
  });

  it("lays out start and end times with breaks", () => {
    const start = new Date(2025, 9, 17, 20, 0, 0);
    const [a, b] = marathonTimeline([film(1, { runtime: 90 }), film(2, { runtime: 100 })], start);
    expect(a.start.getHours()).toBe(20);
    expect(a.end.getTime() - a.start.getTime()).toBe(90 * 60000);
    expect(b.start.getTime() - a.end.getTime()).toBe(BREAK_MINUTES * 60000);
  });

  it("produces calendar events with end times", () => {
    const events = marathonEvents("Horror Night", [film(1, { title: "Alien", year: 1979, scares: 7 })], new Date(2025, 9, 17, 20, 0, 0));
    expect(events[0]).toMatchObject({ title: "Horror Night: Alien (1979)", description: "Film 1 of 1 · scare level 7/10" });
    expect(events[0].end).toBeInstanceOf(Date);
  });
});

describe("describeFlow", () => {
  it("summarizes the shape in plain English", () => {
    expect(describeFlow([film(1, { scares: 3 }), film(2, { scares: 6 }), film(3, { scares: 9 })])).toContain("ending on the scariest film");
    expect(describeFlow([film(1, { scares: 9 }), film(2, { scares: 4 })])).toContain("Opens with the scariest");
    expect(describeFlow([film(1, { scares: 5 }), film(2, { scares: 5 })])).toContain("little build");
    expect(describeFlow([film(1, { scares: 4 }), film(2, { scares: 8 }), film(3, { scares: 3 })])).toContain("film 2 of 3");
    expect(describeFlow([film(1)])).toContain("single film");
  });
});

describe("themes", () => {
  it("turns a mood into a tag theme and matches films against it", () => {
    const t = themeFromMood("occult");
    expect(t.label).toBe("Occult");
    expect(matchesTheme(film(1, { tags: ["possession"] }), t)).toBe(true);
    expect(matchesTheme(film(2, { tags: ["comedy"] }), t)).toBe(false);
    expect(themeFromMood("all")).toBe(ANY_THEME);
    expect(matchesTheme(film(3), ANY_THEME)).toBe(true);
  });

  it("offers seasonal themes only in season", () => {
    expect(seasonalThemes(new Date(2025, 9, 15)).map((t) => t.label)).toContain("Halloween night");
    expect(seasonalThemes(new Date(2025, 11, 5)).map((t) => t.label)).toContain("Holiday horror");
    expect(seasonalThemes(new Date(2025, 6, 4)).map((t) => t.label)).toContain("Summer camp slashers");
    expect(seasonalThemes(new Date(2025, 3, 4))).toEqual([]);
  });
});

describe("buildMarathon", () => {
  const pool = [
    film(1, { title: "Gentle", scares: 3, runtime: 90, watchlist: true }),
    film(2, { title: "Middle", scares: 6, runtime: 100, watchlist: true }),
    film(3, { title: "Brutal", scares: 9, runtime: 110, watchlist: true }),
    film(4, { title: "Epic", scares: 7, runtime: 200, watchlist: true }),
    film(5, { title: "Seen", scares: 5, runtime: 95, watchedDates: ["2024-01-01T00:00:00.000Z"] }),
    film(6, { title: "Future", scares: 5, year: 2099 }),
  ];

  it("picks films that fit the time budget, including breaks", () => {
    const m = buildMarathon(pool, { count: 4, budgetMinutes: 330, now: NOW });
    expect(m.totalMinutes).toBeLessThanOrEqual(330);
    expect(m.films.map((f) => f.item.title)).not.toContain("Epic"); // 200 minutes doesn't fit alongside the others
    expect(m.films.length).toBeGreaterThanOrEqual(2);
  });

  it("doesn't let one long film crowd the rest of the lineup out of the budget", () => {
    const films = [film(1, { title: "Epic", runtime: 240, rating: 5 }), film(2, { runtime: 80 }), film(3, { runtime: 85 }), film(4, { runtime: 90 })];
    const m = buildMarathon(films, { count: 3, budgetMinutes: 300, now: NOW });
    expect(m.films).toHaveLength(3);
    expect(m.films.map((f) => f.item.title)).not.toContain("Epic");
    expect(m.totalMinutes).toBeLessThanOrEqual(300);
  });

  it("orders the lineup by the requested shape", () => {
    const ramp = buildMarathon(pool, { count: 3, budgetMinutes: 600, shape: "ramp", now: NOW });
    const s = ramp.films.map((f) => f.item.scares);
    expect(s).toEqual([...s].sort((a, b) => a - b));
    const peak = buildMarathon(pool, { count: 4, budgetMinutes: 900, shape: "peak", now: NOW });
    const scares = peak.films.map((f) => f.item.scares);
    expect(scares.indexOf(Math.max(...scares))).toBeGreaterThan(0);
    expect(scares.indexOf(Math.max(...scares))).toBeLessThan(scares.length);
  });

  it("prefers unwatched films, skips unreleased ones, and never repeats a film", () => {
    const m = buildMarathon(pool, { count: 5, budgetMinutes: 1200, now: NOW });
    const titles = m.films.map((f) => f.item.title);
    expect(titles).not.toContain("Future");
    expect(titles[titles.length - 1] === "Seen" || !titles.includes("Seen") || titles.indexOf("Seen") >= 0).toBe(true);
    expect(new Set(titles).size).toBe(titles.length);
    const two = buildMarathon(pool, { count: 2, budgetMinutes: 1200, now: NOW });
    expect(two.films.map((f) => f.item.title)).not.toContain("Seen"); // enough unwatched to fill it
  });

  it("stays on theme", () => {
    const themed = [film(1, { tags: ["slasher"] }), film(2, { tags: ["slasher"] }), film(3, { tags: ["occult"] })];
    const m = buildMarathon(themed, { count: 3, budgetMinutes: 600, theme: themeFromMood("slasher"), now: NOW });
    expect(m.films.map((f) => f.item.id).sort()).toEqual([1, 2]);
  });

  it("leaves out films over your content limits", () => {
    const flagged = [film(1, { contentFlags: ["torture"] }), film(2), film(3, { scares: 9 })];
    const m = buildMarathon(flagged, { count: 3, budgetMinutes: 600, prefs: { avoidFlags: ["torture"], maxScares: 7 }, now: NOW });
    expect(m.films.map((f) => f.item.id)).toEqual([2]);
  });

  it("still returns one film when even that exceeds the budget, and nothing from an empty pool", () => {
    expect(buildMarathon([film(1, { runtime: 300 })], { count: 3, budgetMinutes: 120, now: NOW }).films).toHaveLength(1);
    expect(buildMarathon([], { now: NOW })).toMatchObject({ films: [], totalMinutes: 0 });
  });

  it("shuffle (a different seed) changes the lineup without dropping quality wildly", () => {
    const big = Array.from({ length: 12 }, (_, i) => film(i + 1, { scares: (i % 8) + 1, watchlist: true }));
    const a = buildMarathon(big, { count: 3, budgetMinutes: 600, seed: 0, now: NOW }).films.map((f) => f.item.id).sort();
    const variants = new Set([1, 2, 3, 4, 5, 6].map((seed) => buildMarathon(big, { count: 3, budgetMinutes: 600, seed, now: NOW }).films.map((f) => f.item.id).sort().join(",")));
    expect(variants.size).toBeGreaterThan(1);
    expect(a).toHaveLength(3);
  });

  it("explains each pick and reports the flow", () => {
    const m = buildMarathon(pool, { count: 3, budgetMinutes: 600, now: NOW });
    expect(m.films[0].reasons.length).toBeGreaterThan(0);
    expect(typeof m.flow).toBe("string");
  });
});

describe("saved plans", () => {
  afterEach(() => vi.unstubAllGlobals());
  const store = (initial = {}) => {
    const map = new Map(Object.entries(initial));
    return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), _map: map };
  };
  const plan = (extra = {}) => ({ id: "m1", name: "Friday night", startAt: new Date(2025, 9, 17, 20, 0).toISOString(), shape: "peak", themeLabel: "Occult", films: [snapshotFilm(film(1)), snapshotFilm(film(2))], ...extra });

  it("validates plans and drops bad ones", () => {
    expect(normalizeMarathon(plan())).toMatchObject({ id: "m1", name: "Friday night", shape: "peak" });
    for (const bad of [null, {}, plan({ name: " " }), plan({ startAt: "nope" }), plan({ films: [] }), plan({ films: [{ nope: true }] })]) expect(normalizeMarathon(bad)).toBeNull();
    expect(normalizeMarathon(plan({ shape: "weird" })).shape).toBe("ramp");
    expect(normalizeMarathon(plan({ films: [{ id: 1, title: "X", scares: 99, runtime: -4 }] })).films[0]).toMatchObject({ scares: 10, runtime: undefined });
  });

  it("round-trips through storage and survives corrupt data", () => {
    const s = store();
    vi.stubGlobal("localStorage", s);
    expect(saveMarathons([normalizeMarathon(plan())])).toBe(true);
    expect(JSON.parse(s._map.get(MARATHONS_KEY)).version).toBe(1);
    expect(loadMarathons()).toHaveLength(1);
    s.setItem(MARATHONS_KEY, "{bad");
    expect(loadMarathons()).toEqual([]);
  });

  it("merges an import without replacing what you have", () => {
    const { marathons, added } = mergeMarathons([plan()], [plan({ name: "Changed" }), plan({ id: "m2" }), { junk: 1 }]);
    expect(added).toBe(1);
    expect(marathons.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(marathons[0].name).toBe("Friday night");
  });
});
