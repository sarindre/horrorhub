// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_PREFIX, POSTER_CACHE, appKeys, clearAppStorage, resetApp } from "./reset.js";
import { SETTINGS_KEY, loadSettings, saveSettings, normalizeSettings } from "./settings.js";
import { LIBRARY_KEY } from "./library.js";
import { fakeIndexedDB } from "../test/fakeFolder.js";
import { loadHandle, saveHandle } from "./folderBackup.js";

const seed = () => {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 3, items: [{ id: 1, title: "A" }] }));
  localStorage.setItem("horrorhub.library.v2", "[]"); // an old-version backup
  localStorage.setItem("horrorhub.shelves.v1", "{}");
  localStorage.setItem("horrorhub.challenges.v1", "{}");
  localStorage.setItem("horrorhub.prefs.v1", "{}");
  localStorage.setItem("horrorhub.recs.cache.v1", "{}");
  localStorage.setItem("someone-elses-key", "keep me");
  localStorage.setItem("horrorhubby", "not ours");
  saveSettings(normalizeSettings({ apiKey: "tok", omdbKey: "o", region: "GB", maxScares: 6, avoidFlags: ["gore"], calibration: { answers: { "halloween-1978": "loved" }, doneAt: "2026-01-01T00:00:00.000Z" } }));
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("appKeys", () => {
  it("finds only keys that belong to the app", () => {
    seed();
    const keys = appKeys();
    expect(keys.every((k) => k.startsWith(APP_PREFIX))).toBe(true);
    expect(keys).toContain(LIBRARY_KEY);
    expect(keys).toContain("horrorhub.library.v2");
    expect(keys).not.toContain("someone-elses-key");
    expect(keys).not.toContain("horrorhubby"); // no dot, not ours
  });
});

describe("clearAppStorage", () => {
  it("erases everything of ours, including old-version copies, and nothing else", () => {
    seed();
    const removed = clearAppStorage();
    expect(removed).toBeGreaterThan(5);
    expect(appKeys()).toEqual([]);
    expect(localStorage.getItem("someone-elses-key")).toBe("keep me");
    expect(localStorage.getItem("horrorhub" + "by")).toBe("not ours");
  });

  it("can keep your settings and keys, but forgets your taste quiz", () => {
    seed();
    clearAppStorage({ keepSettings: true });
    expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
    expect(appKeys()).toEqual([SETTINGS_KEY]);
    const s = loadSettings();
    expect(s).toMatchObject({ apiKey: "tok", omdbKey: "o", region: "GB", maxScares: 6, avoidFlags: ["gore"] });
    expect(s.calibration).toEqual({ answers: {}, doneAt: "" });
  });

  it("is fine on an already empty browser", () => {
    expect(clearAppStorage()).toBe(0);
    expect(clearAppStorage({ keepSettings: true })).toBeGreaterThanOrEqual(0);
  });
});

describe("resetApp", () => {
  it("also forgets the backup folder, deletes saved posters, and reloads", async () => {
    vi.stubGlobal("indexedDB", fakeIndexedDB());
    const deleted = [];
    vi.stubGlobal("caches", { delete: vi.fn(async (name) => deleted.push(name)) });
    await saveHandle({ name: "Backups" });
    expect(await loadHandle()).not.toBeNull();
    seed();
    const reload = vi.fn();
    await resetApp({ reload });
    expect(appKeys()).toEqual([]);
    expect(await loadHandle()).toBeNull();
    expect(deleted).toEqual([POSTER_CACHE]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("still finishes if the browser has no folder or cache storage", async () => {
    vi.stubGlobal("indexedDB", { open: () => { throw new Error("blocked"); } });
    vi.stubGlobal("caches", undefined);
    seed();
    const reload = vi.fn();
    await resetApp({ keepSettings: true, reload });
    expect(localStorage.getItem(LIBRARY_KEY)).toBeNull();
    expect(reload).toHaveBeenCalled();
  });

  it("reloads only after the data is gone", async () => {
    vi.stubGlobal("indexedDB", fakeIndexedDB());
    vi.stubGlobal("caches", { delete: async () => {} });
    seed();
    let leftAtReload = -1;
    await resetApp({ reload: () => { leftAtReload = appKeys().length; } });
    expect(leftAtReload).toBe(0);
  });
});
