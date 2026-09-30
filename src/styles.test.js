import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guards against the Vite starter template's global CSS creeping back in. Unlayered element
// rules (button, h1, body...) beat Tailwind's layered utility classes, which once made every
// button an oversized dark pill and let the page grow wider than a phone screen.

const css = fs.readFileSync(path.join(import.meta.dirname, "index.css"), "utf8");

// drop the @layer base block (where element defaults belong), keeping everything else
function withoutBaseLayer(text) {
  const start = text.indexOf("@layer base {");
  if (start < 0) return text;
  let depth = 0;
  for (let i = text.indexOf("{", start); i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}" && --depth === 0) return text.slice(0, start) + text.slice(i + 1);
  }
  return text;
}

describe("global styles", () => {
  const unlayered = withoutBaseLayer(css);

  it("keeps element selectors out of the unlayered CSS", () => {
    const offenders = [...unlayered.matchAll(/^\s*((?:html|body|a|button|input|select|textarea|h[1-6]|p|ul|ol|li|img)\b[^{,]*)[,{]/gm)].map((m) => m[1].trim());
    expect(offenders).toEqual([]);
  });

  it("doesn't turn the page into a centered flex container (which stops content shrinking to the viewport)", () => {
    expect(css).not.toMatch(/body\s*\{[^}]*display:\s*flex/);
    expect(css).not.toMatch(/place-items:\s*center/);
  });

  it("keeps the element defaults it does need in the base layer", () => {
    expect(css).toContain("@layer base");
    expect(css).toMatch(/:focus-visible/); // a visible focus style for keyboard users
  });
});
