import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyManualEdit,
  canonicalTag,
  cleanupLegacyKeywordTags,
  editTags,
  inferTags,
  legacyKeywordTags,
  mergeInferred,
  SUGGESTED_TAGS,
} from "./tagging.js";
import { CONTENT_FLAGS, evaluateContent, evaluateItem, hasContentLimits, inferFlags, itemFlags } from "./contentFlags.js";
import { analysisPatch, analyzeLocal, analyzeMeta, fetchFilmMeta } from "./filmMeta.js";
import { mergeLibraries, normalizeItem } from "./library.js";
import { clearTmdbCache } from "./tmdb.js";

describe("canonicalTag", () => {
  it("gives every spelling one form", () => {
    for (const raw of ["Folk Horror", "#folk_horror", " folk-horror ", "FOLK  HORROR", "folkhorror"]) expect(canonicalTag(raw)).toBe("folk-horror");
    expect(canonicalTag("Ghosts")).toBe("haunted");
    expect(canonicalTag("")).toBe("");
    expect(canonicalTag(null)).toBe("");
  });

  it("keeps the curated vocabulary stable", () => {
    for (const tag of SUGGESTED_TAGS) expect(canonicalTag(tag)).toBe(tag);
  });
});

describe("inferTags", () => {
  it("maps TMDb keywords to curated tags, strongest first", () => {
    const tags = inferTags({ keywords: ["slasher", "masked killer", "summer camp", "final girl"], year: 1980 });
    expect(tags[0]).toBe("slasher");
    expect(tags).toContain("classic"); // pre-1986
  });

  it("recognizes stems (possess -> possession) and multi-word phrases", () => {
    expect(inferTags({ keywords: ["demonic possession", "exorcism"] })).toContain("possession");
    expect(inferTags({ keywords: ["found footage"] })).toEqual(["found-footage"]);
    expect(inferTags({ keywords: ["cosmic horror", "eldritch"] })).toContain("cosmic");
  });

  it("uses the overview only for specific phrases and genres for sci-fi/comedy", () => {
    expect(inferTags({ overview: "A camcorder captures what happened in the house." })).toContain("found-footage");
    expect(inferTags({ overview: "A family drives to the lake for the weekend." })).toEqual([]);
    expect(inferTags({ genreIds: [27, 878] })).toContain("sci-horror");
    expect(inferTags({ genreIds: [27, 35] })).toContain("campy");
  });

  it("does not match inside unrelated words", () => {
    expect(inferTags({ keywords: ["cultural exchange"] })).not.toContain("occult");
  });

  it("stays inside the curated vocabulary and caps the count", () => {
    const tags = inferTags({
      keywords: ["slasher", "haunted house", "demon", "cult", "zombie", "vampire", "monster", "gore", "survival", "paranoia"],
      year: 1975,
    });
    expect(tags.length).toBeLessThanOrEqual(6);
    for (const t of tags) expect(SUGGESTED_TAGS).toContain(t);
  });

  it("returns nothing when there's no evidence", () => {
    expect(inferTags({})).toEqual([]);
    expect(inferTags({ keywords: ["based on novel", "female protagonist"], year: 2018 })).toEqual([]);
  });
});

describe("provenance: your edits win", () => {
  it("adds inferred tags and remembers which were inferred", () => {
    const r = mergeInferred({ list: ["favorite"], auto: [], removed: [] }, ["slasher", "classic"]);
    expect(r.list).toEqual(["favorite", "slasher", "classic"]);
    expect(r.auto).toEqual(["slasher", "classic"]);
  });

  it("never re-adds a tag you removed", () => {
    const item = { tags: ["slasher", "gore"], autoTags: ["slasher", "gore"], removedTags: [] };
    const edited = editTags(item, ["gore"]); // you delete #slasher
    expect(edited.removedTags).toEqual(["slasher"]);
    const again = mergeInferred({ list: edited.tags, auto: edited.autoTags, removed: edited.removedTags }, ["slasher", "campy"]);
    expect(again.list).toEqual(["gore", "campy"]);
  });

  it("forgets a removal when you add the tag back yourself", () => {
    const r = applyManualEdit({ list: ["gore"], auto: ["gore"], removed: ["slasher"] }, ["gore", "slasher"]);
    expect(r.removed).toEqual([]);
    expect(r.list).toContain("slasher");
  });

  it("removing a tag you typed yourself isn't remembered (nothing would re-add it)", () => {
    expect(applyManualEdit({ list: ["mine"], auto: [], removed: [] }, []).removed).toEqual([]);
  });

  it("keeps a manually typed tag when inference later agrees", () => {
    const r = mergeInferred({ list: ["slasher"], auto: [], removed: [] }, ["slasher"]);
    expect(r.auto).toEqual([]); // still yours, not marked inferred
  });

  it("editTags canonicalizes what you type", () => {
    expect(editTags({ tags: [] }, ["Folk Horror", "#GORE"]).tags).toEqual(["folk-horror", "gore"]);
  });
});

describe("legacy keyword cleanup", () => {
  const item = { id: 1, tags: ["slasher", "based-on-novel", "female-protagonist", "favorite"], autoTags: ["slasher"], keywords: ["based on novel", "female protagonist", "slasher"] };

  it("finds tags that are just old copied TMDb keywords", () => {
    expect(legacyKeywordTags(item)).toEqual(["based-on-novel", "female-protagonist"]);
  });

  it("leaves your own tags and curated ones alone, and skips films with no stored keywords", () => {
    expect(legacyKeywordTags({ tags: ["based-on-novel"], keywords: [] })).toEqual([]);
    const { items, films, tags } = cleanupLegacyKeywordTags([item]);
    expect(items[0].tags).toEqual(["slasher", "favorite"]);
    expect([films, tags]).toEqual([1, 2]);
  });
});

describe("content flags", () => {
  it("infers categories from keywords and unambiguous overview phrases", () => {
    expect(inferFlags({ keywords: ["animal cruelty", "torture"] })).toEqual(["torture", "animal-harm"]);
    expect(inferFlags({ keywords: ["rape and revenge"] })).toContain("sexual-violence");
    expect(inferFlags({ overview: "A survivor of torture returns home." })).toContain("torture");
    expect(inferFlags({ keywords: ["dog", "forest"] })).toEqual([]);
  });

  it("only offers documented flag ids", () => {
    const ids = CONTENT_FLAGS.map((f) => f.id);
    for (const f of inferFlags({ keywords: ["gore", "suicide", "child abuse", "massacre"] })) expect(ids).toContain(f);
  });

  it("adds DoesTheDogDie-derived flags to a library film's own", () => {
    expect(itemFlags({ contentFlags: ["gore"], goreCount: 5, disturbCount: 4, jumpScares: 12 })).toEqual(["gore", "disturbing", "jump-scares"]);
    expect(itemFlags({ goreCount: 1 })).toEqual([]);
  });

  it("blocks on avoided flags and on scare level, and says why", () => {
    const prefs = { avoidFlags: ["animal-harm", "gore"], maxScares: 6 };
    expect(evaluateContent({ flags: ["animal-harm", "torture"], scares: 4 }, prefs)).toEqual({ blocked: true, reasons: ["Contains animal harm"] });
    expect(evaluateContent({ flags: [], scares: 8 }, prefs).reasons).toEqual(["Scare level 8 is above your limit of 6"]);
    expect(evaluateContent({ flags: ["torture"], scares: 6 }, prefs).blocked).toBe(false);
    expect(evaluateContent({ flags: ["gore"] }, prefs).blocked).toBe(true); // unknown scares never block on their own
    expect(evaluateItem({ contentFlags: ["gore"], scares: 3 }, prefs).blocked).toBe(true);
  });

  it("detects whether any limit is active", () => {
    expect(hasContentLimits({})).toBe(false);
    expect(hasContentLimits({ avoidFlags: [], maxScares: 10 })).toBe(false);
    expect(hasContentLimits({ avoidFlags: ["gore"], maxScares: 10 })).toBe(true);
    expect(hasContentLimits({ avoidFlags: [], maxScares: 7 })).toBe(true);
  });
});

describe("filmMeta", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearTmdbCache();
  });

  it("fetches details and keywords in one request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        title: "The Thing",
        overview: "A team is hunted by a shape-shifting alien.",
        runtime: 109,
        release_date: "1982-06-25",
        genres: [{ id: 27 }, { id: 878 }],
        keywords: { keywords: [{ name: "Antarctica" }, { name: "Body Horror" }, { name: "Paranoia" }] },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const meta = await fetchFilmMeta(1091, { apiKey: "k" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("append_to_response=keywords");
    expect(meta).toMatchObject({ runtime: 109, year: 1982, genreIds: [27, 878], keywords: ["antarctica", "body horror", "paranoia"] });
    const a = analyzeMeta(meta);
    expect(a.tags).toEqual(expect.arrayContaining(["body-horror", "psychological", "sci-horror", "classic"]));
  });

  it("builds a patch that respects removed tags and keeps yours", () => {
    const item = { id: 1, tags: ["mine"], autoTags: [], removedTags: ["classic"], contentFlags: [], keywords: [] };
    const patch = analysisPatch(item, { tags: ["classic", "gore"], flags: ["gore"], keywords: ["splatter"], runtime: 95 }, "2025-10-15T00:00:00.000Z");
    expect(patch.tags).toEqual(["mine", "gore"]);
    expect(patch.autoTags).toEqual(["gore"]);
    expect(patch.removedTags).toEqual(["classic"]);
    expect(patch.contentFlags).toEqual(["gore"]);
    expect(patch).toMatchObject({ keywords: ["splatter"], runtime: 95, taggedAt: "2025-10-15T00:00:00.000Z" });
  });

  it("infers what it can from local data alone", () => {
    expect(analyzeLocal({ overview: "A camcorder captures the house.", year: 1978 }).tags).toEqual(expect.arrayContaining(["found-footage", "classic"]));
  });
});

describe("library schema keeps provenance", () => {
  it("normalizes the new fields and drops inconsistent provenance", () => {
    const item = normalizeItem({
      id: 1,
      title: "X",
      tags: ["Folk Horror", "gore"],
      autoTags: ["gore", "ghost-not-in-tags"],
      removedTags: ["gore", "slasher"],
      keywords: [" Based On Novel ", "based on novel"],
      contentFlags: ["Animal-Harm"],
      runtime: 101.4,
      taggedAt: "nope",
    });
    expect(item.tags).toEqual(["folk-horror", "gore"]);
    expect(item.autoTags).toEqual(["gore"]);
    expect(item.removedTags).toEqual(["slasher"]);
    expect(item.keywords).toEqual(["based on novel"]);
    expect(item.contentFlags).toEqual(["animal-harm"]);
    expect(item.runtime).toBe(101);
    expect(item.taggedAt).toBeUndefined();
  });

  it("combines provenance and keywords when merging an import", () => {
    const existing = [{ id: 1, title: "A", year: 2000, tags: ["gore"], autoTags: ["gore"], removedTags: ["slasher"], keywords: ["k1"] }];
    const { items } = mergeLibraries(existing, [{ id: 1, title: "A", year: 2000, tags: ["campy"], removedTags: ["classic"], keywords: ["k2"] }]);
    expect(items[0].tags).toEqual(["gore", "campy"]);
    expect(items[0].removedTags).toEqual(["slasher", "classic"]);
    expect(items[0].keywords).toEqual(["k1", "k2"]);
  });
});
