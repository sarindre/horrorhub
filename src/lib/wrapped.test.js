import { describe, expect, it } from "vitest";
import { OMNIVORE, buildWrapped, defaultWrappedYear, wrappedText, wrappedYears } from "./wrapped.js";
import { CARD_HEIGHT, CARD_WIDTH, layoutWrapped } from "./wrappedImage.js";

const at = (y, m, d) => new Date(y, m - 1, d, 21).toISOString();
let next = 1;
const film = (over = {}) => ({ id: next++, title: `Film ${next}`, year: 2010, tags: [], rating: 0, scares: 5, runtime: 100, watchedDates: [], ...over });

describe("which years", () => {
  const items = [film({ watchedDates: [at(2024, 5, 1), at(2025, 6, 1), new Date(1900, 0, 1).toISOString()] }), film({ watchedDates: [at(2025, 7, 1)] })];
  it("lists years with real watches, newest first, ignoring the long-ago placeholder", () => {
    expect(wrappedYears(items)).toEqual([2025, 2024]);
  });
  it("opens on this year if it has watches, else the latest", () => {
    expect(defaultWrappedYear(items, { now: new Date(2026, 5, 1) })).toBe(2025);
    expect(defaultWrappedYear([...items, film({ watchedDates: [at(2026, 1, 5)] })], { now: new Date(2026, 5, 1) })).toBe(2026);
    expect(defaultWrappedYear([], {})).toBeNull();
  });
});

describe("buildWrapped", () => {
  it("is null for a year with no watches", () => {
    expect(buildWrapped([film({ watchedDates: [at(2024, 1, 1)] })], 2025)).toBeNull();
  });

  it("counts films, watches, rewatches and new films", () => {
    const items = [
      film({ watchedDates: [at(2025, 1, 5), at(2025, 3, 5)] }), // watched twice this year
      film({ watchedDates: [at(2023, 1, 5), at(2025, 2, 5)] }), // seen before: a rewatch of an old favorite
      film({ watchedDates: [at(2025, 4, 5)] }),
    ];
    const w = buildWrapped(items, 2025);
    expect(w).toMatchObject({ year: 2025, watches: 4, films: 3, rewatches: 1, newFilms: 2 });
  });

  it("treats a long-ago placeholder as having seen it before", () => {
    const w = buildWrapped([film({ watchedDates: [new Date(1900, 0, 1).toISOString(), at(2025, 1, 5)] })], 2025);
    expect(w.newFilms).toBe(0);
    expect(w.watches).toBe(1);
  });

  it("adds up hours from runtimes, and says when it had to guess", () => {
    const known = buildWrapped([film({ runtime: 90, watchedDates: [at(2025, 1, 1)] }), film({ runtime: 150, watchedDates: [at(2025, 1, 2)] })], 2025);
    expect(known).toMatchObject({ hours: 4, estimatedHours: false });
    const guess = buildWrapped([film({ runtime: undefined, watchedDates: [at(2025, 1, 1)] })], 2025);
    expect(guess).toMatchObject({ hours: 2, estimatedHours: true });
  });

  it("finds your most watched tags", () => {
    const items = [
      film({ tags: ["slasher", "classic"], watchedDates: [at(2025, 1, 1)] }),
      film({ tags: ["slasher"], watchedDates: [at(2025, 1, 2)] }),
      film({ tags: ["slasher", "gore"], watchedDates: [at(2025, 1, 3)] }),
      film({ tags: ["gore"], watchedDates: [at(2025, 1, 4)] }),
    ];
    expect(buildWrapped(items, 2025).topTags).toEqual([{ tag: "slasher", count: 3 }, { tag: "gore", count: 2 }, { tag: "classic", count: 1 }]);
  });

  it("gives a personality from your favorite vibe, or omnivore when nothing dominates", () => {
    const slashers = Array.from({ length: 4 }, (_, i) => film({ tags: ["slasher"], watchedDates: [at(2025, 1, i + 1)] }));
    expect(buildWrapped(slashers, 2025).personality).toEqual({ title: "The Slasher Devotee", mood: "slasher" });
    const mixed = ["home-invasion", "possession", "cosmic", "zombie", "found-footage", "body-horror", "folk-horror"].map((t, i) => film({ tags: [t], watchedDates: [at(2025, 1, i + 1)] }));
    expect(buildWrapped(mixed, 2025).personality.title).toBe(OMNIVORE);
    expect(buildWrapped([film({ tags: ["slasher"], watchedDates: [at(2025, 1, 1)] })], 2025).personality.title).toBe(OMNIVORE); // too few to say
  });

  it("names the scariest film, labelling an estimate", () => {
    const items = [film({ title: "Mild", scares: 3, scaresRated: true, watchedDates: [at(2025, 1, 1)] }), film({ title: "Brutal", scares: 9, scaresRated: true, watchedDates: [at(2025, 1, 2)] })];
    expect(buildWrapped(items, 2025).scariest).toMatchObject({ title: "Brutal", scare: 9, estimated: false });
    const est = buildWrapped([film({ title: "Guess", scaresRated: false, tags: ["gore", "disturbing"], watchedDates: [at(2025, 1, 1)] })], 2025);
    expect(est.scariest.estimated).toBe(true);
  });

  it("lists your top rated films", () => {
    const items = [film({ title: "B", rating: 4, watchedDates: [at(2025, 1, 1)] }), film({ title: "A", rating: 5, watchedDates: [at(2025, 1, 2)] }), film({ title: "C", rating: 3, watchedDates: [at(2025, 1, 3)] })];
    expect(buildWrapped(items, 2025).topRated.map((f) => f.title)).toEqual(["A", "B"]);
  });

  it("finds your busiest month, favorite night and longest streak", () => {
    const items = [
      film({ watchedDates: [at(2025, 10, 3), at(2025, 10, 4), at(2025, 10, 5), at(2025, 10, 10)] }), // Fri Sat Sun, Fri
      film({ watchedDates: [at(2025, 3, 7)] }), // Friday
    ];
    const w = buildWrapped(items, 2025);
    expect(w.busiestMonth).toEqual({ name: "October", count: 4 });
    expect(w.favoriteDay).toEqual({ name: "Friday", count: 3 });
    expect(w.longestStreak).toBe(3);
  });

  it("notices big nights", () => {
    const night = at(2025, 10, 31);
    const items = [film({ watchedDates: [night] }), film({ watchedDates: [night] }), film({ watchedDates: [night] }), film({ watchedDates: [at(2025, 11, 1)] })];
    expect(buildWrapped(items, 2025)).toMatchObject({ bigNight: { day: "2025-10-31", count: 3 }, marathonNights: 1 });
    expect(buildWrapped([film({ watchedDates: [at(2025, 1, 1)] })], 2025).bigNight).toBeNull();
  });

  it("records the first and last film and the oldest one", () => {
    const items = [film({ title: "Late", year: 2020, watchedDates: [at(2025, 12, 20)] }), film({ title: "Early", year: 1931, watchedDates: [at(2025, 1, 2)] })];
    const w = buildWrapped(items, 2025);
    expect(w.first).toEqual({ title: "Early", day: "2025-01-02" });
    expect(w.last).toEqual({ title: "Late", day: "2025-12-20" });
    expect(w.oldest).toEqual({ title: "Early", year: 1931 });
  });

  it("ignores other years entirely", () => {
    const items = [film({ watchedDates: [at(2024, 12, 31), at(2025, 1, 1), at(2026, 1, 1)] })];
    expect(buildWrapped(items, 2025).watches).toBe(1);
  });
});

describe("wrappedText", () => {
  it("tells the story in plain lines", () => {
    const items = [film({ title: "Hereditary", rating: 5, scares: 9, scaresRated: true, tags: ["occult"], runtime: 127, watchedDates: [at(2025, 10, 3), at(2025, 10, 4)] })];
    const t = wrappedText(buildWrapped(items, 2025));
    expect(t).toContain("My 2025 in horror");
    expect(t).toContain("1 film (2 watches), about 4 hours");
    expect(t).toContain("Scariest: Hereditary (2010), 9/10");
    expect(t).toContain("Top rated: Hereditary 5★");
    expect(t).toContain("Longest streak: 2 days");
  });
});

describe("the card layout", () => {
  const w = buildWrapped(
    [
      film({ title: "A Film With A Deliberately Very Long Title To Test How The Card Copes With Text", rating: 5, scares: 9, scaresRated: true, tags: ["occult", "gore", "slasher"], watchedDates: [at(2025, 10, 3), at(2025, 10, 4)] }),
      film({ title: "Another", rating: 4.5, watchedDates: [at(2025, 10, 5)] }),
    ],
    2025
  );
  const layout = layoutWrapped(w);
  const texts = layout.ops.map((o) => o.text);
  it("has the headline numbers and highlights", () => {
    expect(texts).toContain("My 2025 in horror");
    expect(texts).toContain("2");
    expect(texts).toContain(w.personality.title);
    expect(texts).toContain("MOST WATCHED");
    expect(texts.some((t) => t.includes("/10"))).toBe(true);
  });
  it("keeps every line on the card and long titles short", () => {
    for (const op of layout.ops) {
      expect(op.x).toBeGreaterThanOrEqual(0);
      expect(op.x).toBeLessThanOrEqual(CARD_WIDTH);
      expect(op.y).toBeGreaterThan(0);
      expect(op.y).toBeLessThan(CARD_HEIGHT);
      expect(op.text.length).toBeLessThan(80);
    }
  });
  it("leaves out rows that don't apply", () => {
    const bare = layoutWrapped(buildWrapped([film({ watchedDates: [at(2025, 1, 1)] })], 2025)).ops.map((o) => o.text);
    expect(bare).not.toContain("BIGGEST NIGHT");
    expect(bare).not.toContain("TOP RATED");
  });
});
