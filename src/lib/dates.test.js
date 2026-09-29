import { describe, expect, it } from "vitest";
import { addDays, dayKey, daysBetween, isoDateOnly, parseDay } from "./dates.js";

// These run in the timezone set in vite.config.js (west of UTC by default), where
// building a date from "YYYY-MM-DD" text with the Date constructor lands on the previous evening.

describe("local calendar days", () => {
  it("round-trips a day through parseDay and dayKey in any timezone", () => {
    for (const day of ["2025-01-01", "2025-03-09", "2025-10-15", "2025-11-02", "2025-12-31"]) {
      expect(dayKey(parseDay(day))).toBe(day);
    }
  });

  it("parseDay is local midnight, so the local date is the one you asked for", () => {
    const d = parseDay("2025-10-15");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2025, 9, 15, 0]);
  });

  it("dayKey uses the local day, not the UTC day, late in the evening", () => {
    expect(dayKey(new Date(2025, 9, 15, 23, 30))).toBe("2025-10-15");
    expect(dayKey(new Date(2025, 9, 15, 0, 5))).toBe("2025-10-15");
  });

  it("does date math across month ends and daylight-saving changes", () => {
    expect(addDays("2025-10-30", 3)).toBe("2025-11-02");
    expect(addDays("2025-11-02", 1)).toBe("2025-11-03"); // US clocks go back on 2 Nov
    expect(addDays("2025-03-08", 1)).toBe("2025-03-09"); // and forward on 9 Mar
    expect(daysBetween("2025-10-31", "2025-11-04")).toBe(4); // a 25-hour day in between
    expect(daysBetween("2025-03-08", "2025-03-10")).toBe(2); // a 23-hour day in between
    expect(daysBetween("2025-10-15", "2025-10-01")).toBe(-14);
  });

  it("isoDateOnly stores local midnight, which reads back as the same local day", () => {
    const stored = isoDateOnly(new Date(2025, 9, 15, 21, 45));
    expect(dayKey(new Date(stored))).toBe("2025-10-15");
    expect(new Date(stored).getHours()).toBe(0);
  });
});
