import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { APP_HOST, appUrl, isAppUrl, isSafeExternal, permissionAllowed, resolveAppFile } = require("../../electron/policy.cjs");

describe("which addresses the window may show", () => {
  it("only the app's own pages", () => {
    expect(isAppUrl(appUrl())).toBe(true);
    expect(isAppUrl(appUrl("assets/index.js"))).toBe(true);
    expect(isAppUrl(`app://${APP_HOST}/#stats`)).toBe(true);
    for (const url of ["https://example.com/", "app://evil/", "file:///C:/Windows/win.ini", "http://horrorhub/", "javascript:alert(1)", "", "not a url"]) expect(isAppUrl(url)).toBe(false);
  });
});

describe("which links may open in the user's browser", () => {
  it("web addresses only", () => {
    expect(isSafeExternal("https://www.themoviedb.org/")).toBe(true);
    expect(isSafeExternal("http://example.com/x")).toBe(true);
    for (const url of ["file:///C:/Windows/System32/calc.exe", "app://horrorhub/", "javascript:alert(1)", "ms-msdt:/id", "vscode://x", "", "nope"]) expect(isSafeExternal(url)).toBe(false);
  });
});

describe("resolveAppFile", () => {
  const root = path.resolve("/srv/app/dist");
  it("serves the page for the root and files inside the app folder", () => {
    expect(resolveAppFile(root, "/")).toBe(path.join(root, "index.html"));
    expect(resolveAppFile(root, "")).toBe(path.join(root, "index.html"));
    expect(resolveAppFile(root, "/assets/index-abc.js")).toBe(path.join(root, "assets", "index-abc.js"));
    expect(resolveAppFile(root, "/icons/icon-192.png")).toBe(path.join(root, "icons", "icon-192.png"));
  });
  it("never leaves the app folder, however the path is written", () => {
    for (const bad of ["/../secret.txt", "/../../etc/passwd", "/assets/../../x", "/%2e%2e/%2e%2e/x", "/..%2f..%2fx", "/assets/..%5c..%5cx"]) {
      const r = resolveAppFile(root, bad);
      expect(r === null || r.startsWith(root + path.sep) || r === root).toBe(true);
    }
    expect(resolveAppFile(root, "/../secret.txt")).toBeNull();
    expect(resolveAppFile(root, "/%2e%2e/%2e%2e/x")).toBeNull();
  });
  it("refuses broken or hostile input", () => {
    expect(resolveAppFile(root, "/%E0%A4%A")).toBeNull();
    expect(resolveAppFile(root, "/a\0b")).toBeNull();
  });
});

describe("permissions", () => {
  it("allows the few the app needs, for its own pages only", () => {
    expect(permissionAllowed("clipboard-sanitized-write", appUrl())).toBe(true);
    expect(permissionAllowed("notifications", appUrl())).toBe(true);
    expect(permissionAllowed("fileSystem", appUrl())).toBe(true);
  });
  it("refuses everything else, and refuses other pages", () => {
    for (const p of ["media", "geolocation", "camera", "microphone", "openExternal", "midi", "hid", "usb"]) expect(permissionAllowed(p, appUrl())).toBe(false);
    expect(permissionAllowed("notifications", "https://evil.example/")).toBe(false);
  });
});
