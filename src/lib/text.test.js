import { describe, expect, it } from "vitest";
import { plural } from "./text.js";

describe("plural", () => {
  it("uses the right form of the word", () => {
    expect(plural(1, "film")).toBe("1 film");
    expect(plural(2, "film")).toBe("2 films");
    expect(plural(0, "watch")).toBe("0 watches");
    expect(plural(1, "watch")).toBe("1 watch");
    expect(plural(5, "day")).toBe("5 days");
  });
});
