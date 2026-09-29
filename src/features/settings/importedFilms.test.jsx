import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImportedFilms } from "./ImportedFilms.jsx";
import { Settings } from "./Settings.jsx";
import { DEFAULT_SETTINGS } from "../../lib/settings.js";

const noop = () => {};
const film = (id, extra = {}) => ({ id, title: `Film ${id}`, year: 2000, tags: [], watchedDates: [], ...extra });
const render = (el) => renderToString(el);
const card = (library, props = {}) => render(<ImportedFilms library={library} apiKey="tok" autoMatch onRelink={noop} onRetryAll={noop} {...props} />);

describe("ImportedFilms", () => {
  it("renders nothing when there are no imported films", () => {
    expect(card([film(1), film(2)])).toBe("");
  });

  it("summarizes matched, waiting and unmatched films", () => {
    const html = card([
      film("letterboxd:A:2000"), // waiting
      film("letterboxd:B:2001", { tmdbMatchTriedAt: "2025-10-01T00:00:00.000Z" }), // needs manual match
      film(348, { tmdbMatchedAt: "2025-10-01T00:00:00.000Z" }), // matched
    ]);
    expect(html).toContain("Imported films");
    expect(html).toMatch(/1\s*(<!-- -->)?\s*matched/);
    expect(html).toMatch(/1\s*(<!-- -->)?\s*waiting/);
    expect(html).toMatch(/1\s*(<!-- -->)?\s*need a manual match/);
  });

  it("lists films that couldn't be matched with a way to find them by hand, and a retry", () => {
    const html = card([film("imdb:tt1", { title: "Obscure Film", tmdbMatchTriedAt: "2025-10-01T00:00:00.000Z" })]);
    expect(html).toContain("Couldn&#x27;t match automatically");
    expect(html).toContain("Obscure Film");
    expect(html).toContain("Find match");
    expect(html).toContain("Retry automatic matching");
  });

  it("explains why nothing is happening when there's no token or matching is off", () => {
    const waiting = [film("letterboxd:A:2000")];
    expect(card(waiting, { apiKey: "" })).toContain("Add your TMDb API token");
    expect(card(waiting, { autoMatch: false })).toContain("Automatic matching is turned off");
  });

  it("appears in Settings with its own toggle, and is absent for a library with no imports", () => {
    const withImports = render(<Settings settings={DEFAULT_SETTINGS} update={noop} onImport={noop} onRelink={noop} onRetryMatching={noop} watchlist={[]} data={[film("letterboxd:A:2000")]} />);
    expect(withImports).toContain("Imported films");
    expect(withImports).toContain("Match films imported from Letterboxd/IMDb to TMDb automatically");
    const without = render(<Settings settings={DEFAULT_SETTINGS} update={noop} onImport={noop} watchlist={[]} data={[film(1)]} />);
    expect(without).not.toContain("Imported films</div>");
  });
});
