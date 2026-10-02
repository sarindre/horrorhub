// Draws the app icons from the PumpBoy artwork (design/pumpboy-original.png) with a real browser:
// public/icons/*.png (web app and phone), build/icon.png (desktop installers) and
// src/assets/pumpboy.png (the mascot shown in the app). Run it only when the artwork changes:
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

// The artwork is signed in its bottom-left corner; the icons use the picture above the signature.
// The flat red background is extended to fill the square, so nothing needs cutting out.
const SOURCE = path.resolve("design", "pumpboy-original.png");
const SIGNATURE_TOP = 538; // the signature starts on row 538; the drawing ends on row 537
const CROP_HEIGHT = 546; // a little below the drawing; the signature rows are painted over first

// file, pixel size, how much of the square the picture fills (maskable icons keep it inside the safe zone)
const ICONS = [
  ["public/icons/icon-192.png", 192, 0.92],
  ["public/icons/icon-512.png", 512, 0.92],
  ["public/icons/icon-maskable-512.png", 512, 0.74],
  ["public/icons/apple-touch-icon.png", 180, 0.92],
  ["public/icons/favicon-48.png", 48, 0.92],
  ["build/icon.png", 512, 0.92],
  ["src/assets/pumpboy.png", 256, 0.92],
];

const dataUrl = "data:image/png;base64," + fs.readFileSync(SOURCE).toString("base64");

// Runs in the page: paints the cropped artwork centred on its own background colour.
const draw = async ({ url, size, fill, cropHeight, signatureTop }) => {
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
  // a copy of the artwork with the signature painted out
  const clean = document.createElement("canvas");
  clean.width = img.width;
  clean.height = img.height;
  const cctx = clean.getContext("2d");
  cctx.drawImage(img, 0, 0);
  cctx.fillStyle = background;
  cctx.fillRect(0, signatureTop, img.width, img.height - signatureTop);
  ctx.imageSmoothingQuality = "high";
  const scale = (size * fill) / cropHeight;
  const w = img.width * scale;
  const h = cropHeight * scale;
  ctx.drawImage(clean, 0, 0, img.width, cropHeight, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/png");
};

const browser = await puppeteer.launch({ executablePath: browserPath, headless: "new", args: ["--no-sandbox"] });
try {
  const tab = await browser.newPage();
  await tab.setContent("<!doctype html><meta charset=\"utf-8\">");
  for (const [file, size, fill] of ICONS) {
    const url = await tab.evaluate(draw, { url: dataUrl, size, fill, cropHeight: CROP_HEIGHT, signatureTop: SIGNATURE_TOP });
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(path.resolve(file), Buffer.from(url.split(",")[1], "base64"));
    console.log("wrote", file);
  }
} finally {
  await browser.close();
}
