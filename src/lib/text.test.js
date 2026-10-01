import { describe, expect, it } from "vitest";
import { plural } from "./text.js";

describe("plural", () => {
  it("uses the right form of the word", () => {
    expect(plural(1, "film")).toBe("1 film");
    expect(plural(2, "film")).toBe("2 films");
    expect(plural(0, "watch")).toBe("0 watches");
    expect(plural(1, "watch")).toBe("1 watch");
    expect(plural(5, "day")).toBe("5 days");
    expect(plural(3, "entry")).toBe("3 entries");
    expect(plural(1, "entry")).toBe("1 entry");
    expect(plural(2, "shelf")).toBe("2 shelves");
    expect(plural(1, "shelf")).toBe("1 shelf");
  });
});
