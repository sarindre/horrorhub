// Desktop audit: builds the app, launches the real Electron desktop app, and checks it from the
// outside (through the browser debugging port): it loads, is isolated from Node, keeps your data
// between runs, refuses to leave the app, and can reach TMDb from its own address.
//
//   npm run audit:desktop                     check the app run from source (electron .)
//   npm run audit:desktop -- --packed=release/win-unpacked/HorrorHub.exe    check a packaged build
//
// Uses a throwaway data folder, so it never touches your real HorrorHub data.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { build } from "vite";
import puppeteer from "puppeteer-core";
import electronPath from "electron";

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const PORT = 9333;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : `: ${detail}`}`);
  if (!ok) failures++;
};

if (!args.packed) {
  console.log("Building...");
  await build({ logLevel: "error" });
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "horrorhub-desktop-"));
const launch = () => {
  const cmd = args.packed ? path.resolve(args.packed) : electronPath;
  const argv = [...(args.packed ? [] : ["."]), `--remote-debugging-port=${PORT}`, `--user-data-dir=${dataDir}`];
  // some editors set ELECTRON_RUN_AS_NODE, which would make Electron start as plain Node
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;
  return spawn(cmd, argv, { stdio: "ignore", env });
};

async function connect(proc) {
  for (let i = 0; i < 60; i++) {
    try {
      const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null });
      const pages = await browser.pages();
      const page = pages.find((p) => p.url().startsWith("app://horrorhub/"));
      if (page) return { browser, page };
      browser.disconnect();
    } catch {
      /* not up yet */
    }
    if (proc.exitCode !== null) throw new Error("the app exited before it could be checked");
    await sleep(500);
  }
  throw new Error("couldn't connect to the desktop app");
}

const stop = async (proc) => {
  if (proc.exitCode === null) {
    proc.kill();
    await new Promise((r) => proc.once("exit", r));
  }
  await sleep(500);
};

try {
  console.log("First run:");
  let proc = launch();
  let { browser, page } = await connect(proc);
  await page.waitForFunction(() => document.body.textContent.includes("Your personal horror library"), { timeout: 20000 });

  const info = await page.evaluate(async () => ({
    title: document.title,
    origin: location.origin,
    secure: isSecureContext,
    desktop: window.horrorhubDesktop?.isDesktop === true,
    platform: window.horrorhubDesktop?.platform,
    hasRequire: typeof require !== "undefined",
    hasProcess: typeof process !== "undefined",
    workers: (await navigator.serviceWorker?.getRegistrations?.().catch(() => []))?.length ?? 0,
    folderPicker: typeof showDirectoryPicker,
    onboardingVisible: document.body.textContent.includes("Welcome to HorrorHub"),
  }));
  check(info.title === "HorrorHub", "window title is HorrorHub", info.title);
  check(info.origin === "app://horrorhub", "served from its own app:// address", info.origin);
  check(info.secure, "is a secure context");
  check(info.desktop, "knows it is the desktop app");
  check(!info.hasRequire && !info.hasProcess, "page has no access to Node (require/process)");
  check(info.workers === 0, "no service worker (not needed on desktop)", String(info.workers));
  check(info.folderPicker === "function", "folder picker for automatic backup is available");

  // the page renders real app content, not an error page
  const shots = args.shots;
  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: path.join(shots, "desktop-window.png") });
  }

  // data survives a restart
  await page.evaluate(() => {
    localStorage.setItem("horrorhub.library.v3", JSON.stringify({ version: 3, items: [{ id: 1, title: "Persisted Film", year: 2000, addedAt: new Date().toISOString() }] }));
    localStorage.setItem("horrorhub.prefs.v1", JSON.stringify({ version: 1, values: { "onboarding.dismissed": true, "help.autoOpen": false } }));
  });

  // leaving the app is blocked
  const before = (await browser.pages()).length;
  await page.evaluate(() => window.open("https://example.com/", "_blank"));
  await sleep(600);
  check((await browser.pages()).length === before, "an external link does not open a new window inside the app");
  await page.evaluate(() => { location.href = "https://example.com/"; });
  await sleep(1000);
  check(page.url().startsWith("app://horrorhub/"), "navigating to another site is blocked", page.url());
  await page.evaluate(() => { location.href = "file:///C:/Windows/win.ini"; });
  await sleep(800);
  check(page.url().startsWith("app://horrorhub/"), "navigating to a local file is blocked", page.url());

  // TMDb must be reachable from the app's own origin (CORS)
  const tmdb = await page.evaluate(async () => {
    try {
      const r = await fetch("https://api.themoviedb.org/3/authentication", { headers: { Authorization: "Bearer not-a-real-token" } });
      return { status: r.status };
    } catch (e) {
      return { error: String(e) };
    }
  });
  check(tmdb.status === 401, "can reach TMDb from the desktop app (a fake token is refused, not blocked)", JSON.stringify(tmdb));

  // a path that tries to escape the app's folder gets nothing
  const escaped = await page.evaluate(async () => (await fetch("app://horrorhub/..%2f..%2fpackage.json")).status);
  check(escaped === 404, "a path outside the app folder is refused", String(escaped));

  await sleep(1500);
  await browser.close().catch(() => {}); // close the app the way a user would, so storage is written out
  await stop(proc);

  console.log("Second run (same data folder):");
  proc = launch();
  ({ browser, page } = await connect(proc));
  await page.waitForFunction(() => document.body.textContent.includes("Your personal horror library"), { timeout: 20000 });
  await sleep(800);
  const again = await page.evaluate(() => ({
    kept: JSON.parse(localStorage.getItem("horrorhub.library.v3") || "{}").items?.[0]?.title,
    text: document.body.textContent.includes("Persisted Film") || document.body.textContent.includes("Tonight"),
  }));
  check(again.kept === "Persisted Film", "your data is still there after restarting", String(again.kept));
  browser.disconnect();
  await stop(proc);
} catch (err) {
  failures++;
  console.log(`  FAIL ${err.message}`);
} finally {
  fs.rmSync(dataDir, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nThe desktop app works.");
process.exit(failures ? 1 : 0);
