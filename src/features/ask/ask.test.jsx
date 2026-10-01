// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AskView } from "./AskView.jsx";
import { ContentPrefsContext } from "../../lib/contentContext.js";
import { clearTmdbCache } from "../../lib/tmdb.js";

const WAIT = { timeout: 3000 };
const film = (id, over = {}) => ({ id, title: `Film ${id}`, year: 2010, tags: [], contentFlags: [], runtime: 100, scares: 5, scaresRated: true, rating: 0, watchedDates: [], watchlist: false, overview: "", keywords: [], ...over });
const library = [
  film(1, { title: "Folk Slow", tags: ["folk-horror", "slow-burn"], runtime: 95, scares: 4 }),
  film(2, { title: "Folk Long", tags: ["folk-horror"], runtime: 140 }),
  film(3, { title: "Animal Folk", tags: ["folk-horror", "slow-burn"], runtime: 90, contentFlags: ["animal-harm"] }),
  film(4, { title: "A Slasher", tags: ["slasher"], runtime: 88, year: 1984 }),
];

const setup = (props = {}) => render(<AskView library={library} apiKey="" region="US" onOpenDetails={() => {}} onAdd={() => {}} onUpdate={() => {}} {...props} />);
const ask = (q) => {
  fireEvent.change(screen.getByLabelText("Ask HorrorHub"), { target: { value: q } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
};
const libraryTitles = () => within(screen.getByRole("region", { name: "From your library" })).queryAllByTitle("Open details").filter((n) => n.textContent.trim()).map((n) => n.textContent.replace(/\s*\(\d{4}\).*$/, ""));

beforeEach(() => { localStorage.clear(); clearTmdbCache(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Ask HorrorHub", () => {
  it("offers examples, and an example asks itself", () => {
    setup();
    expect(screen.getByText("Try")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Gentle slashers from the 80s/ }));
    expect(screen.getByLabelText("Ask HorrorHub").value).toMatch(/Gentle slashers/);
    expect(screen.getByLabelText("What I understood")).toBeTruthy();
  });

  it("answers the headline question from your library and shows how it was understood", () => {
    setup();
    ask("Slow-burn folk horror under 100 minutes, no animal harm");
    const chips = within(screen.getByLabelText("What I understood")).getAllByRole("listitem").map((c) => c.textContent);
    expect(chips).toEqual(["#slow-burn", "#folk-horror", "no animal harm", "under 100 min"]);
    expect(libraryTitles()).toEqual(["Folk Slow"]);
    expect(screen.getByText(/Matches #slow-burn and #folk-horror \(2 of 2\)/)).toBeTruthy();
    expect(screen.getByText(/Left out: 1 film that has animal harm/)).toBeTruthy();
    expect(screen.getByText(/isn't guaranteed to be free/)).toBeTruthy();
  });

  it("says what it ignored", () => {
    setup();
    ask("slashers banana");
    expect(screen.getByText("I didn't use: banana")).toBeTruthy();
    expect(libraryTitles()).toEqual(["A Slasher"]);
  });

  it("explains itself when it understands nothing", () => {
    setup();
    ask("xyzzy plugh");
    expect(screen.getByText(/couldn't pick out anything/)).toBeTruthy();
    expect(screen.getByText("I didn't use: xyzzy, plugh")).toBeTruthy();
  });

  it("says when nothing in the library fits", () => {
    setup();
    ask("vampires");
    expect(screen.getByText("Nothing in your library fits that.")).toBeTruthy();
  });

  it("asks on Enter as well as the button", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Ask HorrorHub"), { target: { value: "slashers" } });
    fireEvent.submit(screen.getByLabelText("Ask HorrorHub").closest("form"));
    expect(libraryTitles()).toEqual(["A Slasher"]);
  });

  it("applies your own content limits in hide mode, and counts what it hid", () => {
    const prefs = { showWarnings: true, avoidFlags: ["animal-harm"], maxScares: 10, contentMode: "hide" };
    render(
      <ContentPrefsContext.Provider value={prefs}>
        <AskView library={library} apiKey="" onOpenDetails={() => {}} onAdd={() => {}} onUpdate={() => {}} />
      </ContentPrefsContext.Provider>
    );
    ask("folk horror");
    expect(libraryTitles()).not.toContain("Animal Folk");
    expect(screen.getByText(/1 film is hidden by your content limits/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show anyway" }));
    expect(libraryTitles()).toContain("Animal Folk");
  });
});

describe("looking on TMDb", () => {
  const stub = () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      const u = String(url);
      calls.push(u);
      if (u.includes("/search/keyword")) return { ok: true, status: 200, json: async () => ({ results: [{ id: 9, name: "folk horror" }] }) };
      if (u.includes("/discover/movie")) {
        return { ok: true, status: 200, json: async () => ({ results: [{ id: 501, title: "Clean New", release_date: "2019-01-01", genre_ids: [27], vote_average: 7 }, { id: 502, title: "Dog Dies New", release_date: "2018-01-01", genre_ids: [27], vote_average: 6 }] }) };
      }
      const m = u.match(/\/movie\/(\d+)\?/);
      if (m) {
        const keywords = m[1] === "502" ? [{ name: "animal cruelty" }] : [];
        return { ok: true, status: 200, json: async () => ({ title: "x", overview: "", genres: [{ id: 27 }], keywords: { keywords } }) };
      }
      return { ok: true, status: 200, json: async () => ({ results: [] }) };
    }));
    return calls;
  };

  it("needs a token, and says so", () => {
    setup();
    ask("folk horror");
    expect(screen.getByRole("button", { name: "Also look on TMDb" }).disabled).toBe(true);
    expect(screen.getByText(/Add your TMDb token in Settings/)).toBeTruthy();
  });

  it("finds films you don't own and drops the ones that break your exclusions", async () => {
    const calls = stub();
    setup({ apiKey: "tok" });
    ask("folk horror under 2 hours, no animal harm");
    fireEvent.click(screen.getByRole("button", { name: "Also look on TMDb" }));
    const tmdb = await screen.findByRole("region", { name: "From TMDb" }, WAIT);
    await waitFor(() => expect(within(tmdb).getByText("Clean New")).toBeTruthy(), WAIT);
    expect(within(tmdb).queryByText("Dog Dies New")).toBeNull();
    expect(calls.some((c) => c.includes("with_runtime.lte=120"))).toBe(true);
  });

  it("adds a TMDb film to your watchlist", async () => {
    stub();
    const onAdd = vi.fn();
    setup({ apiKey: "tok", onAdd });
    ask("folk horror");
    fireEvent.click(screen.getByRole("button", { name: "Also look on TMDb" }));
    await screen.findByText("Clean New", {}, WAIT);
    fireEvent.click(screen.getAllByRole("button", { name: "+ Watchlist" })[0]);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: 501, watchlist: true }));
  });

  it("is disabled when nothing was understood", () => {
    setup({ apiKey: "tok" });
    ask("xyzzy");
    expect(screen.getByRole("button", { name: "Also look on TMDb" }).disabled).toBe(true);
  });

  it("reports a TMDb failure instead of an empty page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
    setup({ apiKey: "bad" });
    ask("under 2 hours");
    fireEvent.click(screen.getByRole("button", { name: "Also look on TMDb" }));
    expect((await screen.findByRole("alert", {}, WAIT)).textContent).toMatch(/rejected your API token/);
  });
});
