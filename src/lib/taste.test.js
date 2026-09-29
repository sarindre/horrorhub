import { describe, expect, it } from "vitest";
import { buildTasteProfile, diversifySeeds, isLearning, rankLibrary, ratingAffinity, scoreLibraryItem, tagAffinity } from "./taste.js";
import { isOwnedTitle, ownedTitleKeys } from "./library.js";

const NOW = new Date("2025-10-15T12:00:00Z").getTime();
const film = (id, extra = {}) => ({ id, title: `Film ${id}`, year: 2015, rating: 0, scares: 5, tags: [], watchedDates: [], watchlist: false, ...extra });
const watched = (id, rating, tags, extra = {}) => film(id, { rating, tags, watchedDates: ["2025-09-01T00:00:00.000Z"], ...extra });

describe("ratingAffinity", () => {
  it("maps ratings to -1..1, a bare watch to a mild positive, and a saved film to nothing", () => {
    expect(ratingAffinity({ rating: 5 })).toBe(1);
    expect(ratingAffinity({ rating: 3 })).toBe(0);
    expect(ratingAffinity({ rating: 1 })).toBe(-1);
    expect(ratingAffinity({ rating: 0, watchedDates: ["2025-01-01T00:00:00.000Z"] })).toBe(0.15);
    expect(ratingAffinity({ rating: 0, watchedDates: [], watchlist: true })).toBe(0);
  });
});

describe("buildTasteProfile", () => {
  it("is empty and learning with no signal", () => {
    const p = buildTasteProfile([film(1, { tags: ["occult"] })], { now: NOW }); // saved, not rated or watched
    expect(p.signalCount).toBe(0);
    expect(p.tags).toEqual([]);
    expect(p.scarePref).toBeNull();
    expect(isLearning(p)).toBe(true);
  });

  it("scores loved tags positive and disliked tags negative", () => {
    const items = [
      watched(1, 5, ["folk-horror", "slow-burn"]),
      watched(2, 5, ["folk-horror"]),
      watched(3, 1, ["slasher"]),
      watched(4, 1, ["slasher"]),
    ];
    const p = buildTasteProfile(items, { now: NOW });
    expect(p.tagScore.get("folk-horror").score).toBeGreaterThan(0.3);
    expect(p.tagScore.get("slasher").score).toBeLessThan(-0.3);
    expect(p.likedTags.map((t) => t.tag)).toEqual(["folk-horror"]);
  });

  it("shrinks single-film evidence so one 5-star film can't define a tag", () => {
    const one = buildTasteProfile([watched(1, 5, ["cosmic"])], { now: NOW }).tagScore.get("cosmic").score;
    const many = buildTasteProfile([1, 2, 3, 4, 5].map((i) => watched(i, 5, ["cosmic"])), { now: NOW }).tagScore.get("cosmic").score;
    expect(one).toBeLessThan(many);
    expect(one).toBeLessThan(0.5);
  });

  it("learns the scare level of films you enjoy, ignoring ones you disliked", () => {
    const items = [watched(1, 5, ["a"], { scares: 8 }), watched(2, 5, ["a"], { scares: 8 }), watched(3, 1, ["b"], { scares: 2 })];
    expect(buildTasteProfile(items, { now: NOW }).scarePref).toBeCloseTo(8, 5);
  });

  it("derives which moods you lean toward", () => {
    const items = [watched(1, 5, ["occult", "possession"]), watched(2, 5, ["occult"]), watched(3, 2, ["slasher"]), watched(4, 2, ["slasher"])];
    const p = buildTasteProfile(items, { now: NOW });
    expect(p.lovedMoods.map((m) => m.id)).toContain("occult");
    expect(p.lovedMoods.map((m) => m.id)).not.toContain("slasher");
  });

  it("improves with more data: confidence and learning state change as you rate more", () => {
    const few = buildTasteProfile([1, 2].map((i) => watched(i, 5, ["occult"])), { now: NOW });
    const many = buildTasteProfile(Array.from({ length: 10 }, (_, i) => watched(i, 5, ["occult"])), { now: NOW });
    expect(isLearning(few)).toBe(true);
    expect(isLearning(many)).toBe(false);
    expect(many.tagScore.get("occult").score).toBeGreaterThan(few.tagScore.get("occult").score);
  });
});

describe("scoreLibraryItem", () => {
  const profile = buildTasteProfile(
    [1, 2, 3].map((i) => watched(i, 5, ["folk-horror"], { scares: 7 })),
    { now: NOW }
  );

  it("prefers films that match learned taste and explains why", () => {
    const liked = scoreLibraryItem(film(10, { tags: ["folk-horror"], scares: 7 }), profile, { scare: 7 });
    const other = scoreLibraryItem(film(11, { tags: ["comedy"], scares: 7 }), profile, { scare: 7 });
    expect(liked.score).toBeGreaterThan(other.score);
    expect(liked.reasons).toContain("You tend to enjoy #folk-horror");
    expect(liked.reasons).toContain("Right at your usual scare level");
  });

  it("penalizes tags you consistently rate low", () => {
    const p = buildTasteProfile([watched(1, 1, ["slasher"]), watched(2, 1, ["slasher"]), watched(3, 1, ["slasher"])], { now: NOW });
    const bad = scoreLibraryItem(film(10, { tags: ["slasher"] }), p, { scare: 5 });
    const neutral = scoreLibraryItem(film(11, { tags: ["other"] }), p, { scare: 5 });
    expect(bad.score).toBeLessThan(neutral.score);
  });

  it("applies the night vibe, the watchlist and the mixer, and says so", () => {
    const base = film(10, { tags: ["occult"], watchlist: true });
    const plain = scoreLibraryItem(base, profile, { scare: 5 });
    const vibe = scoreLibraryItem(base, profile, { scare: 5, moodId: "occult" });
    expect(vibe.score).toBeGreaterThan(plain.score + 0.6);
    expect(vibe.reasons).toContain("Matches your Occult vibe");
    expect(vibe.reasons).toContain("On your watchlist");
    const boosted = scoreLibraryItem(base, profile, { scare: 5, mixer: { ghosts: 1, occult: 2, slasher: 1, folk: 1 } });
    const muted = scoreLibraryItem(base, profile, { scare: 5, mixer: { ghosts: 1, occult: 0, slasher: 1, folk: 1 } });
    expect(boosted.score).toBeGreaterThan(muted.score);
  });

  it("always gives a reason", () => {
    const empty = buildTasteProfile([], { now: NOW });
    expect(scoreLibraryItem(film(1, { scares: 5 }), empty, { scare: 5 }).reasons).toEqual(["Fits tonight's scare level"]);
    expect(scoreLibraryItem(film(2, { scares: 0 }), empty, { scare: 10 }).reasons).toEqual(["From your library"]);
  });
});

describe("rankLibrary", () => {
  const profile = buildTasteProfile([], { now: NOW });

  it("suppresses films you've already watched and unreleased ones", () => {
    const items = [film(1), watched(2, 5, []), film(3, { year: 2099 })];
    expect(rankLibrary(items, profile, {}, { now: NOW }).map((r) => r.item.id)).toEqual([1]);
  });

  it("falls back to everything released when all are watched", () => {
    const items = [watched(1, 5, []), watched(2, 4, [])];
    expect(rankLibrary(items, profile, {}, { now: NOW })).toHaveLength(2);
  });

  it("drops duplicates (same id or same title + year) and honors the limit", () => {
    const items = [film(1, { title: "Dup" }), film("x", { title: "Dup" }), film(2, { title: "Other" }), film(3, { title: "Third" })];
    const ranked = rankLibrary(items, profile, {}, { limit: 2, now: NOW });
    expect(ranked).toHaveLength(2);
    expect(new Set(ranked.map((r) => r.item.title)).size).toBe(2);
  });

  it("ranks by tonight's scare level", () => {
    const items = [film(1, { scares: 2 }), film(2, { scares: 9 })];
    expect(rankLibrary(items, profile, { scare: 9 }, { now: NOW })[0].item.id).toBe(2);
    expect(rankLibrary(items, profile, { scare: 1 }, { now: NOW })[0].item.id).toBe(1);
  });
});

describe("tagAffinity / diversifySeeds", () => {
  it("returns 0..1 based on how well tags match what you love", () => {
    const p = buildTasteProfile([1, 2, 3].map((i) => watched(i, 5, ["occult"])), { now: NOW });
    expect(tagAffinity(film(9, { tags: ["occult"] }), p)).toBeGreaterThan(0.3);
    expect(tagAffinity(film(9, { tags: ["unknown"] }), p)).toBe(0);
  });

  it("spreads seeds across subgenres when weights are close", () => {
    const cands = [
      { id: 1, title: "A", weight: 1.0, tags: ["slasher"] },
      { id: 2, title: "B", weight: 0.98, tags: ["slasher"] },
      { id: 3, title: "C", weight: 0.9, tags: ["occult"] },
    ];
    expect(diversifySeeds(cands, 2).map((c) => c.id)).toEqual([1, 3]);
    expect(diversifySeeds(cands, 3).map((c) => c.id)).toHaveLength(3);
  });
});

describe("owned title matching", () => {
  it("matches an imported string-id film to the same TMDb title + year", () => {
    const keys = ownedTitleKeys([{ id: "letterboxd:Hereditary:2018", title: "Hereditary", year: 2018 }]);
    expect(isOwnedTitle(keys, { title: "Hereditary", year: "2018" })).toBe(true);
    expect(isOwnedTitle(keys, { title: "Hereditary", year: "1999" })).toBe(false);
  });

  it("matches on title alone when the library entry has no year, ignoring punctuation and case", () => {
    const keys = ownedTitleKeys([{ id: "imdb:tt1", title: "The Texas Chain Saw Massacre" }]);
    expect(isOwnedTitle(keys, { title: "the texas chain saw massacre!", year: "1974" })).toBe(true);
  });
});
