// Draws the app icons from the PumpBoy artwork (design/pumpboy-original.png) with a real browser:
// public/icons/*.png (web app and phone), build/icon.png (desktop installers) and
// Run it only when the artwork changes:
//   node scripts/make-icons.mjs
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

// The whole drawing is used, signed by its artist (totalnightmare) in the bottom-left corner. The flat
// red background is extended to fill the square, so nothing needs cutting out.
const SOURCE = path.resolve("design", "pumpboy-original.png");

// file, pixel size, how much of the square the picture fills (maskable icons keep it inside the safe zone)
const ICONS = [
  ["public/icons/icon-192.png", 192, 0.94],
  ["public/icons/icon-512.png", 512, 0.94],
  ["public/icons/icon-maskable-512.png", 512, 0.66],
  ["public/icons/apple-touch-icon.png", 180, 0.94],
  ["public/icons/favicon-48.png", 48, 0.94],
  ["build/icon.png", 512, 0.94],
];

const dataUrl = "data:image/png;base64," + fs.readFileSync(SOURCE).toString("base64");

// Runs in the page: paints the artwork centred on its own background colour.
const draw = async ({ url, size, fill }) => {
  const img = new Image();
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const pctx = probe.getContext("2d");
  pctx.drawImage(img, 3, 3, 1, 1, 0, 0, 1, 1);
  const [r, g, b] = pctx.getImageData(0, 0, 1, 1).data;
  const background = `rgb(${r},${g},${b})`;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = "high";
  const scale = (size * fill) / img.height;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, 0, 0, img.width, img.height, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/png");
};

const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", args: ["--no-sandbox"] });
try {
  const tab = await browser.newPage();
  await tab.setContent("<!doctype html><meta charset=\"utf-8\">");
  for (const [file, size, fill] of ICONS) {
    const url = await tab.evaluate(draw, { url: dataUrl, size, fill });
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(path.resolve(file), Buffer.from(url.split(",")[1], "base64"));
    console.log("wrote", file);
  }
} finally {
  await browser.close();
}
