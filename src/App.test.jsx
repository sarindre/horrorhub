import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _map: map,
  };
}

describe("App smoke render", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders with an empty library", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    const html = renderToString(<App />);
    expect(html).toContain("HorrorHub");
    expect(html).toContain("My Library");
  });

  it("migrates legacy flat settings to the versioned v2 key on load", () => {
    const store = fakeStorage({ "horrorhub.settings.v1": JSON.stringify({ apiKey: " tok ", flicker: false }) });
    vi.stubGlobal("localStorage", store);
    const html = renderToString(<App />);
    expect(html).not.toContain("flicker-spot"); // the migrated flicker=false setting is honored
    const saved = JSON.parse(store._map.get("horrorhub.settings.v2"));
    expect(saved).toMatchObject({ version: 2, settings: { apiKey: "tok", flicker: false, theme: "dark" } });
  });

  it("renders a migrated legacy (v2) library", () => {
    const legacy = [{ id: 1, title: "Hereditary", year: 2018, rating: 4.5, tags: ["Occult"] }];
    const store = fakeStorage({ "horrorhub.library.v2": JSON.stringify(legacy) });
    vi.stubGlobal("localStorage", store);
    expect(() => renderToString(<App />)).not.toThrow();
    expect(JSON.parse(store._map.get("horrorhub.library.v3")).items[0].tags).toEqual(["occult"]);
  });
});
