import { describe, expect, it } from "vitest";
import { FAQ, GLOSSARY, HELP, SHORTCUTS, searchHelp } from "./help.js";
import { NAV, VIEW_IDS } from "./nav.js";

describe("every screen has help", () => {
  it("covers each view in the navigation, and nothing else", () => {
    expect(Object.keys(HELP).sort()).toEqual([...VIEW_IDS].sort());
  });
  it("says what the screen is for and gives something to do", () => {
    for (const [id, h] of Object.entries(HELP)) {
      expect(h.title.trim(), id).not.toBe("");
      expect(h.what.trim().length, id).toBeGreaterThan(20);
      expect(h.points.length, id).toBeGreaterThan(0);
    }
  });
  it("uses the same names as the navigation, so help and the tabs agree", () => {
    const labels = Object.fromEntries(NAV.flatMap((g) => g.views.map((v) => [v.id, v.label])));
    for (const [id, h] of Object.entries(HELP)) expect(h.title, id).toBe(labels[id] === "Tonight's pick" ? "Tonight" : labels[id]);
  });
});

describe("the text itself", () => {
  const all = [
    ...Object.values(HELP).flatMap((h) => [h.title, h.what, ...h.points, ...h.tips]),
    ...GLOSSARY.flatMap((g) => [g.term, g.meaning]),
    ...FAQ.flatMap((f) => [f.q, f.a]),
    ...SHORTCUTS,
  ];
  it("has no blanks or leftovers", () => {
    for (const text of all) {
      expect(typeof text).toBe("string");
      expect(text.trim()).not.toBe("");
      expect(text).not.toMatch(/TODO|FIXME|lorem|undefined|\[object/i);
    }
  });
  it("has no double spaces or unbalanced quotes", () => {
    for (const text of all) {
      expect(text).not.toMatch(/ {2}/);
      expect((text.match(/"/g) || []).length % 2).toBe(0);
    }
  });
  it("lists each glossary word and question once", () => {
    expect(new Set(GLOSSARY.map((g) => g.term.toLowerCase())).size).toBe(GLOSSARY.length);
    expect(new Set(FAQ.map((f) => f.q)).size).toBe(FAQ.length);
  });
  it("is honest that warnings can miss things", () => {
    expect(GLOSSARY.find((g) => g.term === "Content warnings").meaning).toMatch(/not a guarantee/);
  });
});

describe("searchHelp", () => {
  it("returns everything for an empty search", () => {
    const r = searchHelp("");
    expect(r.screens).toHaveLength(Object.keys(HELP).length);
    expect(r.glossary).toHaveLength(GLOSSARY.length);
    expect(r.faq).toHaveLength(FAQ.length);
  });
  it("finds things in any part, ignoring case", () => {
    const r = searchHelp("DOESTHEDOGDIE");
    expect(r.screens).toContain("settings");
    expect(r.faq.some((f) => /uploaded/.test(f.q))).toBe(true);
  });
  it("finds a glossary word", () => {
    expect(searchHelp("streak").glossary.map((g) => g.term)).toContain("Streak");
  });
  it("returns nothing for nonsense", () => {
    expect(searchHelp("xyzzyplugh")).toEqual({ screens: [], glossary: [], faq: [] });
  });
  it("keeps the screens in the order asked for", () => {
    expect(searchHelp("", { views: ["stats", "tonight"] }).screens).toEqual(["stats", "tonight"]);
  });
});
