import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FORM_ANSWERS, TOKEN_API_URL, TOKEN_SIGNUP_URL, checkToken, cleanToken, diagnoseToken } from "./tokenCheck.js";
import { clearTmdbCache } from "./tmdb.js";

// shaped like a real v4 token: three dot-separated parts, starting eyJ
const REAL = `eyJhbGciOiJIUzI1NiJ9.${"a".repeat(180)}.${"b".repeat(43)}`;

describe("cleanToken", () => {
  it("removes spaces, quotes, a copied 'Bearer ' and line breaks", () => {
    expect(cleanToken(`  ${REAL}  `)).toBe(REAL);
    expect(cleanToken(`"${REAL}"`)).toBe(REAL);
    expect(cleanToken(`'${REAL}'`)).toBe(REAL);
    expect(cleanToken(`Bearer ${REAL}`)).toBe(REAL);
    expect(cleanToken(`bearer   ${REAL}`)).toBe(REAL);
    expect(cleanToken(`Bearer "${REAL}"`)).toBe(REAL);
    expect(cleanToken(`"Authorization: Bearer ${REAL}"`)).toBe(REAL);
    expect(cleanToken(`${REAL.slice(0, 60)}\n${REAL.slice(60)}`)).toBe(REAL);
  });
  it("copes with nothing", () => {
    expect(cleanToken("")).toBe("");
    expect(cleanToken(null)).toBe("");
    expect(cleanToken(undefined)).toBe("");
  });
});

describe("diagnoseToken", () => {
  it("says nothing about an empty box or a token that looks right", () => {
    expect(diagnoseToken("")).toBeNull();
    expect(diagnoseToken(REAL)).toBeNull();
  });
  it("catches the short API Key, the most common mistake, and says where the right one is", () => {
    const d = diagnoseToken("0123456789abcdef0123456789abcdef");
    expect(d.kind).toBe("short-key");
    expect(d.message).toMatch(/API Read Access Token/);
    expect(d.message).toMatch(/just below/);
  });
  it("catches a token that was only partly copied", () => {
    expect(diagnoseToken("eyJhbGci").kind).toBe("too-short");
    expect(diagnoseToken("x".repeat(30)).kind).toBe("too-short");
  });
  it("catches something that isn't a token at all", () => {
    expect(diagnoseToken("this-is-not-a-token-this-is-not-a-token-at-all").kind).toBe("not-token");
  });
});

describe("checkToken", () => {
  beforeEach(() => clearTmdbCache());
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status, body = {}) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body })));

  it("says the token works when TMDb accepts it, using the lightweight authentication call", async () => {
    reply(200, { success: true });
    const r = await checkToken(REAL);
    expect(r.state).toBe("ok");
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe("https://api.themoviedb.org/3/authentication");
    expect(init.headers.Authorization).toBe(`Bearer ${REAL}`);
  });
  it("explains a rejected token", async () => {
    reply(401, { success: false });
    const r = await checkToken(REAL);
    expect(r.state).toBe("bad");
    expect(r.message).toMatch(/rejected/);
    expect(r.message).toMatch(/API Read Access Token/);
  });
  it("treats an explicit success:false as a bad token", async () => {
    reply(200, { success: false });
    expect((await checkToken(REAL)).state).toBe("bad");
  });
  it("says it couldn't test, rather than blaming the token, when offline", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const r = await checkToken(REAL);
    expect(r.state).toBe("offline");
    expect(r.message).toMatch(/wasn't tested/);
  });
  it("reports other TMDb errors in plain words", async () => {
    reply(500);
    const r = await checkToken(REAL);
    expect(r.state).toBe("error");
    expect(r.message).toMatch(/error/i);
  });
  it("passes a cancel through, so a stale check can be dropped", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("aborted", "AbortError"); }));
    await expect(checkToken(REAL)).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("the guide's links and form answers", () => {
  it("point at TMDb's sign-up and API pages", () => {
    expect(TOKEN_SIGNUP_URL).toBe("https://www.themoviedb.org/signup");
    expect(TOKEN_API_URL).toBe("https://www.themoviedb.org/settings/api");
  });
  it("describe honest, personal, non-commercial use", () => {
    expect(FORM_ANSWERS.summary).toMatch(/personal, non-commercial/);
    expect(FORM_ANSWERS.url).toMatch(/^https:\/\//);
    expect(FORM_ANSWERS.name.length).toBeGreaterThan(3);
  });
});
