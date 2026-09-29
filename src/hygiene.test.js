import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Keeps the dependency list honest: everything under "dependencies" must actually be
// imported by the app, so unused packages (there were six) don't creep back in.

const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(jsx?|mjs)$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}
const imported = new Set();
for (const file of [...sourceFiles(path.join(root, "src")), path.join(root, "index.html")].filter((f) => fs.existsSync(f))) {
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"'./][^"']*)["']/g)) {
    const spec = m[1];
    imported.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
  }
}

describe("dependencies", () => {
  it("every runtime dependency is imported by the app", () => {
    const unused = Object.keys(pkg.dependencies || {}).filter((d) => !imported.has(d));
    expect(unused).toEqual([]);
  });

  it("keeps the runtime dependency list small", () => {
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["lucide-react", "react", "react-dom", "recharts"]);
  });

  it("the app doesn't import anything it hasn't declared", () => {
    const declared = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})]);
    const builtins = new Set(["react/jsx-runtime"]);
    const undeclared = [...imported].filter((d) => !declared.has(d) && !builtins.has(d) && !d.startsWith("node:"));
    expect(undeclared).toEqual([]);
  });
});
