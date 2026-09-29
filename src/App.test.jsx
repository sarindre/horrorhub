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

  it("renders a migrated legacy (v2) library", () => {
    const legacy = [{ id: 1, title: "Hereditary", year: 2018, rating: 4.5, tags: ["Occult"] }];
    const store = fakeStorage({ "horrorhub.library.v2": JSON.stringify(legacy) });
    vi.stubGlobal("localStorage", store);
    expect(() => renderToString(<App />)).not.toThrow();
    expect(JSON.parse(store._map.get("horrorhub.library.v3")).items[0].tags).toEqual(["occult"]);
  });
});
