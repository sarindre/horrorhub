import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("the TMDb logo file", () => {
  it("is TMDb's own, unmodified (their brand rules forbid changing it)", () => {
    const bytes = readFileSync(resolve("src/assets/tmdb-logo.svg"));
    // TMDb names the file after this hash, so a match means it is exactly what they publish
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c");
  });
});
