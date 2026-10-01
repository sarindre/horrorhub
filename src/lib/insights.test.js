import { describe, expect, it } from "vitest";
import { MIN_FILMS_FOR_INSIGHTS, computeInsights, watchLog } from "./insights.js";

const at = (y, m, d) => new Date(y, m - 1, d, 21).toISOString();
const NOW = new Date(2026, 5, 15, 12);
let next = 1;
const film = (over = {}) => ({ id: next++, title: `Film ${next}`, year: 2010, tags: [], rating: 0, scares: 5, watchedDates: [], watchlist: false, ...over });
const many = (n, over) => Array.from({ length: n }, (_, i) => film(typeof over === "function" ? over(i) : over));
const find = (result, id) => result.insights.find((i) => i.id === id);

describe("watchLog", () => {
  it("lists every watch by local day, oldest first, skipping long-ago placeholders", () => {
    const items = [
      film({ title: "B", watchedDates: [at(2026, 3, 2), new Date(1900, 0, 1).toISOString()] }),
      film({ title: "A", watchedDates: [at(2026, 3, 1), at(2026, 3, 2)] }),
    ];
    expect(watchLog(items).map((w) => `${w.day} ${w.item.title}`)).toEqual(["2026-03-01 A", "2026-03-02 A", "2026-03-02 B"]);
  });
  it("uses the configured long-ago year", () => {
    const items = [film({ watchedDates: [new Date(1800, 0, 1).toISOString(), at(2026, 1, 1)] })];
    expect(watchLog(items, 1800)).toHaveLength(1);
  });
});

describe("not enough to go on", () => {
  it("asks for more films and says how many", () => {
    const r = computeInsights([film({ rating: 4 }), film({ rating: 3 })], { now: NOW });
    expect(r.ready).toBe(false);
    expect(r.hint).toContain(`${MIN_FILMS_FOR_INSIGHTS - 2} more films`);
    expect(r.insights).toEqual([]);
  });
  it("has nothing to say when nothing stands out", () => {
    const items = many(8, () => film({ rating: 3, tags: ["slasher"] }));
    const r = computeInsights(items, { now: NOW });
    expect(r.ready).toBe(true);
    expect(r.insights).toEqual([]);
    expect(r.hint).toMatch(/Nothing stands out/);
  });
});

describe("taste gap between subgenres", () => {
  const items = [...many(4, () => film({ rating: 4.5, tags: ["slow-burn"] })), ...many(4, () => film({ rating: 3, tags: ["slasher"] }))];
  it("compares your best and worst subgenre", () => {
    const i = find(computeInsights(items, { now: NOW }), "tag-gap");
    expect(i.text).toBe("You rate #slow-burn films 4.5★ on average, but #slasher only 3.0★.");
    expect(i.evidence).toBe("4 and 4 rated films");
  });
  it("needs three rated films per tag and a real gap", () => {
    const few = [...many(2, () => film({ rating: 5, tags: ["slow-burn"] })), ...many(4, () => film({ rating: 2, tags: ["slasher"] }))];
    expect(find(computeInsights(few, { now: NOW }), "tag-gap")).toBeUndefined();
    const close = [...many(4, () => film({ rating: 3.5, tags: ["a"] })), ...many(4, () => film({ rating: 3, tags: ["b"] }))];
    expect(find(computeInsights(close, { now: NOW }), "tag-gap")).toBeUndefined();
  });
  it("ignores unrated films", () => {
    const i = computeInsights([...items, ...many(10, () => film({ tags: ["slasher"] }))], { now: NOW });
    expect(find(i, "tag-gap").text).toContain("only 3.0★");
  });
});

describe("scare level versus rating", () => {
  const rated = (scares, rating) => film({ scares, scaresRated: true, rating });
  it("notices you rate scarier films higher", () => {
    const items = [...many(3, () => rated(8, 4.5)), ...many(3, () => rated(3, 3))];
    const i = find(computeInsights(items, { now: NOW }), "scare-vs-rating");
    expect(i.text).toContain("You rate the scary ones higher");
    expect(i.text).toContain("4.5★");
    expect(i.text).toContain("3.0★");
  });
  it("or gentler ones", () => {
    const items = [...many(3, () => rated(8, 2)), ...many(3, () => rated(3, 4))];
    expect(find(computeInsights(items, { now: NOW }), "scare-vs-rating").text).toContain("You like them gentler");
  });
  it("only counts scare levels you set yourself", () => {
    const items = [...many(3, () => film({ scares: 8, rating: 5 })), ...many(3, () => film({ scares: 5, rating: 3 }))]; // 8 is yours by the old rule, 5 is a default
    expect(find(computeInsights(items, { now: NOW }), "scare-vs-rating")).toBeUndefined();
  });
});

describe("scare trend", () => {
  const watch = (month, scares) => film({ scares, scaresRated: true, watchedDates: [at(2025, month, 10)] });
  it("compares recent watches with earlier ones and names the month it changed", () => {
    const items = [1, 2, 3, 4].map((m) => watch(m, 4)).concat([5, 6, 7, 8].map((m) => watch(m, 7)));
    const i = find(computeInsights(items, { now: NOW }), "scare-trend");
    expect(i.text).toBe("Your recent watches run scarier: they average 7.0/10 for scares, against 4.0/10 before May 2025.");
  });
  it("notices a move towards gentler films", () => {
    const items = [1, 2, 3, 4].map((m) => watch(m, 8)).concat([5, 6, 7, 8].map((m) => watch(m, 5)));
    expect(find(computeInsights(items, { now: NOW }), "scare-trend").text).toContain("gentler");
  });
  it("needs eight films and a real change", () => {
    const few = [1, 2, 3].map((m) => watch(m, 4)).concat([4, 5, 6].map((m) => watch(m, 8)));
    expect(find(computeInsights(few, { now: NOW }), "scare-trend")).toBeUndefined();
    const flat = [1, 2, 3, 4, 5, 6, 7, 8].map((m) => watch(m, 6));
    expect(find(computeInsights(flat, { now: NOW }), "scare-trend")).toBeUndefined();
  });
});

describe("weekday habits", () => {
  // Fridays in Oct 2025: 3, 10, 17, 24, 31
  const fridays = [3, 10, 17, 24, 31].map((d) => at(2025, 10, d));
  const others = [at(2025, 10, 6), at(2025, 10, 8), at(2025, 10, 14), at(2025, 10, 21), at(2025, 10, 28)]; // Mon, Wed, Tue, Tue, Tue
  it("finds the night you mostly watch on", () => {
    const items = [film({ watchedDates: fridays }), film({ watchedDates: others }), ...many(3, () => film({ rating: 3 }))];
    expect(find(computeInsights(items, { now: NOW }), "weekday").text).toBe("You do most of your watching on Fridays: 5 of your 10 watches.");
  });
  it("stays quiet when watching is spread out or there are few watches", () => {
    const spread = [film({ watchedDates: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((d) => at(2025, 10, d)) })];
    expect(find(computeInsights([...spread, ...many(5, () => film({ rating: 3 }))], { now: NOW }), "weekday")).toBeUndefined();
    expect(find(computeInsights([film({ watchedDates: fridays.slice(0, 3) }), ...many(5, () => film({ rating: 3 }))], { now: NOW }), "weekday")).toBeUndefined();
  });
  it("spots a night where you watch scarier films", () => {
    const fri = fridays.map((d) => film({ watchedDates: [d], scares: 8, scaresRated: true }));
    const rest = others.map((d) => film({ watchedDates: [d], scares: 5, scaresRated: true }));
    const i = find(computeInsights([...fri, ...rest], { now: NOW }), "scary-night");
    expect(i.text).toBe("Fridays are your scary nights: those watches average 8.0/10 for scares, against 5.0/10 on other days.");
  });
});

describe("favorite decade", () => {
  it("picks the decade you rate highest", () => {
    const items = [...many(3, () => film({ year: 1984, rating: 5 })), ...many(3, () => film({ year: 2015, rating: 3 })), ...many(3, () => film({ year: 1998, rating: 3 }))];
    expect(find(computeInsights(items, { now: NOW }), "decade").text).toBe("The 1980s are your favorite decade: 5.0★ on average across 3 films.");
  });
  it("needs a clear lead", () => {
    const items = [...many(3, () => film({ year: 1984, rating: 3.2 })), ...many(3, () => film({ year: 2015, rating: 3 }))];
    expect(find(computeInsights(items, { now: NOW }), "decade")).toBeUndefined();
  });
});

describe("watchlist pace", () => {
  it("estimates how long the watchlist would take at your recent pace", () => {
    const recent = [film({ watchedDates: [at(2026, 4, 20), at(2026, 5, 2), at(2026, 5, 20), at(2026, 6, 1), at(2026, 6, 10), at(2026, 6, 12)] })]; // 6 in 90 days = 2 a month
    const backlog = many(10, () => film({ watchlist: true }));
    const filler = many(4, () => film({ rating: 3 }));
    const i = find(computeInsights([...recent, ...backlog, ...filler], { now: NOW }), "backlog");
    expect(i.text).toBe("At your recent pace (about 2.0 a month), your 10-film watchlist would take about 5 months.");
  });
  it("says nothing without a pace or a real backlog", () => {
    const backlog = many(10, () => film({ watchlist: true }));
    expect(find(computeInsights([...backlog, ...many(5, () => film({ rating: 3 }))], { now: NOW }), "backlog")).toBeUndefined();
  });
});

describe("ordering", () => {
  it("returns the strongest few first", () => {
    const items = [...many(4, () => film({ rating: 5, tags: ["a"], scares: 8, scaresRated: true })), ...many(4, () => film({ rating: 2, tags: ["b"], scares: 3, scaresRated: true }))];
    const r = computeInsights(items, { now: NOW, limit: 1 });
    expect(r.insights).toHaveLength(1);
    expect(computeInsights(items, { now: NOW }).insights.length).toBeGreaterThan(1);
  });
});

describe("how many films count as enough", () => {
  it("counts a film once whether you watched it, rated it or both", () => {
    const both = film({ rating: 4, watchedDates: [at(2026, 1, 1)] });
    expect(computeInsights([both, both, both, both], { now: NOW }).ready).toBe(false);
    const mixed = [film({ rating: 4 }), film({ watchedDates: [at(2026, 1, 1)] }), film({ rating: 3 }), film({ watchedDates: [at(2026, 1, 2)] }), film({ rating: 2, watchedDates: [at(2026, 1, 3)] })];
    expect(computeInsights(mixed, { now: NOW }).ready).toBe(true);
  });
});

describe("from your scare diary", () => {
  const gory = (diary, over = {}) => film({ tags: ["gore", "disturbing"], scares: 5, scaresRated: false, rating: 3, diary, ...over }); // the estimate for these is 7-8
  const entry = (n, scared, extra = {}) => ({ day: `2026-01-${String(n).padStart(2, "0")}`, scared, ...extra });
  const base = () => many(2, () => film({ rating: 3 }));

  it("says so when horror hits you harder than predicted", () => {
    const items = [...base(), ...Array.from({ length: 4 }, (_, i) => gory([entry(i + 1, 10)]))];
    const i = find(computeInsights(items, { now: NOW }), "calibration");
    expect(i.text).toMatch(/hits you harder than average/);
    expect(i.evidence).toBe("4 films with your own scare level");
  });
  it("or that you take it in stride", () => {
    const items = [...base(), ...Array.from({ length: 4 }, (_, i) => gory([entry(i + 1, 2)]))];
    expect(find(computeInsights(items, { now: NOW }), "calibration").text).toMatch(/take horror in stride/);
  });
  it("needs a few films and a real difference", () => {
    const few = [...base(), ...Array.from({ length: 3 }, (_, i) => gory([entry(i + 1, 10)]))];
    expect(find(computeInsights(few, { now: NOW }), "calibration")).toBeUndefined();
    const close = [...base(), ...Array.from({ length: 4 }, (_, i) => gory([entry(i + 1, 8)]))]; // the estimate is 8
    expect(find(computeInsights(close, { now: NOW }), "calibration")).toBeUndefined();
  });

  it("notices you're more scared alone, on films of the same kind", () => {
    // every film scores the same baseline (a slider rating of 6); alone entries run 3 higher
    const rated = (diary) => film({ scares: 6, scaresRated: true, rating: 3, diary });
    const items = [...Array.from({ length: 3 }, (_, i) => rated([entry(i + 1, 9, { company: "alone" })])), ...Array.from({ length: 3 }, (_, i) => rated([entry(i + 10, 6, { company: "friends" })]))];
    const i = find(computeInsights(items, { now: NOW }), "company");
    expect(i.text).toBe("You feel 3.0 points more scared watching alone than with other people, on films of the same kind.");
    expect(i.evidence).toBe("3 entries and 3 others");
  });
  it("notices late nights", () => {
    const rated = (diary) => film({ scares: 6, scaresRated: true, rating: 3, diary });
    const items = [...Array.from({ length: 3 }, (_, i) => rated([entry(i + 1, 9, { when: "late" })])), ...Array.from({ length: 3 }, (_, i) => rated([entry(i + 10, 7, { when: "evening" })]))];
    expect(find(computeInsights(items, { now: NOW }), "late-night").text).toBe("Late at night the same films scare you 2.0 points more than at other times.");
  });
  it("won't compare without enough entries on both sides", () => {
    const rated = (diary) => film({ scares: 6, scaresRated: true, rating: 3, diary });
    const items = [...Array.from({ length: 2 }, (_, i) => rated([entry(i + 1, 9, { company: "alone" })])), ...Array.from({ length: 3 }, (_, i) => rated([entry(i + 10, 5, { company: "friends" })])), ...base()];
    expect(find(computeInsights(items, { now: NOW }), "company")).toBeUndefined();
  });
});
