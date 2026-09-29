import { describe, expect, it } from "vitest";
import { buildWeeklyPlan, planEventTitle } from "./plan.js";

const films = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, title: `Film ${i + 1}`, year: 2000 + i }));
// Wed 15 Oct 2025, 12:00 local
const START = new Date(2025, 9, 15, 12, 0, 0);

describe("buildWeeklyPlan", () => {
  it("assigns films, in order, to the preferred weekdays at the chosen time", () => {
    const plan = buildWeeklyPlan(films(3), { planDays: [5, 6], planTime: "21:30", start: START });
    expect(plan.map((p) => p.film.id)).toEqual([1, 2, 3]);
    expect(plan.map((p) => p.start.getDay())).toEqual([5, 6, 5]); // Fri, Sat, Fri
    expect(plan[0].start.getHours()).toBe(21);
    expect(plan[0].start.getMinutes()).toBe(30);
    expect(plan[0].start.getDate()).toBe(17);
  });

  it("skips a slot that has already passed today", () => {
    // Wednesday is a plan day but 20:00 today is later than 12:00, so it stays; 08:00 has passed
    expect(buildWeeklyPlan(films(1), { planDays: [3], planTime: "20:00", start: START })[0].start.getDate()).toBe(15);
    expect(buildWeeklyPlan(films(1), { planDays: [3], planTime: "08:00", start: START })[0].start.getDate()).toBe(22);
  });

  it("treats midnight as a valid time (00:00 used to fall back to 20:00)", () => {
    expect(buildWeeklyPlan(films(1), { planDays: [5], planTime: "00:00", start: START })[0].start.getHours()).toBe(0);
  });

  it("stops at the window or the films, whichever comes first", () => {
    expect(buildWeeklyPlan(films(20), { planDays: [0, 1, 2, 3, 4, 5, 6], start: START, days: 28 })).toHaveLength(20);
    expect(buildWeeklyPlan(films(50), { planDays: [0, 1, 2, 3, 4, 5, 6], start: START, days: 10 })).toHaveLength(10);
    expect(buildWeeklyPlan(films(5), { planDays: [], start: START })).toEqual([]);
    expect(buildWeeklyPlan([], { planDays: [5], start: START })).toEqual([]);
  });

  it("titles calendar events, omitting a missing year cleanly", () => {
    expect(planEventTitle({ title: "Alien", year: 1979 })).toBe("Watch: Alien (1979)");
    expect(planEventTitle({ title: "Alien" })).toBe("Watch: Alien");
  });
});
