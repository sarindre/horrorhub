import { describe, expect, it } from "vitest";
import { applyQuery, describeFilters, hasFilters, parseQuery } from "./query.js";

const NOW = new Date(2026, 5, 15);
const parse = (q) => parseQuery(q, { now: NOW });
const f = (q) => parse(q).filters;
const labels = (q) => parse(q).understood.map((c) => c.label);

describe("the headline example", () => {
  it("understands subgenres, a length and an exclusion in one sentence", () => {
    const r = parse("Slow-burn folk horror under 100 minutes, no animal harm");
    expect(r.filters).toMatchObject({ tags: ["slow-burn", "folk-horror"], runtimeMax: 100, excludeFlags: ["animal-harm"] });
    expect(r.ignored).toEqual([]);
    expect(r.understood.map((c) => c.label)).toEqual(["#slow-burn", "#folk-horror", "no animal harm", "under 100 min"]);
  });
});

describe("subgenres and moods", () => {
  it("reads common wordings", () => {
    expect(f("ghost stories").tags).toEqual(["haunted"]);
    expect(f("zombies and vampires").tags.sort()).toEqual(["vampire", "zombie"]);
    expect(f("found footage").tags).toEqual(["found-footage"]);
    expect(f("sci-fi horror").tags).toEqual(["sci-horror"]);
    expect(f("body horror").tags).toEqual(["body-horror"]);
    expect(f("cosmic horror").tags).toEqual(["cosmic"]);
    expect(f("a cult classic").tags).toEqual(["classic"]);
    expect(f("folk").tags).toEqual(["folk-horror"]);
  });
  it("takes a mood by its name", () => {
    expect(f("something atmospheric").moods).toEqual(["atmospheric"]);
  });
  it("ignores case, punctuation and hyphens", () => {
    expect(f("FOLK-HORROR!!! & Slow_Burn?").tags.sort()).toEqual(["folk-horror", "slow-burn"]);
  });
  it("prefers the longest phrase", () => {
    expect(f("creature feature").tags).toEqual(["creature"]);
    expect(f("folk horror").tags).toEqual(["folk-horror"]); // not folk-horror twice
  });
});

describe("runtime", () => {
  it("understands minutes and hours, with or without a unit", () => {
    expect(f("under 100 minutes").runtimeMax).toBe(100);
    expect(f("under 2 hours").runtimeMax).toBe(120);
    expect(f("less than 1.5 hours").runtimeMax).toBe(90);
    expect(f("under 2").runtimeMax).toBe(120); // a small number means hours
    expect(f("under 95").runtimeMax).toBe(95);
    expect(f("90 minutes or less").runtimeMax).toBe(90);
    expect(f("at most 80 min").runtimeMax).toBe(80);
  });
  it("understands a minimum", () => {
    expect(f("over 2 hours").runtimeMin).toBe(120);
    expect(f("longer than 100 minutes").runtimeMin).toBe(100);
    expect(f("2 hours or more").runtimeMin).toBe(120);
  });
  it("understands short and long", () => {
    expect(f("a short one").runtimeMax).toBe(90);
    expect(f("something long").runtimeMin).toBe(130);
  });
});

describe("years", () => {
  it("reads decades in several spellings", () => {
    for (const q of ["from the 80s", "the 1980s", "eighties horror", "80s slashers"]) expect(f(q)).toMatchObject({ yearMin: 1980, yearMax: 1989 });
    expect(f("'90s")).toMatchObject({ yearMin: 1990, yearMax: 1999 });
    expect(f("the 00s")).toMatchObject({ yearMin: 2000, yearMax: 2009 });
    expect(f("the 2010s")).toMatchObject({ yearMin: 2010, yearMax: 2019 });
  });
  it("reads before, after and since", () => {
    expect(f("before 1990").yearMax).toBe(1989);
    expect(f("after 2010").yearMin).toBe(2011);
    expect(f("since 2015").yearMin).toBe(2015);
  });
  it("reads one year, and refuses the future", () => {
    expect(f("from 1982")).toMatchObject({ yearMin: 1982, yearMax: 1982 });
    expect(f("2031").yearMin).toBeUndefined();
  });
  it("reads recent and old", () => {
    expect(f("something recent").yearMin).toBe(2021);
    expect(f("an old one").yearMax).toBe(1989);
  });
  it("doesn't mistake runtime numbers for years", () => {
    expect(f("under 100 minutes")).toMatchObject({ runtimeMax: 100 });
    expect(f("under 100 minutes").yearMin).toBeUndefined();
  });
});

describe("how scary", () => {
  it("reads gentle and intense", () => {
    expect(f("something gentle").scareMax).toBe(4);
    expect(f("a cozy one").scareMax).toBe(4);
    expect(f("not too scary").scareMax).toBe(5);
    expect(f("really terrifying").scareMin).toBe(7);
    expect(f("scary").scareMin).toBe(6);
  });
  it("reads a number", () => {
    expect(f("scare level under 6").scareMax).toBe(6);
    expect(f("scare over 7").scareMin).toBe(7);
  });
});

describe("exclusions", () => {
  it("reads the different ways of saying no", () => {
    expect(f("no gore").excludeFlags).toEqual(["gore"]);
    expect(f("without animal cruelty").excludeFlags).toEqual(["animal-harm"]);
    expect(f("avoid torture").excludeFlags).toEqual(["torture"]);
    expect(f("nothing too gory").excludeFlags).toEqual(["gore"]);
    expect(f("not too bloody").excludeFlags).toEqual(["gore"]);
    expect(f("gore free").excludeFlags).toEqual(["gore"]);
    expect(f("no dogs dying").excludeFlags).toEqual(["animal-harm"]);
  });
  it("reads a list", () => {
    expect(f("no gore, animal harm or jump scares").excludeFlags.sort()).toEqual(["animal-harm", "gore", "jump-scares"]);
    expect(f("without gore and torture").excludeFlags.sort()).toEqual(["gore", "torture"]);
  });
  it("rules out subgenres too", () => {
    expect(f("no slashers")).toMatchObject({ excludeTags: ["slasher"], tags: [] });
  });
  it("doesn't also ask for what it ruled out", () => {
    const r = f("slow burn but no gore");
    expect(r.tags).toEqual(["slow-burn"]);
    expect(r.excludeFlags).toEqual(["gore"]);
  });
  it("leaves 'not too scary' and 'haven't seen' to the other rules", () => {
    expect(f("not too scary").excludeFlags).toEqual([]);
    expect(f("haven't seen").excludeFlags).toEqual([]);
  });
});

describe("status, rating and topics", () => {
  it("reads watched state", () => {
    expect(f("ones I haven't seen").watched).toBe(false);
    expect(f("something new to me").watched).toBe(false);
    expect(f("unwatched").watched).toBe(false);
    expect(f("something I already watched").watched).toBe(true);
    expect(f("from my watchlist").watchlist).toBe(true);
  });
  it("'something new' is about watching, not release dates", () => {
    expect(f("something new").yearMin).toBeUndefined();
  });
  it("reads ratings", () => {
    expect(f("top rated").ratingMin).toBe(4);
    expect(f("rated 4+").ratingMin).toBe(4);
    expect(f("4.5 stars or more").ratingMin).toBe(4.5);
    expect(f("unrated").ratingMax).toBe(0);
  });
  it("takes a topic after 'about'", () => {
    expect(f("movies about nuns").terms).toEqual(["nuns"]);
    expect(f("about a haunted lighthouse, under 2 hours")).toMatchObject({ terms: [], tags: ["haunted"], runtimeMax: 120 }); // "haunted" is a subgenre
    expect(f("featuring clowns and no gore")).toMatchObject({ terms: ["clowns"], excludeFlags: ["gore"] });
  });
  it("'about vampires' is the vampire subgenre, not a search for the word", () => {
    expect(f("about vampires")).toMatchObject({ tags: ["vampire"], terms: [] });
  });
});

describe("what it didn't understand", () => {
  it("lists leftover words and ignores filler", () => {
    expect(parse("show me a good slasher banana flibbertigibbet").ignored).toEqual(["banana", "flibbertigibbet"]);
    expect(parse("I want to watch something tonight").ignored).toEqual([]);
  });
  it("copes with empty and nonsense input", () => {
    expect(hasFilters(f(""))).toBe(false);
    expect(hasFilters(f("   "))).toBe(false);
    expect(hasFilters(f("???"))).toBe(false);
    expect(parse(undefined).understood).toEqual([]);
  });
});

describe("describeFilters", () => {
  it("says it back in plain words", () => {
    expect(labels("scary slashers from the 80s under 2 hours, no animal harm, haven't seen")).toEqual([
      "#slasher", "no animal harm", "under 2 h", "1980s", "scare 6 or more", "not watched yet",
    ]);
    expect(labels("after 2010")).toEqual(["2011 or later"]);
    expect(labels("before 1990")).toEqual(["1989 or earlier"]);
    expect(labels("from 1982")).toEqual(["1982"]);
    expect(describeFilters(f("rated 4+ on my watchlist")).map((c) => c.label)).toEqual(["on your watchlist", "rated 4★ or more"]);
  });
});

// ---- applying the filters ----

let id = 1;
const film = (over = {}) => ({ id: id++, title: `Film ${id}`, year: 2010, tags: [], contentFlags: [], runtime: 100, scares: 5, scaresRated: true, rating: 0, watchedDates: [], watchlist: false, overview: "", keywords: [], ...over });
const run = (q, items, opts) => applyQuery(items, parse(q).filters, { now: NOW, ...opts });
const titles = (r) => r.results.map((x) => x.item.title);

describe("applyQuery", () => {
  const lib = [
    film({ title: "Folk Slow", tags: ["folk-horror", "slow-burn"], runtime: 95, scares: 4 }),
    film({ title: "Folk Long", tags: ["folk-horror"], runtime: 140 }),
    film({ title: "Slow Only", tags: ["slow-burn"], runtime: 90 }),
    film({ title: "Slasher", tags: ["slasher"], runtime: 88 }),
    film({ title: "Animal", tags: ["folk-horror"], runtime: 90, contentFlags: ["animal-harm"] }),
  ];

  it("answers the headline example: matching, short, and without the excluded content", () => {
    const r = run("slow-burn folk horror under 100 minutes, no animal harm", lib);
    expect(titles(r)).toEqual(["Folk Slow", "Slow Only"]); // both asked-for tags first, then one
    expect(r.results[0].reasons[0]).toBe("Matches #slow-burn and #folk-horror (2 of 2)");
    expect(r.results[1].reasons[0]).toContain("(1 of 2)");
    expect(r.leftOut).toEqual({ "has animal harm": 1 });
  });

  it("filters by runtime, but keeps a film whose runtime isn't known, with a note", () => {
    const r = run("under 100 minutes", [film({ title: "Known", runtime: 90 }), film({ title: "Long", runtime: 130 }), film({ title: "Unknown", runtime: undefined })]);
    expect(titles(r).sort()).toEqual(["Known", "Unknown"]);
    expect(r.results.find((x) => x.item.title === "Unknown").notes).toEqual(["runtime unknown"]);
  });

  it("filters by decade and needs a known year", () => {
    const r = run("from the 80s", [film({ title: "Eighties", year: 1984 }), film({ title: "Nineties", year: 1991 }), film({ title: "No year", year: undefined })]);
    expect(titles(r)).toEqual(["Eighties"]);
  });

  it("filters by scare level, using estimates when you haven't scored a film", () => {
    const r = run("gentle", [film({ title: "Mild", scares: 2 }), film({ title: "Heavy", scares: 9 }), film({ title: "Guess", scaresRated: false, scares: 5, tags: ["gore", "disturbing"] })]);
    expect(titles(r)).toEqual(["Mild"]);
    expect(r.results[0].reasons).toContain("Scare 2/10");
  });

  it("filters by watched state, watchlist and rating", () => {
    const items = [film({ title: "Seen", watchedDates: ["2025-01-01T12:00:00.000Z"], rating: 5 }), film({ title: "Unseen", watchlist: true }), film({ title: "Neither" })];
    expect(titles(run("haven't seen", items)).sort()).toEqual(["Neither", "Unseen"]);
    expect(titles(run("already watched", items))).toEqual(["Seen"]);
    expect(titles(run("from my watchlist", items))).toEqual(["Unseen"]);
    expect(titles(run("top rated", items))).toEqual(["Seen"]);
  });

  it("rules out subgenres", () => {
    const r = run("no slashers", lib);
    expect(titles(r)).not.toContain("Slasher");
    expect(r.leftOut).toEqual({ "is #slasher": 1 });
  });

  it("finds films by topic in the title, overview or keywords", () => {
    const items = [film({ title: "Sister Act of Terror", overview: "A nun hears things." }), film({ title: "Other", keywords: ["nuns"] }), film({ title: "Nope", overview: "A farm." })];
    expect(titles(run("about nun", items)).sort()).toEqual(["Other", "Sister Act of Terror"]);
  });

  it("matches a mood by its tags", () => {
    const r = run("atmospheric", [film({ title: "Moody", tags: ["haunted"] }), film({ title: "Other", tags: ["slasher"] })]);
    expect(titles(r)).toEqual(["Moody"]);
  });

  it("never offers a film that isn't out yet", () => {
    expect(titles(run("slashers", [film({ title: "Future", year: 2031, tags: ["slasher"] })]))).toEqual([]);
  });

  it("with nothing recognised, lists the whole library", () => {
    expect(run("hmm", lib).results).toHaveLength(lib.length);
  });

  it("ranks ties alphabetically and tolerates an empty library", () => {
    expect(titles(run("slasher", [film({ title: "B", tags: ["slasher"] }), film({ title: "A", tags: ["slasher"] })]))).toEqual(["A", "B"]);
    expect(run("anything", []).results).toEqual([]);
  });
});

describe("words that are both a content flag and a subgenre", () => {
  it("asking for them means the subgenre", () => {
    expect(f("gory slashers").tags.sort()).toEqual(["gore", "slasher"]);
    expect(f("body horror").tags).toEqual(["body-horror"]);
    expect(f("something disturbing").tags).toEqual(["disturbing"]);
  });
  it("ruling them out removes both, since a film may carry either", () => {
    expect(f("no body horror")).toMatchObject({ excludeFlags: ["body-horror"], excludeTags: ["body-horror"] });
    const items = [film({ title: "Flag only", contentFlags: ["body-horror"] }), film({ title: "Tag only", tags: ["body-horror"] }), film({ title: "Clean" })];
    expect(titles(run("no body horror", items))).toEqual(["Clean"]);
  });
  it("a plain flag stays a flag", () => {
    expect(f("no animal harm")).toMatchObject({ excludeFlags: ["animal-harm"], excludeTags: [] });
  });
});

describe("numbers go to the right place", () => {
  it("a scare number isn't a runtime, and a runtime isn't a scare", () => {
    const r = f("scare level under 6, under 100 minutes");
    expect(r).toMatchObject({ scareMax: 6, runtimeMax: 100 });
  });
});
