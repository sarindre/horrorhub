// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { groupSummary, loadSavedPeople, newPerson, normalizePerson, personFromYou, rankForGroup, saveSavedPeople } from "./group.js";

const NOW = Date.UTC(2026, 5, 1);
const film = (id, over = {}) => ({ id, title: `Film ${id}`, year: 2010, tags: [], scares: 5, scaresRated: true, contentFlags: [], watchedDates: [], rating: 0, ...over });
const alex = (over) => newPerson("Alex", { id: "alex", ...over });
const sam = (over) => newPerson("Sam", { id: "sam", ...over });
const rank = (items, people, opts) => rankForGroup(items, people, { now: NOW, ...opts });
const ids = (r) => r.picks.map((p) => p.item.id);

describe("normalizePerson", () => {
  it("cleans up a person and rejects nameless ones", () => {
    expect(normalizePerson({ name: "  Sam  ", maxScares: 99, avoidFlags: ["gore", "bogus", "gore"], moods: ["slasher", "x"] })).toMatchObject({
      name: "Sam", maxScares: 10, avoidFlags: ["gore"], moods: ["slasher"], you: false,
    });
    expect(normalizePerson({ name: "   " })).toBeNull();
    expect(normalizePerson(null)).toBeNull();
    expect(normalizePerson({ name: "A", maxScares: "x" }).maxScares).toBe(10);
  });
  it("builds 'you' from your comfort settings", () => {
    expect(personFromYou({ avoidFlags: ["torture"], maxScares: 7 })).toMatchObject({ you: true, maxScares: 7, avoidFlags: ["torture"] });
  });
});

describe("hard limits", () => {
  it("drops films that break anyone's limits, and says whose", () => {
    const films = [film(1, { contentFlags: ["animal-harm"] }), film(2, { scares: 9 }), film(3, { scares: 4 })];
    const r = rank(films, [alex({ avoidFlags: ["animal-harm"] }), sam({ maxScares: 6 })]);
    expect(ids(r)).toEqual([3]);
    const byName = Object.fromEntries(r.ruledOut.map((o) => [o.person.name, o.count]));
    expect(byName).toEqual({ Alex: 1, Sam: 1 });
  });
  it("uses estimated scare levels for unrated films", () => {
    const gory = film(1, { scares: 5, scaresRated: false, tags: ["gore", "disturbing"] }); // estimated 7-8
    expect(ids(rank([gory], [alex({ maxScares: 5 }), sam()]))).toEqual([]);
  });
  it("skips unreleased films", () => {
    expect(ids(rank([film(1, { year: 2030 })], [alex(), sam()]))).toEqual([]);
  });
});

describe("ranking by the least happy person", () => {
  it("prefers a film both are fine with over one only one loves", () => {
    const people = [alex({ moods: ["slasher"] }), sam({ moods: ["occult"] })];
    const films = [film(1, { title: "Slasher only", tags: ["slasher"] }), film(2, { title: "Both", tags: ["slasher", "occult"] })];
    expect(ids(rank(films, people))).toEqual([2, 1]);
  });
  it("protects the least happy person even when another film has a better average", () => {
    // A delights Alex but is the worst film for Sam; B is decent for both. The mean prefers A, the minimum prefers B.
    const people = [alex({ moods: ["slasher"] }), sam({ maxScares: 4, moods: ["occult"] })];
    const A = film(1, { title: "A", tags: ["slasher"], scares: 1 });
    const B = film(2, { title: "B", scares: 4 });
    const r = rank([A, B], people);
    expect(ids(r)).toEqual([2, 1]);
    const [a, b] = [r.picks[1], r.picks[0]];
    expect(a.mean).toBeGreaterThan(b.mean);
    expect(a.min).toBeLessThan(b.min);
  });
  it("uses the mean only to break ties", () => {
    const people = [alex({ moods: ["slasher"] }), sam({ moods: ["slasher"] })];
    const films = [film(1, { tags: ["slasher"], scares: 5 }), film(2, { tags: ["slasher"], scares: 5 })];
    expect(ids(rank(films, people))).toEqual([1, 2]); // then by title
  });
  it("names the compromise when one person is clearly less happy", () => {
    const people = [alex({ moods: ["slasher"] }), sam({ moods: ["occult"] })];
    const [top] = rank([film(1, { tags: ["slasher"] })], people).picks;
    expect(top.weakest?.name).toBe("Sam");
    expect(groupSummary(top)).toContain("Sam's call");
  });
  it("prefers films near, but under, a person's scare ceiling", () => {
    const people = [alex({ maxScares: 6 }), sam({ maxScares: 6 })];
    const films = [film(1, { scares: 2 }), film(2, { scares: 6 })];
    expect(ids(rank(films, people))).toEqual([2, 1]);
  });
  it("adds your own taste for the person marked you", () => {
    const you = personFromYou({});
    const profile = { tagScore: new Map([["slasher", { score: 0.9, count: 5 }]]), scareBias: 0 };
    const films = [film(1, { tags: ["cosmic"] }), film(2, { tags: ["slasher"] })];
    expect(ids(rank(films, [you, sam()], { profile }))).toEqual([2, 1]);
  });
});

describe("seen films", () => {
  const films = [film(1), film(2)];
  it("leaves out anything a guest or you have seen", () => {
    expect(ids(rank(films, [alex({ seen: [1] }), sam()]))).toEqual([2]);
    const watched = [film(1, { watchedDates: ["2025-01-01T00:00:00.000Z"] }), film(2)];
    expect(ids(rank(watched, [personFromYou({}), sam()]))).toEqual([2]);
  });
  it("matches ids whether stored as text or number", () => {
    expect(ids(rank(films, [alex({ seen: ["1"] }), sam()]))).toEqual([2]);
  });
  it("can bring them back, last, when asked", () => {
    const r = rank(films, [alex({ seen: [2] }), sam()], { allowSeen: true });
    expect(ids(r)).toEqual([1, 2]);
    expect(r.picks[1].seenBy.map((p) => p.name)).toEqual(["Alex"]);
  });
});

describe("saved people", () => {
  beforeEach(() => localStorage.clear());
  it("round-trips guests but never stores 'you'", () => {
    saveSavedPeople([alex({ moods: ["occult"] }), personFromYou({})]);
    const loaded = loadSavedPeople();
    expect(loaded.map((p) => p.name)).toEqual(["Alex"]);
    expect(loaded[0].moods).toEqual(["occult"]);
  });
  it("survives junk in storage", () => {
    localStorage.setItem("horrorhub.groupPeople.v1", "{oops");
    expect(loadSavedPeople()).toEqual([]);
  });
});
