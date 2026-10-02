// Offline audit: builds the app, serves it, lets the browser install it, then SHUTS THE
// SERVER DOWN and checks the app still opens and works, including a screen that was never
// visited online. Also asks the browser whether the app is installable.
//
//   npm run audit:offline
//   BASE_PATH=/horrorhub/ npm run audit:offline     the same, served under a sub-path like GitHub Pages
//
// Needs Edge or Chrome (set CHROME_PATH if it isn't found). Uses a fresh browser profile.

import fs from "node:fs";
import { build, preview } from "vite";
import puppeteer from "puppeteer-core";

const candidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const browserPath = candidates.find((p) => fs.existsSync(p));
if (!browserPath) {
  console.error("No Chrome or Edge found. Set CHROME_PATH.");
  process.exit(1);
}

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : `: ${detail}`}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("Building...");
await build({ logLevel: "error" });
let server = await preview({ preview: { port: 4179, strictPort: true, host: "127.0.0.1" } });
// BASE_PATH (e.g. /horrorhub/) checks the app the way GitHub Pages serves it, under a sub-path
const base = process.env.BASE_PATH || "/";
const url = `http://127.0.0.1:4179${base}`;

const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // a little library so there is something to see offline
  await page.evaluateOnNewDocument(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("horrorhub.library.v3", JSON.stringify({ version: 3, items: [{ id: 1, title: "Offline Film", year: 2001, rating: 4, scares: 6, tags: ["slasher"], watchlist: true, addedAt: new Date().toISOString() }] }));
      localStorage.setItem("horrorhub.prefs.v1", JSON.stringify({ version: 1, values: { "onboarding.dismissed": true, "backup.snoozedUntil": "2999-01-01T00:00:00.000Z" } }));
      sessionStorage.setItem("seeded", "1");
    }
  });

  console.log("Online:");
  await page.goto(`${url}#tonight`, { waitUntil: "networkidle2" });
  const registered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  check(registered, "service worker installed and active");
  await sleep(1500);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const shell = names.find((n) => n.startsWith("horrorhub-shell-"));
    const keys = shell ? (await (await caches.open(shell)).keys()).map((r) => new URL(r.url).pathname) : [];
    return { shell, keys };
  });
  check(!!cached.shell, "app files stored", cached.shell ? "" : "no shell cache");
  check(cached.keys.some((k) => /StatsView-.*\.js$/.test(k)), "screens that load on demand are stored too (Stats)");
  check(cached.keys.some((k) => k.endsWith("/manifest.webmanifest")) && cached.keys.some((k) => k.includes("icon-512")), "manifest and icons stored");

  const client = await page.createCDPSession();
  const { installabilityErrors } = await client.send("Page.getInstallabilityErrors");
  check(installabilityErrors.length === 0, "browser says the app is installable", JSON.stringify(installabilityErrors));

  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  check(manifest.display === "standalone" && manifest.icons.some((i) => i.purpose === "maskable"), "manifest has standalone display and a maskable icon");

  check(await page.evaluate(() => document.body.textContent.includes("Offline Film")), "app shows the library while online");

  console.log("Offline (server stopped):");
  await page.close();
  await server.close();
  server = null;

  const offline = await browser.newPage();
  offline.on("pageerror", (e) => errors.push(e.message));
  const failedRequests = [];
  offline.on("requestfailed", (r) => failedRequests.push(r.url()));
  await offline.goto(`${url}#tonight`, { waitUntil: "load" });
  await sleep(1200);
  check(await offline.evaluate(() => document.body.textContent.includes("Offline Film")), "opens and shows the library with no server");
  check(await offline.evaluate(() => document.title === "HorrorHub"), "page loaded from the stored copy");

  await offline.goto(`${url}#stats`, { waitUntil: "load" });
  await sleep(1500);
  check(await offline.evaluate(() => /Stats|Overview|Badges/i.test(document.body.textContent) && !document.body.textContent.includes("Loading…")), "a screen never opened online (Stats) still loads");

  await offline.goto(`${url}#settings`, { waitUntil: "load" });
  await sleep(800);
  check(await offline.evaluate(() => document.body.textContent.includes("Automatic backup")), "Settings shows the backup section");

  check(!failedRequests.some((u) => u.includes("/assets/")), "no app file failed to load", failedRequests.filter((u) => u.includes("/assets/")).join(", "));
  check(errors.length === 0, "no page errors", errors.join(" | "));
} finally {
  await browser.close();
  await server?.close();
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nInstallable and works offline.");
process.exit(failures ? 1 : 0);
