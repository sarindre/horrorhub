import { describe, expect, it } from "vitest";
import { emptyFinds, findMessage, foundToday, hidingPlaces, normalizeFinds, recordFind, SPOTS } from "./pumpboy.js";
import { VIEW_IDS } from "./nav.js";

const day = (month, d) => `2026-${month}-${String(d).padStart(2, "0")}`;

describe("hidingPlaces", () => {
  it("is the same all day, and differs between days", () => {
    expect(hidingPlaces("2026-05-04", VIEW_IDS)).toEqual(hidingPlaces("2026-05-04", VIEW_IDS));
    const days = Array.from({ length: 20 }, (_, i) => JSON.stringify(hidingPlaces(day("05", i + 1), VIEW_IDS)));
    expect(new Set(days).size).toBeGreaterThan(10);
  });

  it("hides on one to three screens, two to four in October", () => {
    for (let d = 1; d <= 28; d++) {
      const may = Object.keys(hidingPlaces(day("05", d), VIEW_IDS)).length;
      const oct = Object.keys(hidingPlaces(day("10", d), VIEW_IDS)).length;
      expect(may).toBeGreaterThanOrEqual(1);
      expect(may).toBeLessThanOrEqual(3);
      expect(oct).toBeGreaterThanOrEqual(2);
      expect(oct).toBeLessThanOrEqual(4);
    }
  });

  it("only uses real screens and known spots, and covers many screens over time", () => {
    const seen = new Set();
    for (let d = 1; d <= 28; d++) {
      for (const [view, spot] of Object.entries(hidingPlaces(day("03", d), VIEW_IDS))) {
        expect(VIEW_IDS).toContain(view);
        expect(SPOTS).toContain(spot);
        seen.add(view);
      }
    }
    expect(seen.size).toBeGreaterThan(8);
  });
});

describe("finds", () => {
  it("counts a find once per screen per day", () => {
    let f = recordFind(emptyFinds(), "2026-10-03", "stats");
    f = recordFind(f, "2026-10-03", "stats");
    expect(f.total).toBe(1);
    f = recordFind(f, "2026-10-03", "library");
    expect(f).toEqual({ total: 2, day: "2026-10-03", views: ["stats", "library"] });
    expect(foundToday(f, "2026-10-03", "stats")).toBe(true);
  });

  it("starts the day's list again tomorrow but keeps the total", () => {
    const f = recordFind(recordFind(emptyFinds(), "2026-10-03", "stats"), "2026-10-04", "stats");
    expect(f).toEqual({ total: 2, day: "2026-10-04", views: ["stats"] });
  });

  it("tolerates bad stored data", () => {
    expect(normalizeFinds(null)).toEqual(emptyFinds());
    expect(normalizeFinds({ total: "x", day: 5, views: "no" })).toEqual(emptyFinds());
  });

  it("has a message for the first find and for milestones", () => {
    expect(findMessage(1)).toMatch(/You found PumpBoy/);
    expect(findMessage(10)).toMatch(/10 times/);
    expect(findMessage(4)).toMatch(/4 so far/);
  });
});
