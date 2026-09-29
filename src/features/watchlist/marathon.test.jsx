import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WatchlistView } from "./WatchlistView.jsx";
import { ContentPrefsContext, DEFAULT_CONTENT_PREFS } from "../../lib/contentContext.js";

const noop = () => {};
const film = (id, extra = {}) => ({
  id, title: `Film ${id}`, year: 2010, scares: 5, runtime: 100, rating: 0, tags: [], keywords: [], contentFlags: [], watchedDates: [], watchlist: true,
  addedAt: "2024-10-01T00:00:00.000Z", ...extra,
});
const list = [film(1, { title: "Gentle One", scares: 3, runtime: 90 }), film(2, { title: "Middle One", scares: 6 }), film(3, { title: "Brutal One", scares: 9, runtime: 110 })];
const emptyStore = { marathons: [], save: noop, remove: noop, merge: noop };
const render = (items, store = emptyStore, prefs = {}) =>
  renderToString(
    <ContentPrefsContext.Provider value={{ ...DEFAULT_CONTENT_PREFS, ...prefs }}>
      <WatchlistView items={items} library={items} marathonStore={store} onUpdate={noop} onRemove={noop} onOpenDetails={noop} planDays={[5, 6]} planTime="20:00" />
    </ContentPrefsContext.Provider>
  );

describe("Marathon planner", () => {
  it("builds a timed lineup from the watchlist with pacing, runtime and a flow summary", () => {
    const html = render(list);
    expect(html).toContain("Marathon planner");
    for (const title of ["Gentle One", "Middle One", "Brutal One"]) expect(html).toContain(title);
    expect(html).toContain("Total: ");
    expect(html).toMatch(/Builds from|Peaks at|Opens with/); // the flow summary
    expect(html).toContain("Save plan");
    expect(html).toContain("Download .ics");
    expect(html).toContain("Shuffle");
    // ramp is the default: within the planner, the gentle film comes before the brutal one
    const planner = html.slice(html.indexOf("Marathon planner"), html.indexOf("Weekly Watch Plan"));
    expect(planner.indexOf("Gentle One")).toBeGreaterThan(-1);
    expect(planner.indexOf("Gentle One")).toBeLessThan(planner.indexOf("Brutal One"));
  });

  it("leaves films over your content limits out of the lineup", () => {
    const html = render([...list, film(4, { title: "Torture Fest", contentFlags: ["torture"] })], emptyStore, { avoidFlags: ["torture"] });
    const planner = html.slice(html.indexOf("Marathon planner"), html.indexOf("Weekly Watch Plan"));
    expect(planner).not.toContain("Torture Fest");
    expect(planner).toContain("Gentle One");
  });

  it("explains an empty result instead of showing nothing", () => {
    const html = render([film(1, { contentFlags: ["gore"] }), film(2, { contentFlags: ["gore"] })], emptyStore, { avoidFlags: ["gore"] });
    expect(html).toContain("Nothing fits that theme and your content limits");
  });

  it("lists saved plans with download and delete", () => {
    const store = {
      ...emptyStore,
      marathons: [{ id: "m1", name: "Friday Night Frights", startAt: new Date(2025, 9, 17, 20, 0).toISOString(), shape: "peak", themeLabel: "Occult", films: [{ id: 1, title: "Alpha", runtime: 90 }, { id: 2, title: "Beta" }] }],
    };
    const html = render(list, store);
    expect(html).toContain("Saved plans");
    expect(html).toContain("Friday Night Frights");
    expect(html).toContain("Alpha → Beta");
    expect(html).toContain("Delete");
  });

  it("guides you when there's nothing to plan from", () => {
    expect(render([])).toContain("Add films to your watchlist");
  });

  it("still renders the watchlist without a planner store (older callers)", () => {
    const html = renderToString(<WatchlistView items={list} onUpdate={noop} onRemove={noop} onOpenDetails={noop} planDays={[5]} />);
    expect(html).not.toContain("Marathon planner");
    expect(html).toContain("Gentle One");
  });
});
