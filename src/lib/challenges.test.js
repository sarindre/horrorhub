import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  CHALLENGE_TEMPLATES,
  CHALLENGES_KEY,
  challengeDiscoverPath,
  challengeKeywordTerms,
  createChallenge,
  dayKey,
  daysBetween,
  evaluateChallenge,
  loadChallenges,
  matchesClause,
  mergeChallenges,
  normalizeChallenge,
  pacePhrase,
  saveChallenges,
  seasonalTemplates,
  streaksFrom,
  suggestForChallenge,
  watchStreak,
} from "./challenges.js";

// local-time helpers so tests don't depend on the machine's timezone
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const iso = (y, m, d) => at(y, m, d, 0).toISOString(); // how the app stores a watch date (local midnight)
const film = (id, extra = {}) => ({ id, title: `Film ${id}`, year: 2010, tags: [], keywords: [], watchedDates: [], rating: 0, scares: 5, ...extra });

describe("day helpers", () => {
  it("round-trips local days and does date math across month ends", () => {
    expect(dayKey(at(2025, 3, 9))).toBe("2025-03-09");
    expect(addDays("2025-10-30", 3)).toBe("2025-11-02");
    expect(daysBetween("2025-10-01", "2025-10-31")).toBe(30);
    expect(daysBetween("2025-10-31", "2025-10-01")).toBe(-30);
  });
});

describe("createChallenge", () => {
  it("rolling challenges start today and end after their length", () => {
    const c = createChallenge("thirty-days", { now: at(2025, 10, 15) });
    expect([c.startDate, c.endDate, c.kind, c.target]).toEqual(["2025-10-15", "2025-11-13", "daily", 30]);
  });

  it("Halloween uses this October while it is running, and next October once it has ended", () => {
    expect(createChallenge("halloween-31", { now: at(2025, 10, 15) })).toMatchObject({ startDate: "2025-10-01", endDate: "2025-10-31" });
    expect(createChallenge("halloween-31", { now: at(2025, 9, 20) })).toMatchObject({ startDate: "2025-10-01" });
    expect(createChallenge("halloween-31", { now: at(2025, 11, 3) })).toMatchObject({ startDate: "2026-10-01", endDate: "2026-10-31" });
  });

  it("Friday the 13th targets the next one (today counts)", () => {
    expect(createChallenge("friday-13th", { now: at(2025, 6, 1) })).toMatchObject({ startDate: "2025-06-13", endDate: "2025-06-13" });
    expect(createChallenge("friday-13th", { now: at(2025, 6, 13) })).toMatchObject({ startDate: "2025-06-13" });
  });

  it("returns null for an unknown template", () => {
    expect(createChallenge("nope")).toBeNull();
  });

  it("ships templates with unique ids and valid shapes", () => {
    const ids = CHALLENGE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of CHALLENGE_TEMPLATES) {
      expect(["daily", "count"]).toContain(t.kind);
      expect(t.target).toBeGreaterThan(0);
      expect(normalizeChallenge(createChallenge(t.id, { now: at(2025, 10, 15) }))).not.toBeNull();
    }
  });
});

describe("seasonalTemplates", () => {
  const ids = (now) => seasonalTemplates(now).map((s) => s.template.id);

  it("surfaces Halloween in September and October, holidays in December, slashers in summer", () => {
    expect(ids(at(2025, 9, 20))).toContain("halloween-31");
    expect(ids(at(2025, 10, 15))).toContain("halloween-31");
    expect(ids(at(2025, 12, 10))).toContain("holiday-horror");
    expect(ids(at(2025, 7, 4))).toContain("summer-slashers");
    expect(ids(at(2025, 4, 2))).not.toContain("halloween-31");
  });

  it("flags Friday the 13th only when one is within two weeks", () => {
    expect(ids(at(2025, 6, 2))).toContain("friday-13th"); // the 13th is a Friday in June 2025
    expect(ids(at(2025, 4, 2))).not.toContain("friday-13th");
  });

  it("explains why", () => {
    expect(seasonalTemplates(at(2025, 10, 15))[0].reason).toBeTruthy();
  });
});

describe("matching", () => {
  it("clauses AND their fields; challenges OR their clauses", () => {
    expect(matchesClause(film(1, { year: 1985 }), { yearMax: 1989 })).toBe(true);
    expect(matchesClause(film(1, { year: 1995 }), { yearMax: 1989 })).toBe(false);
    expect(matchesClause(film(1, { year: undefined }), { yearMax: 1989 })).toBe(false);
    expect(matchesClause(film(1, { tags: ["zombie"], runtime: 120 }), { tagsAny: ["zombie"], runtimeMax: 100 })).toBe(false);
    expect(matchesClause(film(1, { tags: ["zombie"] }), { tagsAny: ["zombie"], runtimeMax: 100 })).toBe(true); // unknown runtime passes
    expect(matchesClause(film(1, { keywords: ["christmas eve"] }), { keywordsAny: ["christmas"] })).toBe(true);
  });
});

describe("streaksFrom / watchStreak", () => {
  it("finds the longest run and the run that is still alive", () => {
    const days = ["2025-10-01", "2025-10-02", "2025-10-03", "2025-10-07", "2025-10-08"];
    expect(streaksFrom(days, "2025-10-08")).toEqual({ current: 2, longest: 3 });
    expect(streaksFrom(days, "2025-10-09")).toEqual({ current: 2, longest: 3 }); // hasn't watched yet today: not broken
    expect(streaksFrom(days, "2025-10-10")).toEqual({ current: 0, longest: 3 }); // a full day missed
    expect(streaksFrom([], "2025-10-10")).toEqual({ current: 0, longest: 0 });
  });

  it("counts several films on one day once", () => {
    const lib = [film(1, { watchedDates: [iso(2025, 10, 8)] }), film(2, { watchedDates: [iso(2025, 10, 8), iso(2025, 10, 7)] })];
    expect(watchStreak(lib, at(2025, 10, 8))).toEqual({ current: 2, longest: 2 });
  });
});

describe("evaluateChallenge: daily", () => {
  const challenge = { ...createChallenge("thirty-days", { now: at(2025, 10, 1) }), target: 3 };

  it("counts distinct days with a watch inside the window, plus streaks", () => {
    const lib = [
      film(1, { watchedDates: [iso(2025, 10, 1), iso(2025, 10, 2)] }),
      film(2, { watchedDates: [iso(2025, 10, 2)] }), // same day as another film
      film(3, { watchedDates: [iso(2025, 9, 20)] }), // before the window
    ];
    const r = evaluateChallenge(challenge, lib, at(2025, 10, 3));
    expect(r).toMatchObject({ status: "active", done: 2, remaining: 1, pct: 67, streak: { current: 2, longest: 2 } });
  });

  it("completes on the day the target is reached", () => {
    const lib = [film(1, { watchedDates: [iso(2025, 10, 1), iso(2025, 10, 2), iso(2025, 10, 4)] })];
    expect(evaluateChallenge(challenge, lib, at(2025, 10, 5))).toMatchObject({ status: "completed", completedOn: "2025-10-04", pct: 100 });
  });

  it("expires when the window ends short of the target, and is upcoming before it starts", () => {
    const lib = [film(1, { watchedDates: [iso(2025, 10, 1)] })];
    expect(evaluateChallenge(challenge, lib, at(2025, 12, 1)).status).toBe("expired");
    expect(evaluateChallenge(challenge, lib, at(2025, 9, 20))).toMatchObject({ status: "upcoming", daysLeft: 30 });
  });
});

describe("evaluateChallenge: count", () => {
  const challenge = createChallenge("found-footage-week", { now: at(2025, 10, 1) }); // Oct 1-7, 3 films

  it("counts each matching film once, whenever in the window it was watched", () => {
    const lib = [
      film(1, { tags: ["found-footage"], watchedDates: [iso(2025, 10, 2), iso(2025, 10, 5)] }), // rewatched: still one film
      film(2, { tags: ["found-footage"], watchedDates: [iso(2025, 10, 3)] }),
      film(3, { tags: ["slasher"], watchedDates: [iso(2025, 10, 3)] }), // wrong kind of film
      film(4, { tags: ["found-footage"], watchedDates: [iso(2025, 9, 30)] }), // before the window
    ];
    const r = evaluateChallenge(challenge, lib, at(2025, 10, 4));
    expect(r).toMatchObject({ status: "active", done: 2, remaining: 1 });
    expect(r.matched.map((m) => m.item.id)).toEqual([1, 2]);
  });

  it("completes when the third film lands and reports that day", () => {
    const lib = [1, 2, 3].map((i) => film(i, { tags: ["found-footage"], watchedDates: [iso(2025, 10, i)] }));
    expect(evaluateChallenge(challenge, lib, at(2025, 10, 6))).toMatchObject({ status: "completed", completedOn: "2025-10-03" });
  });

  it("ignores imported watch dates that aren't inside the window, however they're formatted", () => {
    const lib = [film(1, { tags: ["found-footage"], watchedDates: ["1900-01-01T00:00:00.000Z"] })];
    expect(evaluateChallenge(challenge, lib, at(2025, 10, 4)).done).toBe(0);
  });
});

describe("pacePhrase", () => {
  it("describes the pace you need", () => {
    expect(pacePhrase(3, 6)).toBe("about 1 every 2 days");
    expect(pacePhrase(1, 30)).toBe("about 1 every 30 days");
    expect(pacePhrase(5, 5)).toBe("1 a day");
    expect(pacePhrase(6, 3)).toBe("2 a day");
    expect(pacePhrase(0, 5)).toBe("");
    expect(pacePhrase(2, 0)).toBe("");
  });
});

describe("suggestForChallenge", () => {
  const challenge = createChallenge("found-footage-week", { now: at(2025, 10, 1) });
  const lib = [
    film(1, { title: "Cam One", tags: ["found-footage"], year: 2012 }),
    film(2, { title: "Cam Two", tags: ["found-footage"], year: 2014, contentFlags: ["animal-harm"] }),
    film(3, { title: "Slasher", tags: ["slasher"] }),
    film(4, { title: "Seen Cam", tags: ["found-footage"], watchedDates: [iso(2024, 1, 1)] }),
    film(5, { title: "Future Cam", tags: ["found-footage"], year: 2099 }),
    film(6, { title: "Cam Three", tags: ["found-footage"], year: 2016 }),
  ];

  it("offers unwatched, released films that count, with a reason", () => {
    const picks = suggestForChallenge(challenge, lib, { now: at(2025, 10, 2), limit: 10 });
    expect(picks.map((p) => p.item.title).sort()).toEqual(["Cam One", "Cam Three", "Cam Two"]);
    expect(picks[0].reasons[0]).toBe("Counts toward Found-Footage Week");
  });

  it("leaves out films over your content limits so a generated list never surprises you", () => {
    const picks = suggestForChallenge(challenge, lib, { now: at(2025, 10, 2), limit: 10, prefs: { avoidFlags: ["animal-harm"], maxScares: 10 } });
    expect(picks.map((p) => p.item.title)).not.toContain("Cam Two");
  });

  it("sizes the list to what's left (capped), and prefers what fits your taste", () => {
    const rated = [
      film(10, { title: "Loved Tag", tags: ["found-footage", "occult"], rating: 5, watchedDates: [iso(2024, 1, 1)] }),
      film(11, { title: "Match", tags: ["found-footage", "occult"], year: 2011 }),
      film(12, { title: "Other", tags: ["found-footage"], year: 2013 }),
    ];
    const picks = suggestForChallenge(challenge, rated, { now: at(2025, 10, 2) });
    expect(picks).toHaveLength(2); // both unwatched matches; remaining is 3 but only 2 exist
    expect(picks[0].item.title).toBe("Match");
  });

  it("for a daily challenge suggests any unwatched released film", () => {
    const daily = createChallenge("thirty-days", { now: at(2025, 10, 1) });
    expect(suggestForChallenge(daily, lib, { now: at(2025, 10, 2), limit: 10 }).map((p) => p.item.title)).toContain("Slasher");
  });
});

describe("TMDb ideas", () => {
  it("derives search terms and a discover request from the first clause", () => {
    const ff = createChallenge("found-footage-week", { now: at(2025, 10, 1) });
    expect(challengeKeywordTerms(ff)).toEqual(["found footage"]);
    const path = challengeDiscoverPath(ff, [163053]);
    expect(path).toContain("with_genres=27");
    expect(path).toContain("with_keywords=163053");
    const cult = createChallenge("cult-classics", { now: at(2025, 10, 1) });
    expect(challengeKeywordTerms(cult)).toEqual([]);
    expect(challengeDiscoverPath(cult)).toContain("primary_release_date.lte=1989-12-31");
    const creature = createChallenge("creature-feature", { now: at(2025, 10, 1) });
    expect(challengeKeywordTerms(creature)).toEqual(["creature", "zombie", "vampire"]);
    expect(challengeDiscoverPath(creature, [1, 2])).toMatch(/with_keywords=1\|2/);
    expect(challengeDiscoverPath(creature)).toContain("with_runtime.lte=100");
  });
});

describe("persistence", () => {
  afterEach(() => vi.unstubAllGlobals());
  const store = (initial = {}) => {
    const map = new Map(Object.entries(initial));
    return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), _map: map };
  };

  it("validates challenges and drops bad ones", () => {
    const good = createChallenge("found-footage-week", { now: at(2025, 10, 1) });
    expect(normalizeChallenge(good)).toMatchObject({ id: good.id, target: 3 });
    for (const bad of [null, {}, { ...good, kind: "weird" }, { ...good, target: 0 }, { ...good, startDate: "nope" }, { ...good, endDate: "2025-09-01" }, { ...good, title: " " }]) {
      expect(normalizeChallenge(bad)).toBeNull();
    }
    expect(normalizeChallenge({ ...good, completedAt: "2025-10-03" }).completedAt).toBe("2025-10-03");
    expect(normalizeChallenge({ ...good, completedAt: "junk" })).not.toHaveProperty("completedAt");
  });

  it("round-trips through storage and survives corrupt data", () => {
    const s = store();
    vi.stubGlobal("localStorage", s);
    const c = createChallenge("thirty-days", { now: at(2025, 10, 1) });
    expect(saveChallenges([c])).toBe(true);
    expect(JSON.parse(s._map.get(CHALLENGES_KEY)).version).toBe(1);
    expect(loadChallenges()).toEqual([c]);
    s.setItem(CHALLENGES_KEY, "{oops");
    expect(loadChallenges()).toEqual([]);
  });

  it("merges an import without replacing what you already have", () => {
    const a = createChallenge("thirty-days", { now: at(2025, 10, 1) });
    const b = createChallenge("found-footage-week", { now: at(2025, 10, 1) });
    const { challenges, added } = mergeChallenges([{ ...a, completedAt: "2025-10-20" }], [a, b, { junk: true }]);
    expect(added).toBe(1);
    expect(challenges.map((c) => c.id)).toEqual([a.id, b.id]);
    expect(challenges[0].completedAt).toBe("2025-10-20"); // yours wins
  });
});
