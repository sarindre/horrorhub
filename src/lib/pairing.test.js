import { describe, expect, it } from "vitest";
import { PAIR_KINDS, pairLineup, pairSuggestions } from "./pairing.js";
import { lineupPlan, withEffectiveScare } from "./marathon.js";
import { buildTasteProfile } from "./taste.js";

const NOW = new Date(2026, 5, 1);
let next = 100;
const film = (over = {}) => ({ id: next++, title: `Film ${next}`, year: 2010, tags: [], scares: 5, scaresRated: true, runtime: 100, contentFlags: [], watchedDates: [], ...over });
const profile = buildTasteProfile([]);
const opts = { profile, now: NOW };
const group = (r, id) => r.groups.find((g) => g.kind.id === id);
const titles = (g) => g.picks.map((p) => p.item.title);

describe("the three kinds", () => {
  it("are named and in a fixed order", () => {
    expect(PAIR_KINDS.map((k) => k.id)).toEqual(["deeper", "cleanser", "short"]);
  });
});

describe("same wavelength", () => {
  const base = film({ title: "Base", tags: ["folk-horror", "slow-burn"], scares: 7 });
  it("needs a shared tag and a similar scare level", () => {
    const lib = [
      film({ title: "Match", tags: ["folk-horror"], scares: 7 }),
      film({ title: "No tag", tags: ["slasher"], scares: 7 }),
      film({ title: "Too gentle", tags: ["folk-horror"], scares: 2 }),
      film({ title: "Too heavy", tags: ["folk-horror"], scares: 10 }),
    ];
    expect(titles(group(pairSuggestions(base, lib, opts), "deeper"))).toEqual(["Match"]);
  });
  it("prefers more in common", () => {
    const lib = [film({ title: "One", tags: ["folk-horror"], scares: 7 }), film({ title: "Two", tags: ["folk-horror", "slow-burn"], scares: 7 })];
    expect(titles(group(pairSuggestions(base, lib, opts), "deeper"))).toEqual(["Two", "One"]);
  });
  it("says what they share", () => {
    const [pick] = group(pairSuggestions(base, [film({ tags: ["folk-horror", "slow-burn"], scares: 7 })], opts), "deeper").picks;
    expect(pick.reasons[0]).toBe("Both #folk-horror and #slow-burn");
  });
});

describe("palate cleanser", () => {
  it("is at least three points lighter than a heavy film", () => {
    const base = film({ title: "Heavy", scares: 9 });
    const lib = [film({ title: "Light", scares: 4 }), film({ title: "Middling", scares: 7 }), film({ title: "Gentle", scares: 2 })];
    const g = group(pairSuggestions(base, lib, opts), "cleanser");
    expect(titles(g).sort()).toEqual(["Gentle", "Light"]);
    expect(g.picks[0].reasons[0]).toMatch(/^Eases off from 9\/10 to \d\/10$/);
  });
  it("isn't offered after something already gentle", () => {
    const g = group(pairSuggestions(film({ scares: 3 }), [film({ scares: 1 })], opts), "cleanser");
    expect(g.picks).toEqual([]);
    expect(g.skipped).toMatch(/already gentle/);
  });
});

describe("quick one", () => {
  it("is short and shorter than the film you're pairing with", () => {
    const base = film({ title: "Long", runtime: 150, scares: 6 });
    const lib = [film({ title: "Quick", runtime: 80, scares: 6 }), film({ title: "Also long", runtime: 120, scares: 6 }), film({ title: "Too different", runtime: 70, scares: 1 })];
    expect(titles(group(pairSuggestions(base, lib, opts), "short"))).toEqual(["Quick"]);
  });
  it("doesn't pair a short film with a longer one", () => {
    const base = film({ runtime: 75, scares: 6 });
    expect(group(pairSuggestions(base, [film({ runtime: 85, scares: 6 })], opts), "short").picks).toEqual([]);
  });
  it("shows the total time for the night", () => {
    const base = film({ runtime: 120, scares: 6 });
    const [pick] = group(pairSuggestions(base, [film({ runtime: 80, scares: 6 })], opts), "short").picks;
    expect(pick.totalMinutes).toBe(120 + 15 + 80);
    expect(pick.reasons[0]).toBe("1h 20m, 3h 35m for the double feature");
  });
});

describe("who is never suggested", () => {
  const base = film({ title: "Base", tags: ["slasher"], scares: 7 });
  const eligible = () => film({ title: "Fine", tags: ["slasher"], scares: 7 });
  const allTitles = (lib, o = opts) => pairSuggestions(base, lib, o).groups.flatMap(titles);

  it("the film itself, or a copy of it under another id", () => {
    expect(allTitles([{ ...base }, film({ title: "Base", year: 2010, tags: ["slasher"], scares: 7 }), eligible()])).toEqual(["Fine"]);
  });
  it("films you've watched", () => {
    expect(allTitles([film({ title: "Seen", tags: ["slasher"], scares: 7, watchedDates: ["2025-01-01T12:00:00.000Z"] }), eligible()])).toEqual(["Fine"]);
  });
  it("films that aren't out yet", () => {
    expect(allTitles([film({ title: "Future", year: 2031, tags: ["slasher"], scares: 7 }), eligible()])).toEqual(["Fine"]);
  });
  it("films over your content limits", () => {
    const lib = [film({ title: "Gory", tags: ["slasher"], scares: 7, contentFlags: ["gore"] }), eligible()];
    expect(allTitles(lib, { ...opts, prefs: { avoidFlags: ["gore"], maxScares: 10 } })).toEqual(["Fine"]);
    expect(allTitles(lib, { ...opts, prefs: { avoidFlags: [], maxScares: 6 } })).toEqual([]); // both are scare 7
  });
  it("a film more than once across the groups", () => {
    // light and short and sharing a tag: it fits all three, but is offered once
    const lib = [film({ title: "Fits all", tags: ["slasher"], scares: 5, runtime: 70 })];
    const r = pairSuggestions(film({ tags: ["slasher"], scares: 7, runtime: 120 }), lib, opts);
    expect(r.groups.flatMap(titles)).toEqual(["Fits all"]);
  });
});

describe("limits on how many", () => {
  it("offers a couple per group by default, and as many as asked", () => {
    const lib = Array.from({ length: 6 }, (_, i) => film({ title: `Match ${i}`, tags: ["slasher"], scares: 7 }));
    const base = film({ tags: ["slasher"], scares: 7 });
    expect(group(pairSuggestions(base, lib, opts), "deeper").picks).toHaveLength(2);
    expect(group(pairSuggestions(base, lib, { ...opts, perKind: 4 }), "deeper").picks).toHaveLength(4);
  });
  it("copes with an empty library", () => {
    const r = pairSuggestions(film(), [], opts);
    expect(r.groups.every((g) => g.picks.length === 0)).toBe(true);
  });
});

describe("estimates and your diary", () => {
  it("uses estimated scare levels for films you haven't scored, and labels them", () => {
    const base = film({ scares: 8, tags: ["slasher"] });
    const lib = [film({ title: "Est", scaresRated: false, scares: 5, tags: ["slasher", "gore", "disturbing"] })]; // estimate 8
    const [pick] = group(pairSuggestions(base, lib, opts), "deeper").picks;
    expect(pick.estimated).toBe(true);
    expect(pick.reasons[1]).toContain("(est.)");
  });
  it("uses what your diary says for a film", () => {
    const base = film({ scares: 8, tags: ["slasher"] });
    const lib = [film({ title: "Diary", scaresRated: false, scares: 5, tags: ["slasher"], diary: [{ day: "2026-01-01", scared: 2 }] })];
    const r = pairSuggestions(base, lib, opts);
    expect(group(r, "cleanser").picks[0].scare).toBe(2);
    expect(group(r, "cleanser").picks[0].estimated).toBe(false);
  });
});

describe("the planner side", () => {
  it("withEffectiveScare puts a diary score on the film so the pacing uses it", () => {
    const f = film({ scaresRated: false, scares: 5, diary: [{ day: "2026-01-01", scared: 9 }] });
    expect(withEffectiveScare(f)).toMatchObject({ scares: 9 });
    expect(withEffectiveScare(f).scaresEst).toBeUndefined();
  });
  it("a double feature becomes a fixed two-film lineup with the reason on the second", () => {
    const base = film({ title: "A", scares: 8, runtime: 120 });
    const lib = [film({ title: "B", scares: 3, runtime: 80 })];
    const pick = group(pairSuggestions(base, lib, opts), "cleanser").picks[0];
    const lineup = pairLineup(base, pick);
    const plan = lineupPlan(lineup.films, { reasons: lineup.reasons });
    expect(plan.films.map((f) => f.item.title)).toEqual(["A", "B"]);
    expect(plan.films[1].reasons[0]).toContain("Eases off");
    expect(plan.totalMinutes).toBe(120 + 15 + 80);
    expect(plan.flow).toMatch(/Opens with the scariest film/);
    expect(plan.flow).not.toMatch(/build-up/); // it was chosen on purpose
  });
});
