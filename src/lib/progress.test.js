import { describe, expect, it } from "vitest";
import { LEVELS, badgesFor, levelFor, realWatchDays, xpFor } from "./progress.js";

const at = (y, m, d) => new Date(y, m - 1, d, 21).toISOString();
const NOW = new Date(2026, 5, 15, 12);
let next = 1;
const film = (over = {}) => ({ id: next++, title: "F", year: 2010, tags: [], rating: 0, watchedDates: [], watchlist: false, notes: "", ...over });

describe("xpFor", () => {
  it("gives 10 per watch", () => {
    expect(xpFor([film({ watchedDates: [at(2026, 1, 1), at(2026, 2, 1)] }), film({ watchedDates: [at(2026, 3, 1)] })], { now: NOW })).toBe(30);
  });
  it("adds 5 per day of a live streak beyond the first", () => {
    const items = [film({ watchedDates: [at(2026, 6, 13), at(2026, 6, 14), at(2026, 6, 15)] })];
    expect(xpFor(items, { now: NOW })).toBe(30 + 10); // three watches, streak of 3
  });
  it("lets a streak that ended yesterday still count, but not an old one", () => {
    expect(xpFor([film({ watchedDates: [at(2026, 6, 13), at(2026, 6, 14)] })], { now: NOW })).toBe(20 + 5);
    expect(xpFor([film({ watchedDates: [at(2026, 5, 1), at(2026, 5, 2)] })], { now: NOW })).toBe(20);
  });
  it("counts a long-ago watch for XP but never as part of a streak", () => {
    const items = [film({ watchedDates: [new Date(1900, 0, 1).toISOString()] })];
    expect(xpFor(items, { now: NOW })).toBe(10);
    expect(realWatchDays(items)).toEqual([]);
  });
});

describe("levelFor", () => {
  it("starts at Fresh Meat", () => {
    expect(levelFor(0)).toMatchObject({ number: 1, name: "Fresh Meat", toNext: 100, pct: 0, next: { name: "Camper" } });
  });
  it("moves up exactly at each threshold", () => {
    for (const [i, level] of LEVELS.entries()) {
      expect(levelFor(level.min)).toMatchObject({ number: i + 1, name: level.name });
      if (level.min > 0) expect(levelFor(level.min - 1).number).toBe(i);
    }
  });
  it("shows progress through the current level", () => {
    expect(levelFor(150)).toMatchObject({ name: "Camper", pct: 25, toNext: 150 }); // 50 of the 200 between 100 and 300
  });
  it("tops out", () => {
    const top = levelFor(99999);
    expect(top.name).toBe("Elder God");
    expect(top.next).toBeNull();
    expect(top.pct).toBe(100);
  });
  it("has ascending thresholds", () => {
    expect(LEVELS.map((l) => l.min)).toEqual([...LEVELS.map((l) => l.min)].sort((a, b) => a - b));
  });
});

describe("badgesFor", () => {
  const byId = (items, opts) => Object.fromEntries(badgesFor(items, { now: NOW, ...opts }).map((b) => [b.id, b]));
  const seen = (over) => film({ watchedDates: [at(2026, 1, 1)], ...over });

  it("shows progress towards a badge, and earns it at the target", () => {
    const two = byId([seen({ tags: ["folk-horror"] }), seen({ tags: ["folk-horror"] })]);
    expect(two.folk).toMatchObject({ have: 2, need: 3, earned: false });
    const three = byId([1, 2, 3].map(() => seen({ tags: ["folk-horror"] })));
    expect(three.folk).toMatchObject({ have: 3, need: 3, earned: true });
  });
  it("only counts films you've watched", () => {
    expect(byId([film({ tags: ["occult"] }), film({ tags: ["occult"] })]).occult.have).toBe(0);
  });
  it("covers each subgenre badge", () => {
    const items = [
      ...Array.from({ length: 3 }, () => seen({ tags: ["slasher"], year: 1984 })),
      ...Array.from({ length: 5 }, () => seen({ tags: ["gore", "supernatural"] })),
      ...Array.from({ length: 2 }, () => seen({ tags: ["vampire"], year: 1960 })),
    ];
    const b = byId(items);
    expect(b.slasher80s.earned).toBe(true);
    expect(b.gore.earned).toBe(true);
    expect(b.ghosts.earned).toBe(true);
    expect(b.vampire.earned).toBe(true);
    expect(b.classic.have).toBe(2);
    expect(b.zombie.earned).toBe(false);
  });
  it("earns the marathon badge from your longest streak, and keeps it", () => {
    const old = film({ watchedDates: [at(2025, 1, 1), at(2025, 1, 2), at(2025, 1, 3)] });
    expect(byId([old]).marathon.earned).toBe(true);
    expect(byId([film({ watchedDates: [at(2025, 1, 1), at(2025, 1, 3)] })]).marathon.earned).toBe(false);
  });
  it("earns Speed Watcher for two films in one day", () => {
    expect(byId([film({ watchedDates: [at(2026, 1, 1)] }), film({ watchedDates: [at(2026, 1, 1)] })]).speed.earned).toBe(true);
    expect(byId([film({ watchedDates: [at(2026, 1, 1)] }), film({ watchedDates: [at(2026, 1, 2)] })]).speed.earned).toBe(false);
  });
  it("counts reviews, tags, watchlist and high ratings", () => {
    const items = [
      ...Array.from({ length: 10 }, () => seen({ notes: "great", rating: 4.5 })),
      ...Array.from({ length: 10 }, () => film({ watchlist: true })),
      film({ tags: Array.from({ length: 20 }, (_, i) => `tag${i}`) }),
    ];
    const b = byId(items);
    expect(b.reviewer.earned).toBe(true);
    expect(b.knife.earned).toBe(true);
    expect(b.curator.earned).toBe(true);
    expect(b.tags.earned).toBe(true);
  });
  it("caps progress at the target", () => {
    expect(byId(Array.from({ length: 9 }, () => seen({ tags: ["zombie"] }))).zombie.have).toBe(3);
  });
});
