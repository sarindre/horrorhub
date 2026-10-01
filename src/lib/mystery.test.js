import { describe, expect, it } from "vitest";
import { drawMystery, mysteryClue, mysteryPool, safeTags } from "./mystery.js";
import { buildTasteProfile } from "./taste.js";

const NOW = new Date(2026, 5, 1);
let next = 1;
const film = (over = {}) => ({ id: next++, title: `Film ${next}`, year: 1978, tags: [], contentFlags: [], scares: 5, scaresRated: true, runtime: 95, watchedDates: [], watchlist: true, overview: "A secret plot.", ...over });
const profile = buildTasteProfile([]);

describe("mysteryPool", () => {
  it("is unwatched, released films inside your limits", () => {
    const pool = mysteryPool(
      [film({ title: "Seen", watchedDates: ["2025-01-01T12:00:00.000Z"] }), film({ title: "Future", year: 2031 }), film({ title: "Gory", contentFlags: ["gore"] }), film({ title: "Fine" })],
      { prefs: { avoidFlags: ["gore"], maxScares: 10 }, now: NOW }
    );
    expect(pool.map((f) => f.title)).toEqual(["Fine"]);
  });
  it("leaves out over-limit films whatever the warn-or-hide mode (a blind pick must not surprise you)", () => {
    const gory = film({ contentFlags: ["gore"] });
    for (const contentMode of ["warn", "hide"]) {
      expect(mysteryPool([gory], { prefs: { avoidFlags: ["gore"], maxScares: 10, contentMode }, now: NOW })).toEqual([]);
    }
    expect(mysteryPool([film({ scares: 9 })], { prefs: { avoidFlags: [], maxScares: 6 }, now: NOW })).toEqual([]);
  });
  it("skips films you've already passed on", () => {
    const a = film();
    const b = film();
    expect(mysteryPool([a, b], { skipped: [a.id], now: NOW })).toEqual([b]);
  });
});

describe("drawMystery", () => {
  it("returns nothing from an empty pool", () => {
    expect(drawMystery([], profile, { now: NOW })).toBeNull();
    expect(drawMystery([film({ watchedDates: ["2025-01-01T12:00:00.000Z"] })], profile, { now: NOW })).toBeNull();
  });
  it("draws from the best matches for the vibe and scare level", () => {
    const items = [film({ title: "Match", tags: ["slasher"], scares: 4 }), film({ title: "Wrong", tags: ["cosmic"], scares: 10 })];
    for (const roll of [0, 0.99]) {
      expect(drawMystery(items, profile, { scare: 4, moodId: "slasher", rng: () => roll, now: NOW }).item.title).toBe("Match");
    }
  });
  it("varies with the roll but stays among the top few", () => {
    const items = Array.from({ length: 12 }, (_, i) => film({ title: `F${i}`, scares: 5 }));
    const drawn = new Set([0, 0.25, 0.5, 0.75, 0.99].map((rng) => drawMystery(items, profile, { rng: () => rng, now: NOW }).item.title));
    expect(drawn.size).toBeGreaterThan(1);
    expect(drawn.size).toBeLessThanOrEqual(5);
  });
  it("says when nothing fits and it's drawing the closest", () => {
    const r = drawMystery([film({ tags: ["cosmic"], scares: 10 })], profile, { scare: 2, moodId: "slasher", now: NOW });
    expect(r.item).toBeTruthy();
    expect(r.fit).toBe(false);
    expect(drawMystery([film({ tags: ["slasher"], scares: 3 })], profile, { scare: 2, moodId: "slasher", now: NOW }).fit).toBe(true);
  });
  it("a scare level a few points off still fits, a long way off doesn't", () => {
    expect(drawMystery([film({ scares: 7 })], profile, { scare: 5, now: NOW }).fit).toBe(true);
    expect(drawMystery([film({ scares: 9 })], profile, { scare: 5, now: NOW }).fit).toBe(false);
  });
  it("gives a reason for the draw", () => {
    expect(drawMystery([film({ tags: ["slasher"] })], profile, { moodId: "slasher", now: NOW }).reasons.join(" ")).toMatch(/slasher/i);
  });
  it("never returns a skipped film, so 'draw another' always changes it", () => {
    const items = [film(), film(), film()];
    const first = drawMystery(items, profile, { rng: () => 0, now: NOW });
    const second = drawMystery(items, profile, { rng: () => 0, skipped: [first.item.id], now: NOW });
    expect(second.item.id).not.toBe(first.item.id);
  });
});

describe("safeTags", () => {
  it("never shows a tag that contains a word from the title", () => {
    const f = film({ title: "The Nightwatcher Returns", tags: ["slasher", "nightwatcher", "returns-home", "occult"] });
    expect(safeTags(f)).toEqual(["slasher", "occult"]);
  });
  it("shows at most three, in one spelling", () => {
    expect(safeTags(film({ tags: ["Folk Horror", "slow-burn", "occult", "cosmic"] }))).toEqual(["folk-horror", "slow-burn", "occult"]);
  });
});

describe("mysteryClue", () => {
  const f = film({ title: "Hereditary", year: 2018, tags: ["occult", "slow-burn"], runtime: 127, scares: 9, contentFlags: ["child-harm"], overview: "A grieving family..." });
  it("describes the film without giving it away", () => {
    const c = mysteryClue(f);
    expect(c.line).toBe("A #occult and #slow-burn film from the 2010s.");
    expect(c).toMatchObject({ runtime: 127, runtimeText: "2h 07m", scare: 9, intensity: "Traumatizing", decade: "2010s", flags: ["child-harm"] });
    const text = JSON.stringify(c).toLowerCase();
    for (const secret of ["hereditary", "2018", "grieving", "family"]) expect(text).not.toContain(secret);
  });
  it("still shows content warnings, because deciding to watch needs them", () => {
    expect(mysteryClue(f).flags).toEqual(["child-harm"]);
  });
  it("copes with missing data", () => {
    const c = mysteryClue(film({ tags: [], year: undefined, runtime: undefined }));
    expect(c.line).toBe("A horror film.");
    expect(c.runtimeText).toBe("length unknown");
    expect(c.runtime).toBeNull();
  });
  it("labels an estimated scare level", () => {
    expect(mysteryClue(film({ scaresRated: false, scares: 5, tags: ["gore", "disturbing"] })).estimated).toBe(true);
    expect(mysteryClue(film()).estimated).toBe(false);
  });
});
