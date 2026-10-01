// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App.jsx";
import { SETTINGS_KEY, SECRET_KEYS, normalizeSettings, portableSettings, settingsDiffer, settingsFromImport } from "../../lib/settings.js";
import { buildExport } from "../../lib/library.js";

describe("portableSettings", () => {
  it("includes your limits, region, appearance and taste quiz, and no API keys", () => {
    const p = portableSettings({ apiKey: "tok", omdbKey: "o", dddKey: "d", region: "GB", maxScares: 6, avoidFlags: ["gore"], theme: "light", calibration: { answers: { "halloween-1978": "loved" }, doneAt: "2026-01-01T00:00:00.000Z" } });
    expect(p).toMatchObject({ region: "GB", maxScares: 6, avoidFlags: ["gore"], theme: "light" });
    expect(p.calibration.answers).toEqual({ "halloween-1978": "loved" });
    for (const k of SECRET_KEYS) expect(k in p).toBe(false);
    expect(JSON.stringify(p)).not.toMatch(/tok|"o"|"d"/);
  });
  it("makes it into an export", () => {
    const out = buildExport([], { settings: portableSettings({ apiKey: "secret", region: "FR" }) });
    expect(out.settings.region).toBe("FR");
    expect(JSON.stringify(out)).not.toContain("secret");
  });
});

describe("settingsFromImport", () => {
  it("takes only keys the file had, and checks each", () => {
    expect(settingsFromImport({ region: "GB", maxScares: 99, theme: "nonsense" })).toEqual({ region: "GB", maxScares: 10, theme: "dark" });
    expect(Object.keys(settingsFromImport({ region: "GB" }))).toEqual(["region"]); // not every default
  });
  it("can never set or change an API key", () => {
    expect(settingsFromImport({ apiKey: "evil", omdbKey: "x", dddKey: "y", region: "GB" })).toEqual({ region: "GB" });
  });
  it("copes with junk", () => {
    for (const bad of [null, undefined, 5, "x", [], [1]]) expect(settingsFromImport(bad)).toEqual({});
  });
  it("tells when applying would change something", () => {
    const current = normalizeSettings({ region: "GB", maxScares: 6 });
    expect(settingsDiffer(current, { region: "GB", maxScares: 6 })).toBe(false);
    expect(settingsDiffer(current, { region: "FR" })).toBe(true);
    expect(settingsDiffer(current, { avoidFlags: ["gore"] })).toBe(true);
    expect(settingsDiffer(current, {})).toBe(false);
  });
});

describe("importing a backup that has settings", () => {
  const WAIT = { timeout: 4000 };
  const stored = () => JSON.parse(localStorage.getItem(SETTINGS_KEY)).settings;
  let confirms;

  const upload = async (payload) => {
    const input = document.querySelector('input[type="file"][accept="application/json"]');
    const file = new File([JSON.stringify(payload)], "backup.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
  };

  beforeEach(() => {
    window.location.hash = "#settings";
    localStorage.clear();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: { flicker: false, fog: false, apiKey: "my-token", region: "US", maxScares: 10 } }));
    localStorage.setItem("horrorhub.prefs.v1", JSON.stringify({ version: 1, values: { "onboarding.dismissed": true, "help.autoOpen": false, "backup.snoozedUntil": "2999-01-01T00:00:00.000Z" } }));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const backup = { app: "horrorhub", version: 3, items: [{ id: 1, title: "Restored Film", year: 2000 }], settings: { region: "GB", maxScares: 6, avoidFlags: ["gore"], apiKey: "evil" } };

  it("asks, then applies the settings but keeps your token", async () => {
    confirms = [];
    vi.spyOn(window, "confirm").mockImplementation((message) => (confirms.push(message), true));
    render(<App />);
    await screen.findByText("Reset app", {}, WAIT);
    await upload(backup);
    await waitFor(() => expect(stored().region).toBe("GB"), WAIT);
    expect(stored()).toMatchObject({ maxScares: 6, avoidFlags: ["gore"], apiKey: "my-token" }); // the file's "evil" key is ignored
    expect(confirms).toHaveLength(2); // the library summary, then the settings
    expect(confirms[1]).toMatch(/settings it was saved with/);
    expect(confirms[1]).toMatch(/API keys are never changed/);
    expect(await screen.findByText(/Imported from JSON: 1 new.*your settings/, {}, WAIT)).toBeTruthy();
  });

  it("leaves your settings alone if you say no, but still imports the films", async () => {
    vi.spyOn(window, "confirm").mockImplementation((message) => !/settings it was saved with/.test(message));
    render(<App />);
    await screen.findByText("Reset app", {}, WAIT);
    await upload(backup);
    expect(await screen.findByText(/Imported from JSON: 1 new/, {}, WAIT)).toBeTruthy();
    expect(stored()).toMatchObject({ region: "US", maxScares: 10, apiKey: "my-token" });
    expect(screen.queryByText(/your settings/)).toBeNull();
  });

  it("doesn't ask when the settings are the same as yours", async () => {
    confirms = [];
    vi.spyOn(window, "confirm").mockImplementation((message) => (confirms.push(message), true));
    render(<App />);
    await screen.findByText("Reset app", {}, WAIT);
    await upload({ ...backup, settings: { region: "US", maxScares: 10 } });
    await screen.findByText(/Imported from JSON: 1 new/, {}, WAIT);
    expect(confirms).toHaveLength(1);
  });

  it("an older backup without settings imports as before", async () => {
    confirms = [];
    vi.spyOn(window, "confirm").mockImplementation((message) => (confirms.push(message), true));
    render(<App />);
    await screen.findByText("Reset app", {}, WAIT);
    await upload({ ...backup, settings: undefined });
    await screen.findByText(/Imported from JSON: 1 new/, {}, WAIT);
    expect(confirms).toHaveLength(1);
    expect(stored().region).toBe("US");
  });
});
