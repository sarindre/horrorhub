// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecommendationsView } from "./RecommendationsView.jsx";
import { ToastProvider } from "../../components/Toast.jsx";
import { LIBRARY_PLACE } from "../../lib/touch.js";
import { clearTmdbCache } from "../../lib/tmdb.js";

const WAIT = { timeout: 3000 };
const SEED = { id: 100, title: "Seed Film", year: 2001, rating: 5, tags: ["slasher"], scares: 6, scaresRated: true, watchedDates: ["2025-01-01T00:00:00.000Z"] };
const OWN = (id, title) => ({ id, title, year: 2010, rating: 0, tags: ["slasher"], scares: 5, scaresRated: true, watchlist: true });
const SUGGESTIONS = [1, 2, 3].map((id) => ({ id, title: `Suggested ${id}`, release_date: "2020-01-01", poster_path: null, overview: "", vote_average: 7, genre_ids: [27] }));

beforeEach(() => {
  localStorage.clear();
  clearTmdbCache();
  vi.stubGlobal("fetch", vi.fn(async (url) => {
    const u = String(url);
    if (u.includes("/recommendations")) return { ok: true, status: 200, json: async () => ({ results: SUGGESTIONS }) };
    return { ok: true, status: 200, json: async () => ({ results: [] }) };
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

// A stand-in for the app: rating a suggestion adds it to the library, as the real one does.
function Harness() {
  const [items, setItems] = useState([SEED, OWN(200, "Library A"), OWN(201, "Library B")]);
  const upsert = (it) => setItems((list) => (list.some((i) => i.id === it.id) ? list.map((i) => (i.id === it.id ? { ...i, ...it } : i)) : [...list, it]));
  const ratingById = Object.fromEntries(items.map((i) => [i.id, i.rating || 0]));
  return (
    <ToastProvider>
      <RecommendationsView
        items={items}
        apiKey="tok"
        onAdd={upsert}
        onUpdate={upsert}
        onRemove={() => {}}
        onOpenDetails={() => {}}
        inLibraryIds={new Set(items.map((i) => i.id))}
        watchlistIds={new Set(items.filter((i) => i.watchlist).map((i) => i.id))}
        ratingById={ratingById}
      />
    </ToastProvider>
  );
}

const titles = () => screen.queryAllByTitle("Open details").map((n) => n.textContent.replace(/\s*\(\d{4}\).*$/, "").trim());
const knifeOnFirstSuggestion = (n) => screen.getAllByLabelText("Star rating")[0].querySelectorAll("button")[n - 1];

describe("Tune your picks keeps a card you've touched", () => {
  it("doesn't make a rated suggestion disappear, and says where it went", async () => {
    render(<Harness />);
    await waitFor(() => expect(titles()).toContain("Suggested 1"), WAIT);
    const before = titles();
    fireEvent.click(knifeOnFirstSuggestion(4));
    expect(await screen.findByText(`Rated Suggested 1 4★ and added it to your library. Find it in ${LIBRARY_PLACE}.`, {}, WAIT)).toBeTruthy();
    expect(titles().slice(0, before.length)).toEqual(before); // nothing vanished or moved (the film now also shows under your library picks)
    fireEvent.click(knifeOnFirstSuggestion(5)); // and you can change your mind
    expect(await screen.findByText(/Rated Suggested 1 5★/, {}, WAIT)).toBeTruthy();
    expect(titles()).toContain("Suggested 1");
  });

  it("keeps the library picks in place while you rate one", async () => {
    render(<Harness />);
    await waitFor(() => expect(titles()).toContain("Library A"), WAIT);
    const before = titles();
    const card = screen.getAllByText("Library A")[0].closest("div[class*='min-w-0']") || document.body;
    fireEvent.click(card.querySelectorAll("[aria-label='Star rating'] button")[4]);
    await waitFor(() => expect(screen.getAllByLabelText("Star rating").length).toBeGreaterThan(0), WAIT);
    expect(titles()).toEqual(before);
  });
});
