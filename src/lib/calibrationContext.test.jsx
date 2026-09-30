// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CalibrationContext, useTasteProfile } from "./calibrationContext.js";

const cal = { answers: { "halloween-1978": "loved", "scream-1996": "loved", "tcm-1974": "loved" }, doneAt: "2026-01-01T00:00:00.000Z" };

describe("useTasteProfile", () => {
  it("includes the quiz answers when the app provides them", () => {
    const { result } = renderHook(() => useTasteProfile([]), { wrapper: ({ children }) => <CalibrationContext.Provider value={cal}>{children}</CalibrationContext.Provider> });
    expect(result.current.seedCount).toBe(3);
    expect(result.current.likedTags.map((t) => t.tag)).toContain("slasher");
  });
  it("works with no quiz taken", () => {
    const { result } = renderHook(() => useTasteProfile([]));
    expect(result.current.seedCount).toBe(0);
  });
});
