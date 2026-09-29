import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, getMixer, loadSettings, normalizeSettings, saveSettings, SETTINGS_KEY } from "./settings.js";
import { getPref, PREFS_KEY, setPref } from "./prefs.js";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), _map: map };
}

describe("normalizeSettings", () => {
  it("fills every default for empty or junk input", () => {
    for (const raw of [undefined, null, {}, [], "nope", 5]) expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and drops unknown keys", () => {
    const s = normalizeSettings({ theme: "light", flicker: false, nudgeDays: 10, whatever: 1 });
    expect(s).toMatchObject({ theme: "light", flicker: false, nudgeDays: 10 });
    expect(s).not.toHaveProperty("whatever");
  });

  it("clamps numbers and rejects bad enums", () => {
    const s = normalizeSettings({ theme: "neon", nudgeDays: 99, longAgoYear: 1500, mixerGhosts: 7, mixerFolk: -1 });
    expect(s).toMatchObject({ theme: "dark", nudgeDays: 14, longAgoYear: 1800, mixerGhosts: 2, mixerFolk: 0 });
    expect(normalizeSettings({ nudgeDays: "abc" }).nudgeDays).toBe(DEFAULT_SETTINGS.nudgeDays);
  });

  it("trims pasted API keys", () => {
    expect(normalizeSettings({ apiKey: "  abc.def \n", omdbKey: " k " })).toMatchObject({ apiKey: "abc.def", omdbKey: "k" });
  });

  it("cleans the weekly plan", () => {
    const s = normalizeSettings({ planDays: [6, 1, 1, 9, "x", 0], planTime: "25:00" });
    expect(s.planDays).toEqual([0, 1, 6]);
    expect(s.planTime).toBe("20:00");
    expect(normalizeSettings({ planTime: "07:30" }).planTime).toBe("07:30");
  });

  it("exposes the mixer under short names", () => {
    expect(getMixer(normalizeSettings({ mixerGhosts: 2, mixerOccult: 0 }))).toEqual({ ghosts: 2, occult: 0, slasher: 1, folk: 1 });
  });
});

describe("settings storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("migrates flat v1 settings (plus the stray longAgoYear key) to v2 and keeps v1", () => {
    const store = fakeStorage({
      "horrorhub.settings.v1": JSON.stringify({ apiKey: " tok ", theme: "system", seasonal: true, flicker: false }),
      "horrorhub.longAgoYear": "1985",
    });
    vi.stubGlobal("localStorage", store);
    const s = loadSettings();
    expect(s).toMatchObject({ apiKey: "tok", theme: "system", flicker: false, longAgoYear: 1985 });
    expect(s).not.toHaveProperty("seasonal");
    expect(JSON.parse(store._map.get(SETTINGS_KEY)).version).toBe(2);
    expect(store._map.has("horrorhub.settings.v1")).toBe(true);
  });

  it("round-trips v2 and survives corrupt storage", () => {
    const store = fakeStorage();
    vi.stubGlobal("localStorage", store);
    saveSettings(normalizeSettings({ theme: "light" }));
    expect(loadSettings().theme).toBe("light");
    store.setItem(SETTINGS_KEY, "{not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe("prefs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("adopts an old per-key preference the first time it is read", () => {
    const store = fakeStorage({ "horrorhub.discover.hideInLibrary": "true" });
    vi.stubGlobal("localStorage", store);
    expect(getPref("discover.hideInLibrary", false)).toBe(true);
    expect(getPref("discover.providers", [])).toEqual([]);
  });

  it("stores everything in one versioned object and prefers it over legacy keys", () => {
    const store = fakeStorage({ "horrorhub.roulette.pageSize": "20" });
    vi.stubGlobal("localStorage", store);
    setPref("roulette.pageSize", 9);
    setPref("discover.providers", ["hulu"]);
    expect(JSON.parse(store._map.get(PREFS_KEY))).toEqual({ version: 1, values: { "roulette.pageSize": 9, "discover.providers": ["hulu"] } });
    expect(getPref("roulette.pageSize", 12)).toBe(9);
  });
});
