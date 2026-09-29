import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChallengesView } from "./ChallengesView.jsx";
import { createChallenge } from "../../lib/challenges.js";

const noop = () => {};
const NOW = new Date(2025, 9, 15, 12, 0, 0); // Wed 15 Oct 2025, local
const watch = (y, m, d) => new Date(y, m - 1, d, 0, 0, 0).toISOString();
const film = (id, extra = {}) => ({ id, title: `Film ${id}`, year: 2010, tags: [], keywords: [], watchedDates: [], rating: 0, scares: 5, watchlist: false, ...extra });
const render = (el) => renderToString(el);

describe("ChallengesView", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  const store = (challenges) => ({ challenges, start: noop, remove: noop, merge: noop });
  const view = (challenges, library = []) =>
    render(<ChallengesView library={library} store={store(challenges)} apiKey="tok" onUpdate={noop} onAdd={noop} onOpenDetails={noop} />);

  it("suggests seasonal challenges and lists everything you can start", () => {
    const html = view([]);
    expect(html).toContain("In season");
    expect(html).toContain("31 Nights of Halloween");
    expect(html).toContain("Start a challenge");
    expect(html).toContain("Found-Footage Week");
    expect(html).toContain("Nothing in progress");
  });

  it("shows progress for a count challenge derived from watch dates", () => {
    const ff = createChallenge("found-footage-week", { now: new Date(2025, 9, 13, 12) }); // Oct 13-19, 3 films
    const lib = [
      film(1, { tags: ["found-footage"], watchedDates: [watch(2025, 10, 13)] }),
      film(2, { tags: ["found-footage"], watchedDates: [watch(2025, 10, 14)] }),
      film(3, { tags: ["slasher"], watchedDates: [watch(2025, 10, 14)] }),
    ];
    const html = view([ff], lib);
    expect(html).toContain("Found-Footage Week");
    expect(html).toMatch(/>\s*2\s*<\/span>\s*\/\s*(<!-- -->)?\s*3/); // "2 / 3"
    expect(html).toContain('aria-valuenow="67"');
    expect(html).toContain("Build my watch list");
    expect(html).toContain("Find ideas on TMDb");
    expect(html).toContain("Film 1");
    expect(html).not.toContain("Film 3"); // wrong kind of film isn't listed as progress
  });

  it("shows the streak and day tracker for a daily challenge, and drops it from the start list", () => {
    const days = createChallenge("thirty-days", { now: new Date(2025, 9, 13, 12) });
    const lib = [film(1, { watchedDates: [watch(2025, 10, 13), watch(2025, 10, 14), watch(2025, 10, 15)] })];
    const html = view([days], lib);
    expect(html).toContain("30 Days of Horror");
    expect(html).toMatch(/Streak\s*(<!-- -->)?\s*3\s*(<!-- -->)?\s*day(<!-- -->)?s/); // SSR splits text nodes with comment markers
    expect(html).toContain("Days in this challenge");
    expect(html).toMatch(/Watch streak\s*(<!-- -->)?3/);
    // the running challenge isn't offered again under "Start a challenge"
    const startSection = html.slice(html.indexOf("Start a challenge"));
    expect(startSection).not.toContain("30 Days of Horror");
    expect(startSection).toContain("Found-Footage Week");
  });

  it("files completed and expired challenges under Finished", () => {
    const done = { ...createChallenge("found-footage-week", { now: new Date(2025, 8, 1, 12) }), target: 1 }; // Sep 1-7
    const lib = [film(1, { tags: ["found-footage"], watchedDates: [watch(2025, 9, 2)] })];
    const expired = createChallenge("cult-classics", { now: new Date(2025, 7, 1, 12) }); // Aug 1-30, nothing watched
    const html = view([done, expired], lib);
    expect(html).toContain("Finished");
    expect(html).toContain("Completed");
    expect(html).toContain("Ended");
  });

  it("does not offer the seasonal banner for a challenge that's already running", () => {
    const halloween = createChallenge("halloween-31", { now: NOW });
    const html = view([halloween]);
    expect(html).not.toContain("In season");
    expect(html).toContain("31 Nights of Halloween");
  });
});
