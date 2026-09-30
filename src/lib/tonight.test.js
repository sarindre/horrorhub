import { describe, expect, it } from "vitest";
import { defaultScare, inProgress, scareWord, tonightPicks } from "./tonight.js";
import { buildTasteProfile } from "./taste.js";

const film = (id, over = {}) => ({ id, title: `Film ${id}`, year: 2010, tags: [], scares: 5, scaresRated: true, rating: 0, watchedDates: [], contentFlags: [], ...over });
const profile = buildTasteProfile([]);

describe("defaultScare", () => {
  it("is 5 with no history, capped by the quiz ceiling and your limit", () => {
    expect(defaultScare({ scarePref: null, scareCeiling: null })).toBe(5);
    expect(defaultScare({ scarePref: 8.4, scareCeiling: null })).toBe(8);
    expect(defaultScare({ scarePref: 8.4, scareCeiling: 6 })).toBe(6);
    expect(defaultScare({ scarePref: 8.4, scareCeiling: null }, { maxScares: 4 })).toBe(4);
  });
  it("names the levels", () => {
    expect([scareWord(2), scareWord(5), scareWord(9)]).toEqual(["Spooky", "Intense", "Traumatizing"]);
  });
});

describe("tonightPicks", () => {
  const lib = [film(1, { scares: 5 }), film(2, { scares: 5 }), film(3, { scares: 5 })];
  const opts = { scare: 5, now: Date.UTC(2026, 5, 1) };
  it("never returns films you passed on or rerolled", () => {
    const ids = tonightPicks(lib, profile, { ...opts, passed: [1], skipped: [2] }).picks.map((p) => p.item.id);
    expect(ids).toEqual([3]);
  });
  it("labels a pick that has been seen as a rewatch", () => {
    const { picks } = tonightPicks([film(1, { watchedDates: ["2025-01-01T12:00:00.000Z"] })], profile, opts);
    expect(picks[0].reasons[0]).toBe("A rewatch");
  });
  it("hides films over your limits only in hide mode, and counts them", () => {
    const lib2 = [film(1, { contentFlags: ["gore"] }), film(2)];
    const prefs = { avoidFlags: ["gore"], maxScares: 10 };
    const warn = tonightPicks(lib2, profile, { ...opts, prefs: { ...prefs, contentMode: "warn" } });
    expect(warn.picks).toHaveLength(2);
    const hide = tonightPicks(lib2, profile, { ...opts, prefs: { ...prefs, contentMode: "hide" } });
    expect(hide.picks.map((p) => p.item.id)).toEqual([2]);
    expect(hide.hiddenCount).toBe(1);
  });
  it("gives nothing for an empty library", () => {
    expect(tonightPicks([], profile, opts)).toEqual({ picks: [], hiddenCount: 0 });
  });
});

describe("inProgress", () => {
  const now = new Date(2026, 9, 10, 20, 0); // local
  const at = (m, d) => new Date(2026, m, d, 21, 0).toISOString();
  it("reports a live streak, and nudges when you haven't watched today", () => {
    const lib = [film(1, { watchedDates: [at(9, 8)] }), film(2, { watchedDates: [at(9, 9)] })];
    const lines = inProgress(lib, [], now);
    expect(lines[0].text).toBe("2-day watch streak: watch tonight to keep it alive");
  });
  it("stays quiet when there is nothing going on", () => {
    expect(inProgress([film(1)], [], now)).toEqual([]);
  });
});
