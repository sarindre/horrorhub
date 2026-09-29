// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import { ShimmerImage } from "./components/ShimmerImage.jsx";
import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion.js";
import { LIBRARY_KEY } from "./lib/library.js";
import { SETTINGS_KEY } from "./lib/settings.js";

// Performance and motion behavior: paging, lazy screens, reduced motion, image loading.

function stubMatchMedia(reduced) {
  const listeners = new Set();
  const media = {
    matches: reduced,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  vi.stubGlobal("matchMedia", (query) => (query.includes("reduced-motion") ? media : { matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
  return {
    change(next) {
      media.matches = next;
      listeners.forEach((fn) => fn());
    },
  };
}

const settings = (extra = {}) => localStorage.setItem(SETTINGS_KEY, JSON.stringify({ version: 2, settings: extra }));
const seed = (items) => localStorage.setItem(LIBRARY_KEY, JSON.stringify({ version: 3, items }));
const tab = (name) => screen.getByRole("tab", { name });

beforeEach(() => {
  localStorage.clear();
  // jsdom has no ResizeObserver, which the charting library (Stats) uses
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("library paging", () => {
  const films = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1, title: `Zed Film ${String(i + 1).padStart(3, "0")}`, year: 2000,
    addedAt: new Date(2025, 0, 1, 0, 0, 60 - i).toISOString(), // newest first, in index order
  }));

  it("renders one page of cards, then more on request", () => {
    settings({ flicker: false, fog: false });
    seed(films);
    render(<App />);
    fireEvent.click(tab("My Library"));
    expect(screen.getByText(/Zed Film 048/)).toBeTruthy();
    expect(screen.queryByText(/Zed Film 049/)).toBeNull();
    expect(screen.getByText(/Showing 48 of 60/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText(/Zed Film 060/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("goes back to the first page when a filter changes", () => {
    settings({ flicker: false, fog: false });
    seed(films.map((f, i) => ({ ...f, tags: i % 2 ? ["slasher"] : ["haunted"] })));
    render(<App />);
    fireEvent.click(tab("My Library"));
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByText(/Zed Film 060/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /#slasher/ })); // 30 films: fits on one page
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "All tags" }));
    expect(screen.getByText(/Showing 48 of 60/)).toBeTruthy(); // reset to a single page
  });

  it("shows no pager for a small library", () => {
    settings({ flicker: false, fog: false });
    seed(films.slice(0, 10));
    render(<App />);
    fireEvent.click(tab("My Library"));
    expect(screen.queryByText(/Showing/)).toBeNull();
  });
});

describe("lazy screens", () => {
  it("loads Stats on demand and shows it", async () => {
    settings({ flicker: false, fog: false });
    seed([{ id: 1, title: "A Film", year: 2000, rating: 4, watchedDates: ["2024-10-01T00:00:00.000Z"] }]);
    render(<App />);
    fireEvent.click(tab("Stats"));
    expect(await screen.findByText("Watch heatmap", {}, { timeout: 5000 })).toBeTruthy();
  });

  it("opens film details through the lazy view without losing the Back button", async () => {
    settings({ flicker: false, fog: false });
    seed([{ id: 1, title: "Lazy Detail Film", year: 2000, overview: "Details overview text." }]);
    render(<App />);
    fireEvent.click(tab("My Library"));
    fireEvent.click(screen.getAllByText(/Lazy Detail Film/)[0]);
    expect(screen.getByText("← Back")).toBeTruthy(); // present immediately, even while the chunk loads
    expect((await screen.findAllByText("Details overview text.", {}, { timeout: 5000 })).length).toBeGreaterThan(0);
  });
});

describe("reduced motion", () => {
  it("reports the preference and follows changes", () => {
    const mq = stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => mq.change(true));
    expect(result.current).toBe(true);
    act(() => mq.change(false));
    expect(result.current).toBe(false);
  });

  it("is false where matchMedia doesn't exist (server render, old browsers)", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });

  it("shows the flicker and fog effects normally", () => {
    stubMatchMedia(false);
    settings({ flicker: true, fog: true });
    const { container } = render(<App />);
    expect(container.querySelector(".flicker-spot")).toBeTruthy();
    expect(container.querySelector(".fog-layer")).toBeTruthy();
  });

  it("removes them entirely (not just hides them) when the device asks for reduced motion", () => {
    stubMatchMedia(true);
    settings({ flicker: true, fog: true });
    const { container } = render(<App />);
    expect(container.querySelector(".flicker-spot")).toBeNull();
    expect(container.querySelector(".fog-layer")).toBeNull();
  });

  it("tells you in Settings why the switches aren't doing anything", () => {
    stubMatchMedia(true);
    settings({ flicker: true, fog: true });
    render(<App />);
    fireEvent.click(tab("Settings"));
    expect(screen.getByRole("note").textContent).toMatch(/reduced motion/i);
  });
});

describe("images", () => {
  it("are lazy-loaded and decoded off the main thread", () => {
    const html = renderToString(<ShimmerImage src="/p.jpg" alt="Poster" className="w-16" />);
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });
});
