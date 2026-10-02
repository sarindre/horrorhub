import { describe, expect, it } from "vitest";
import { challengeWatches, moveWatch, removeWatch } from "./challengeWatches.js";
import { isoDateOnly, parseDay } from "./dates.js";
import { evaluateChallenge } from "./challenges.js";

const at = (day) => isoDateOnly(parseDay(day));
const film = (id, dates, extra = {}) => ({ id, title: `Film ${id}`, tags: [], watchedDates: dates.map(at), ...extra });
const daily = { id: "c", kind: "daily", target: 31, startDate: "2026-10-01", endDate: "2026-10-31" };

describe("challengeWatches", () => {
  it("lists every watch in the window of a daily challenge, newest first", () => {
    const library = [film(1, ["2026-10-01", "2026-09-20"]), film(2, ["2026-10-01", "2026-10-03"])];
    const result = evaluateChallenge(daily, library, parseDay("2026-10-04"));
    expect(challengeWatches(daily, library, result).map((w) => `${w.day} ${w.item.id}`)).toEqual(["2026-10-03 2", "2026-10-01 1", "2026-10-01 2"]);
  });
});

describe("removeWatch", () => {
  it("drops that day's watch and note and keeps the rest", () => {
    const f = film(1, ["2026-10-01", "2026-10-02"], { diary: [{ day: "2026-10-01", scared: 5 }, { day: "2026-10-02", scared: 7 }] });
    const next = removeWatch(f, "2026-10-01");
    expect(next.watchedDates).toEqual([at("2026-10-02")]);
    expect(next.diary).toEqual([{ day: "2026-10-02", scared: 7 }]);
  });
});

describe("moveWatch", () => {
  it("moves a watch to another day, with its diary note", () => {
    const f = film(1, ["2026-10-02"], { diary: [{ day: "2026-10-02", scared: 6 }] });
    const next = moveWatch(f, "2026-10-02", "2026-10-01");
    expect(next.watchedDates).toEqual([at("2026-10-01")]);
    expect(next.diary).toEqual([{ day: "2026-10-01", scared: 6 }]);
  });
  it("doesn't double up when the film was already watched on the new day", () => {
    const next = moveWatch(film(1, ["2026-10-01", "2026-10-02"]), "2026-10-02", "2026-10-01");
    expect(next.watchedDates).toEqual([at("2026-10-01")]);
  });
  it("does nothing when the day is unchanged", () => {
    const f = film(1, ["2026-10-02"]);
    expect(moveWatch(f, "2026-10-02", "2026-10-02")).toBe(f);
  });
});
