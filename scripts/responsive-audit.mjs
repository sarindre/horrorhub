// Responsive audit: opens every screen in a real Chromium browser (Edge or Chrome) at several
// widths and fails if anything makes the page wider than the screen, the classic phone bug.
//
//   npm run audit:responsive                       start a dev server, check 320/360/390/768/1280
//   npm run audit:responsive -- --widths=320,414   choose widths
//   npm run audit:responsive -- --url=http://localhost:5173/   use a server that's already running
//   npm run audit:responsive -- --shots=./shots    also save a screenshot per screen and width
//
// Set CHROME_PATH if your browser isn't found. It seeds a small fake library, so it needs no
// TMDb token and never touches your real data (it uses a fresh browser profile).

import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import puppeteer from "puppeteer-core";

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const widths = String(args.widths || "320,360,390,768,1280").split(",").map(Number).filter(Boolean);
const VIEWS = ["tonight", "group", "discover", "rate", "library", "shelves", "recs", "continuity", "watchlist", "challenges", "stats", "settings"];

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

// a believable little library, watchlist, shelf and challenge so every screen has content to lay out
const now = new Date();
const day = (n) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - n);
const films = [
  { id: 1, title: "Resident Evil", year: 2026, rating: 0, scares: 5, tags: ["body-horror", "survival"], contentFlags: ["body-horror"], overview: "Medical courier Bryan unwittingly finds himself fighting for survival as one fateful night unfolds." },
  { id: 2, title: "Colony", year: 2026, rating: 4, scares: 6, tags: ["sci-horror"], watchlist: true, overview: "Professor Se-jeong is thrust into a bloody nightmare when a rapidly mutating virus spreads." },
  { id: 3, title: "Resident Evil: Welcome to Raccoon City", year: 2021, rating: 3.5, scares: 5, watchlist: true, tags: ["zombie"], overview: "Once the booming home of pharmaceutical giant Umbrella, Raccoon City is now a dying Midwestern town." },
  { id: 4, title: "Hereditary", year: 2018, rating: 5, scares: 9, tags: ["occult", "psychological", "slow-burn"], watchedDates: [day(1), day(2), day(3)].map((d) => d.toISOString()), overview: "A grieving family is haunted by tragic and disturbing occurrences." },
  { id: 5, title: "The Thing", year: 1982, rating: 5, scares: 8, tags: ["creature", "sci-horror", "classic"], watchedDates: [day(400).toISOString()], overview: "A research team in Antarctica is hunted by a shape-shifting alien." },
  { id: 6, title: "Halloween", year: 1978, rating: 4.5, scares: 7, tags: ["slasher", "classic"], watchedDates: [day(500).toISOString()], overview: "Fifteen years after murdering his sister, Michael Myers escapes and returns to his hometown." },
  { id: 7, title: "A Film With A Deliberately Very Long Title To Test How Cards Cope With Text", year: 2020, rating: 0, scares: 6, tags: ["occult"], watchlist: true, overview: "More of the same." },
];
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const seed = {
  "horrorhub.library.v3": JSON.stringify({ version: 3, items: films.map((f) => ({ addedAt: day(30).toISOString(), ...f })) }),
  "horrorhub.settings.v2": JSON.stringify({ version: 2, settings: { flicker: false, fog: false, theme: "dark", planDays: [5, 6] } }),
  "horrorhub.prefs.v1": JSON.stringify({ version: 1, values: { "onboarding.dismissed": true } }),
  "horrorhub.shelves.v1": JSON.stringify({ version: 1, items: [{ id: "s1", name: "Comfort horror for rainy nights", description: "Cozy scares", films: [{ id: 1, title: "Resident Evil", year: 2026 }, { id: 4, title: "Hereditary", year: 2018 }], createdAt: now.toISOString(), updatedAt: now.toISOString() }] }),
  "horrorhub.challenges.v1": JSON.stringify({ version: 1, items: [{ id: "thirty-days-x", templateId: "thirty-days", title: "30 Days of Horror", kind: "daily", target: 30, startDate: dayKey(day(2)), endDate: dayKey(day(-27)), match: [], createdAt: now.toISOString() }] }),
};

// Runs in the page: how far past the screen edge does the page reach, and which innermost elements do it?
function measure() {
  const vw = document.documentElement.clientWidth;
  const clipped = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true; // scrolls or clips on its own
    }
    return false;
  };
  const out = [...document.querySelectorAll("body *")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.right > vw + 1 && !clipped(el) && !el.closest(".fixed");
  });
  const set = new Set(out);
  const leaves = out.filter((el) => ![...el.querySelectorAll("*")].some((c) => set.has(c)));
  return {
    overflow: document.documentElement.scrollWidth - vw,
    culprits: leaves
      .map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.textContent || "").trim().slice(0, 28), cls: String(el.className || "").slice(0, 60), right: Math.round(el.getBoundingClientRect().right) }))
      .sort((a, b) => b.right - a.right)
      .slice(0, 3),
  };
}

const browserPath = findBrowser();
if (!browserPath) {
  console.error("No Chrome/Edge found. Install one, or set CHROME_PATH to its executable.");
  process.exit(2);
}

let server;
let url = args.url;
if (!url) {
  server = await createServer({ logLevel: "error", server: { port: 5199, strictPort: false } });
  await server.listen();
  url = server.resolvedUrls.local[0];
}
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });

const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", args: ["--no-sandbox"] });
let failures = 0;
try {
  for (const width of widths) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 844, isMobile: width < 700, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument((data) => {
      if (!sessionStorage.getItem("seeded")) {
        for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
        sessionStorage.setItem("seeded", "1");
      }
    }, seed);
    const bad = [];
    for (const view of VIEWS) {
      await page.goto(`${url}#${view}`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 700)); // lazy screens and fonts
      const result = await page.evaluate(measure);
      if (args.shots) await page.screenshot({ path: path.join(args.shots, `${view}-${width}.png`), fullPage: view === "settings" });
      if (result.overflow > 0) bad.push({ view, ...result });
    }
    // states that need a click to reach: the taste quiz on the Tonight screen
    await page.goto(`${url}#tonight`, { waitUntil: "networkidle2" });
    const opened = await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Take the taste quiz");
      button?.click();
      return !!button;
    });
    await new Promise((r) => setTimeout(r, 300));
    const quiz = await page.evaluate(measure);
    if (args.shots) await page.screenshot({ path: path.join(args.shots, `tonight-quiz-${width}.png`) });
    if (!opened) bad.push({ view: "tonight-quiz (button not found)", overflow: 1, culprits: [] });
    else if (quiz.overflow > 0) bad.push({ view: "tonight-quiz", ...quiz });
    // ...and a challenge's daily plan, expanded
    await page.goto(`${url}#challenges`, { waitUntil: "networkidle2" });
    const planned = await page.evaluate(() => {
      const click = (label) => {
        const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
        button?.click();
        return !!button;
      };
      click("Build my watch list");
      return click("Plan my days");
    });
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^Show all \d+ nights$/.test(b.textContent.trim()))?.click());
    await new Promise((r) => setTimeout(r, 300));
    const planView = await page.evaluate(measure);
    if (args.shots) await page.screenshot({ path: path.join(args.shots, `challenges-plan-${width}.png`), fullPage: true });
    if (!planned) bad.push({ view: "challenges-plan (button not found)", overflow: 1, culprits: [] });
    else if (planView.overflow > 0) bad.push({ view: "challenges-plan", ...planView });
    await page.close();
    if (!bad.length) console.log(`  ${String(width).padStart(4)} px  ok (${VIEWS.length + 2} screens)`);
    for (const b of bad) {
      failures++;
      console.log(`  ${String(width).padStart(4)} px  FAIL ${b.view}: ${b.overflow}px wider than the screen`);
      for (const c of b.culprits) console.log(`            <${c.tag}> reaches ${c.right}px  "${c.text}"  .${c.cls}`);
    }
  }
} finally {
  await browser.close();
  await server?.close();
}
console.log(failures ? `\n${failures} screen(s) overflow horizontally.` : "\nNo horizontal overflow on any screen.");
process.exit(failures ? 1 : 0);
