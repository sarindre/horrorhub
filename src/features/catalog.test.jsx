import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LibraryView } from "./library/LibraryView.jsx";
import { WatchlistView } from "./watchlist/WatchlistView.jsx";
import { Settings } from "./settings/Settings.jsx";
import { MovieDetails } from "./details/MovieDetails.jsx";
import { MovieCard } from "../components/MovieCard.jsx";
import { TagEditor } from "../components/TagEditor.jsx";
import { ContentPrefsContext, DEFAULT_CONTENT_PREFS } from "../lib/contentContext.js";
import { DEFAULT_SETTINGS } from "../lib/settings.js";

const noop = () => {};
const film = (id, extra = {}) => ({
  id, title: `Film ${id}`, year: 2010, rating: 0, scares: 5, tags: [], autoTags: [], contentFlags: [], watchedDates: [], watchlist: false,
  addedAt: "2024-10-01T00:00:00.000Z", ...extra,
});
const withPrefs = (prefs, el) => <ContentPrefsContext.Provider value={{ ...DEFAULT_CONTENT_PREFS, ...prefs }}>{el}</ContentPrefsContext.Provider>;
const render = (el) => renderToString(el);

describe("content warnings on cards", () => {
  const flagged = film(1, { title: "Dog Film", contentFlags: ["animal-harm", "gore"] });

  it("shows the warning chips, highlighting avoided ones and spelling out why it trips your limits", () => {
    const html = render(withPrefs({ avoidFlags: ["animal-harm"] }, <MovieCard item={flagged} onUpdate={noop} compact isInLibrary />));
    expect(html).toContain("Animal harm");
    expect(html).toContain("Graphic gore");
    expect(html).toContain("Contains animal harm");
    expect(html).toContain("border-red-500"); // avoided flag is red
  });

  it("can hide the chips (showWarnings off) but still calls out flags you avoid", () => {
    const html = render(withPrefs({ showWarnings: false, avoidFlags: ["animal-harm"] }, <MovieCard item={flagged} onUpdate={noop} compact isInLibrary />));
    expect(html).toContain("Animal harm");
    expect(html).not.toContain("Graphic gore");
  });

  it("uses a caller-supplied list for TMDb results and stays quiet when there's nothing to warn about", () => {
    expect(render(<MovieCard item={film(2, { poster: "/p.jpg" })} onUpdate={noop} compact warnings={["torture"]} />)).toContain("Torture");
    expect(render(<MovieCard item={film(3)} onUpdate={noop} compact />)).not.toContain("⚠");
  });

  it("flags a film over your scare limit, only for films you own", () => {
    const scary = film(4, { scares: 9 });
    expect(render(withPrefs({ maxScares: 6 }, <MovieCard item={scary} onUpdate={noop} compact isInLibrary />))).toContain("Scare level 9 is above your limit of 6");
    expect(render(withPrefs({ maxScares: 6 }, <MovieCard item={scary} onUpdate={noop} compact />))).not.toContain("above your limit");
  });
});

describe("library filtering", () => {
  const items = [
    film(1, { title: "Tagged One", tags: ["slasher", "classic"], autoTags: ["classic"] }),
    film(2, { title: "Tagged Two", tags: ["slasher"] }),
    film(3, { title: "Plain" }),
    film(4, { title: "Gory", tags: ["gore"], contentFlags: ["gore"] }),
  ];

  it("shows tag counts and an Untagged filter", () => {
    const html = render(<LibraryView items={items} onUpdate={noop} onRemove={noop} onOpenDetails={noop} />);
    expect(html).toMatch(/#(<!-- -->)?slasher[\s\S]*?(<!-- -->)?2/); // SSR splits text nodes with comment markers
    expect(html).toMatch(/Untagged\s*\(\s*(<!-- -->)?1/);
  });

  it("hides films over your limits in hide mode, with a notice to show them", () => {
    const html = render(withPrefs({ avoidFlags: ["gore"], contentMode: "hide" }, <LibraryView items={items} onUpdate={noop} onRemove={noop} onOpenDetails={noop} />));
    expect(html).not.toContain("Gory");
    expect(html).toContain("hidden by your content limits");
    expect(html).toContain("Tagged One");
  });

  it("keeps them visible (with warnings) in warn mode", () => {
    const html = render(withPrefs({ avoidFlags: ["gore"], contentMode: "warn" }, <LibraryView items={items} onUpdate={noop} onRemove={noop} onOpenDetails={noop} />));
    expect(html).toContain("Gory");
    expect(html).not.toContain("hidden by your content limits");
  });
});

describe("watch plan shows warnings before you commit", () => {
  const week = [0, 1, 2, 3, 4, 5, 6];
  const list = [film(1, { title: "Cozy", watchlist: true }), film(2, { title: "Rough One", watchlist: true, contentFlags: ["torture"] })];

  it("lists the upcoming schedule with each film's warnings and a heads-up when limits are tripped", () => {
    const html = render(withPrefs({ avoidFlags: ["torture"] }, <WatchlistView items={list} onUpdate={noop} onRemove={noop} onOpenDetails={noop} planDays={week} planTime="20:00" />));
    expect(html).toContain("Weekly Watch Plan");
    expect(html).toContain("Cozy");
    expect(html).toContain("Rough One");
    expect(html).toContain("Torture");
    expect(html).toMatch(/1\s*(<!-- -->)?\s*planned film/);
  });

  it("leaves flagged films out of the plan in hide mode", () => {
    const html = render(withPrefs({ avoidFlags: ["torture"], contentMode: "hide" }, <WatchlistView items={list} onUpdate={noop} onRemove={noop} onOpenDetails={noop} planDays={week} />));
    expect(html).toContain("hidden by your content limits");
    expect(html).not.toContain("Rough One");
  });

  it("asks for preferred days when none are set", () => {
    expect(render(<WatchlistView items={list} onUpdate={noop} onRemove={noop} onOpenDetails={noop} planDays={[]} />)).toContain("preferred watch days");
  });
});

describe("tags and details", () => {
  it("marks inferred tags with a sparkle and offers only tags you don't have", () => {
    const html = render(<TagEditor tags={["slasher", "mine"]} autoTags={["slasher"]} onChange={noop} />);
    expect(html).toContain("✦ ");
    expect(html).toMatch(/✦\s*(<!-- -->)?#(<!-- -->)?slasher/);
    // "slasher" is already applied so it isn't offered again as a suggestion
    expect(html.match(/#(<!-- -->)?slasher/g)).toHaveLength(1);
  });

  it("MovieDetails offers editable warnings and a refresh for films you own", () => {
    const own = film(1, { title: "Owned", contentFlags: ["gore"] });
    const html = render(<MovieDetails item={own} localItem={own} onUpdate={noop} onAdd={noop} apiKey="tok" />);
    expect(html).toContain("Content warnings");
    expect(html).toContain("Refresh from TMDb");
    expect(html).toContain('aria-pressed="true"'); // the gore flag is on
  });

  it("MovieDetails warns when a film trips your limits", () => {
    const own = film(1, { title: "Owned", contentFlags: ["gore"] });
    const html = render(withPrefs({ avoidFlags: ["gore"] }, <MovieDetails item={own} localItem={own} onUpdate={noop} onAdd={noop} />));
    expect(html).toContain("Heads up");
    expect(html).toContain("Contains graphic gore");
  });

  it("Settings has the catalog and content controls", () => {
    const html = render(<Settings settings={DEFAULT_SETTINGS} update={noop} onImport={noop} onRetagAll={noop} onCleanupTags={noop} watchlist={[]} data={[]} />);
    expect(html).toContain("Catalog &amp; Content");
    expect(html).toContain("Re-tag my whole library");
    expect(html).toContain("Animal harm");
    expect(html).toContain("Hide them");
  });
});
