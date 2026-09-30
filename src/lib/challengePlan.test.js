import { describe, expect, it } from "vitest";
import { buildChallengePlan, challengePlanEvents, daysToPlan, planRows, replacementFor, scareTargets, startChallengeNow, tonightsEntry } from "./challengePlan.js";
import { createChallenge, normalizeChallenge, normalizePlan } from "./challenges.js";
import { buildTasteProfile } from "./taste.js";

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0);
const NOW = at(2026, 10, 1); // October 1st
const profile = buildTasteProfile([]);
const film = (id, over = {}) => ({ id, title: `Film ${id}`, year: 2010, tags: [], scares: 5, scaresRated: true, contentFlags: [], watchedDates: [], rating: 0, ...over });
const library = (n, over) => Array.from({ length: n }, (_, i) => film(i + 1, typeof over === "function" ? over(i + 1) : over));
const halloween = () => createChallenge("halloween-31", { now: at(2026, 9, 29) });
const found = () => createChallenge("found-footage-week", { now: NOW });
const opts = { profile, now: NOW };

describe("scareTargets", () => {
  it("builds from gentle to heavy around your usual level", () => {
    const t = scareTargets(5, 6);
    expect(t[0]).toBe(4);
    expect(t[4]).toBe(7);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
  });
  it("copes with one or none", () => {
    expect(scareTargets(1, 6)).toEqual([6]);
    expect(scareTargets(0, 6)).toEqual([]);
  });
});

describe("daysToPlan", () => {
  it("plans every night from the start for a daily challenge that hasn't begun", () => {
    const days = daysToPlan(halloween(), [], at(2026, 9, 29));
    expect(days).toHaveLength(31);
    expect(days[0]).toBe("2026-10-01");
    expect(days[30]).toBe("2026-10-31");
  });
  it("starts from today once it's running, and skips nights already watched", () => {
    const lib = [film(1, { watchedDates: [at(2026, 10, 3, 21).toISOString()] })];
    const days = daysToPlan(halloween(), lib, at(2026, 10, 3));
    expect(days[0]).toBe("2026-10-04");
    expect(days).toHaveLength(28);
  });
  it("spreads what's left of a count challenge across the window", () => {
    const days = daysToPlan(found(), [], NOW); // 3 films in 7 days
    expect(days).toEqual(["2026-10-01", "2026-10-03", "2026-10-05"]);
  });
  it("plans nothing after the window or once the target is met", () => {
    expect(daysToPlan(found(), [], at(2026, 12, 1))).toEqual([]);
    const done = [1, 2, 3].map((i) => film(i, { tags: ["found-footage"], watchedDates: [at(2026, 10, 1 + i, 21).toISOString()] }));
    expect(daysToPlan(found(), done, at(2026, 10, 5))).toEqual([]);
  });
});

describe("buildChallengePlan", () => {
  it("gives one film per night, none repeated, gentle nights before heavy ones", () => {
    const lib = library(40, (id) => ({ scares: (id % 9) + 1 }));
    const plan = buildChallengePlan(halloween(), lib, { ...opts, now: at(2026, 9, 29) });
    expect(plan).toHaveLength(31);
    expect(new Set(plan.map((e) => e.filmId)).size).toBe(31);
    const first = plan.slice(0, 5).reduce((s, e) => s + e.scares, 0);
    const last = plan.slice(-5).reduce((s, e) => s + e.scares, 0);
    expect(last).toBeGreaterThan(first);
  });
  it("leaves open slots when the library runs out", () => {
    const plan = buildChallengePlan(halloween(), library(10), { ...opts, now: at(2026, 9, 29) });
    expect(plan.filter((e) => e.filmId !== null)).toHaveLength(10);
    expect(plan.filter((e) => e.filmId === null)).toHaveLength(21);
  });
  it("skips watched films, unreleased films and anything over your limits", () => {
    const lib = [
      film(1, { watchedDates: ["2025-01-01T12:00:00.000Z"] }),
      film(2, { year: 2031 }),
      film(3, { contentFlags: ["gore"] }),
      film(4),
    ];
    const plan = buildChallengePlan(found(), [...lib.map((f) => ({ ...f, tags: ["found-footage"] }))], { ...opts, prefs: { avoidFlags: ["gore"], maxScares: 10 } });
    expect(plan.filter((e) => e.filmId !== null).map((e) => e.filmId)).toEqual([4]);
  });
  it("only uses films that count for a themed challenge", () => {
    const lib = [film(1, { tags: ["found-footage"] }), film(2, { tags: ["slasher"] }), film(3, { tags: ["found-footage"] }), film(4, { tags: ["found-footage"] })];
    const plan = buildChallengePlan(found(), lib, opts);
    expect(plan.map((e) => e.filmId).sort()).toEqual([1, 3, 4]);
  });
  it("respects films you asked to avoid", () => {
    const plan = buildChallengePlan(found(), library(5, { tags: ["found-footage"] }), { ...opts, avoid: [1, 2] });
    expect(plan.map((e) => e.filmId)).not.toContain(1);
  });
  it("marks estimated scare levels", () => {
    const plan = buildChallengePlan(found(), [film(1, { tags: ["found-footage", "gore"], scaresRated: false })], opts);
    expect(plan[0].scaresEst).toBe(true);
  });
});

describe("replacementFor", () => {
  it("suggests a different unused film for one night", () => {
    const lib = library(6, { tags: ["found-footage"] });
    const challenge = { ...found() };
    const plan = buildChallengePlan(challenge, lib, opts);
    const day = plan[1].day;
    const swap = replacementFor(challenge, plan, day, lib, opts);
    expect(swap.day).toBe(day);
    expect(plan.map((e) => e.filmId)).not.toContain(swap.filmId);
  });
  it("returns null when nothing else fits", () => {
    const lib = library(3, { tags: ["found-footage"] });
    const challenge = found();
    const plan = buildChallengePlan(challenge, lib, opts);
    expect(replacementFor(challenge, plan, plan[0].day, lib, opts)).toBeNull();
  });
  it("won't offer a film you've already swapped away from", () => {
    const lib = library(4, { tags: ["found-footage"] });
    const challenge = found();
    const plan = buildChallengePlan(challenge, lib, opts);
    const spare = lib.find((f) => !plan.some((e) => e.filmId === f.id));
    expect(replacementFor(challenge, plan, plan[0].day, lib, { ...opts, avoid: [spare.id] })).toBeNull();
  });
});

describe("planRows", () => {
  const challenge = () => ({ ...found(), plan: [
    { day: "2026-10-01", filmId: 1, title: "Film 1" },
    { day: "2026-10-03", filmId: 2, title: "Film 2" },
    { day: "2026-10-05", filmId: null },
    { day: "2026-10-06", filmId: 99, title: "Removed" },
  ] });
  const lib = [film(1, { tags: ["found-footage"] }), film(2, { tags: ["found-footage"] })];
  const stateOf = (now, l = lib) => Object.fromEntries(planRows(challenge(), l, now).map((r) => [r.day, r.state]));

  it("marks tonight, upcoming, open and gone", () => {
    expect(stateOf(NOW)).toEqual({ "2026-10-01": "tonight", "2026-10-03": "upcoming", "2026-10-05": "open", "2026-10-06": "gone" });
  });
  it("marks a passed night you didn't watch as missed", () => {
    expect(stateOf(at(2026, 10, 2))["2026-10-01"]).toBe("missed");
  });
  it("marks a film watched inside the window as watched, even on another day", () => {
    const watched = [film(1, { tags: ["found-footage"], watchedDates: [at(2026, 10, 2, 21).toISOString()] }), lib[1]];
    expect(stateOf(at(2026, 10, 2), watched)["2026-10-01"]).toBe("watched");
  });
  it("finds tonight's entry", () => {
    expect(tonightsEntry(challenge(), lib, NOW)?.title).toBe("Film 1");
    expect(tonightsEntry(challenge(), lib, at(2026, 10, 2))).toBeNull();
  });
  it("counts any watch on a night as that night done for a daily challenge", () => {
    const daily = { ...halloween(), plan: [{ day: "2026-10-01", filmId: 1, title: "Film 1" }] };
    const other = [film(1), film(9, { watchedDates: [at(2026, 10, 1, 22).toISOString()] })];
    expect(planRows(daily, other, at(2026, 10, 2))[0].state).toBe("watched");
  });
});

describe("startChallengeNow", () => {
  it("moves an upcoming challenge to today, keeping its length, and drops the old plan", () => {
    const c = { ...halloween(), plan: [{ day: "2026-10-01", filmId: 1, title: "A" }] };
    const moved = startChallengeNow(c, at(2026, 9, 29));
    expect(moved.startDate).toBe("2026-09-29");
    expect(moved.endDate).toBe("2026-10-29"); // still 31 days
    expect(moved.plan).toBeUndefined();
  });
  it("leaves a running challenge alone", () => {
    const c = halloween();
    expect(startChallengeNow(c, at(2026, 10, 5))).toBe(c);
  });
});

describe("challengePlanEvents", () => {
  it("makes one evening event per planned, unwatched film", () => {
    const challenge = { ...found(), plan: [{ day: "2026-10-01", filmId: 1, title: "Film 1", year: 2010, scares: 6, runtime: 90 }, { day: "2026-10-03", filmId: null }] };
    const rows = planRows(challenge, [film(1, { tags: ["found-footage"] })], NOW);
    const events = challengePlanEvents(challenge, rows, "19:30");
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Found-Footage Week: Film 1 (2010)");
    expect(events[0].start.getHours()).toBe(19);
    expect(events[0].end - events[0].start).toBe(90 * 60000);
  });
});

describe("saving a plan", () => {
  it("survives normalizing, and bad entries are dropped", () => {
    const c = { ...halloween(), plan: [
      { day: "2026-10-02", filmId: 2, title: " B ", scares: 99, scaresEst: true },
      { day: "2026-10-01", filmId: 1, title: "A" },
      { day: "2026-10-01", filmId: 3, title: "dup day" },
      { day: "2027-01-01", filmId: 4, title: "out of window" },
      { day: "2026-10-03", filmId: 5 },
      { day: "2026-10-04", filmId: null },
      "junk",
    ] };
    const n = normalizeChallenge(c);
    expect(n.plan.map((e) => [e.day, e.filmId])).toEqual([["2026-10-01", 1], ["2026-10-02", 2], ["2026-10-04", null]]);
    expect(n.plan[1]).toMatchObject({ title: "B", scares: 10, scaresEst: true });
  });
  it("leaves plan off a challenge without one", () => {
    expect("plan" in normalizeChallenge(halloween())).toBe(false);
    expect(normalizePlan("nope", "2026-10-01", "2026-10-31")).toEqual([]);
  });
});
