import { describeError, isAbort, tmdbGet } from "./tmdb.js";

// Helping someone get a working TMDb token: tidy what they paste, spot the common
// mistakes before any network request, and test the token against TMDb so they know it
// works. Pure apart from checkToken, which makes one small request.

export const TOKEN_SIGNUP_URL = "https://www.themoviedb.org/signup";
export const TOKEN_API_URL = "https://www.themoviedb.org/settings/api";
export const PROJECT_URL = "https://github.com/sarindre/horrorhub";

// Text to paste into TMDb's application form, which asks what the key is for.
export const FORM_ANSWERS = {
  name: "HorrorHub (personal use)",
  url: PROJECT_URL,
  summary: "A personal, non-commercial horror movie tracker that runs on my own device. I use the API to look up film details, posters and keywords for my own library. My token stays on my device and is only sent to TMDb.",
};

// What people paste is often a little off: surrounding spaces or quotes, a copied
// "Bearer " prefix, or a line break in the middle of the long token.
export function cleanToken(raw) {
  let text = String(raw ?? "").trim();
  // peel off wrappers in any order: quotes, an "Authorization:" header name, a "Bearer " prefix
  for (let i = 0; i < 6; i++) {
    const before = text;
    text = text.replace(/^["'`]+|["'`]+$/g, "").replace(/^authorization\s*:\s*/i, "").replace(/^bearer\s+/i, "").trim();
    if (text === before) break;
  }
  return text.replace(/\s+/g, "");
}

// A problem visible from the text alone, or null. TMDb gives two credentials: a short
// 32-character "API Key" (not what we need) and a long "API Read Access Token".
export function diagnoseToken(token) {
  if (!token) return null;
  if (/^[a-f0-9]{32}$/i.test(token)) {
    return { kind: "short-key", message: "That looks like the short \"API Key\". HorrorHub needs the long \"API Read Access Token\" that sits just below it on the same TMDb page." };
  }
  if (token.length < 40) return { kind: "too-short", message: "That's shorter than a TMDb token. The \"API Read Access Token\" is a very long string of letters and numbers (over 200 characters), so make sure you copied all of it." };
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return { kind: "not-token", message: "That doesn't look like a TMDb token. The \"API Read Access Token\" starts with \"eyJ\" and has two dots in it." };
  return null;
}

// Asks TMDb whether the token works. Returns { state, message } where state is
// "ok" | "bad" (TMDb refused it) | "offline" | "error".
export async function checkToken(token, { signal } = {}) {
  try {
    const data = await tmdbGet("/authentication", { apiKey: token, signal });
    if (data?.success === false) return { state: "bad", message: "TMDb didn't accept that token. Copy it again from your TMDb API settings." };
    return { state: "ok", message: "Connected to TMDb. Your token works." };
  } catch (err) {
    if (isAbort(err)) throw err;
    if (err?.kind === "auth") return { state: "bad", message: "TMDb rejected that token. Make sure you copied the long \"API Read Access Token\", all of it, and that your TMDb API key request was approved." };
    if (err?.kind === "network") return { state: "offline", message: "Couldn't reach TMDb, so the token wasn't tested. Check your connection and try again." };
    return { state: "error", message: describeError(err) };
  }
}
