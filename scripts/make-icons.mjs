// Draws the app icons (public/icons/*.png) with a real browser, so the emoji is
// rendered by the system font and baked into the PNGs. Run it only when the
// icon design changes:  node scripts/make-icons.mjs
// Set CHROME_PATH if Edge or Chrome isn't found.

import fs from "node:fs";
import path from "node:path";
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

// name, pixel size, how much of the square the emoji fills (maskable icons keep it inside the safe zone)
const ICONS = [
  ["icon-192.png", 192, 0.56],
  ["icon-512.png", 512, 0.56],
  ["icon-maskable-512.png", 512, 0.42],
  ["apple-touch-icon.png", 180, 0.5],
];

const page = (size, fill) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent}
  .icon{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(circle at 50% 38%, #5a0d0d 0%, #1c0606 55%, #090909 100%);
    font-size:${Math.round(size * fill)}px;line-height:1;font-family:"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif}
</style><div class="icon">🔪</div>`;

const out = path.resolve("public", "icons");
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", args: ["--no-sandbox"] });
try {
  for (const [name, size, fill] of ICONS) {
    const tab = await browser.newPage();
    await tab.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await tab.setContent(page(size, fill));
    await tab.screenshot({ path: path.join(out, name), clip: { x: 0, y: 0, width: size, height: size } });
    await tab.close();
    console.log("wrote", path.join("public", "icons", name));
  }
} finally {
  await browser.close();
}
