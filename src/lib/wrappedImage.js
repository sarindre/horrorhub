import { plural } from "./text.js";

// The shareable card for Horror Wrapped: a 1080x1350 image drawn on a canvas.
// layoutWrapped() decides what goes where (pure and tested); drawWrapped() and
// wrappedBlob() put it on a canvas in the browser.

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
const RED = "#ef4444";
const TEXT = "#f4f4f5";
const MUTED = "#a1a1aa";

const clip = (text, max) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

// A list of text items with positions. `font` is "spooky" (the header face) or "sans".
export function layoutWrapped(w) {
  const ops = [];
  const text = (t, x, y, size, o = {}) => ops.push({ text: t, x, y, size, color: TEXT, font: "sans", weight: 600, align: "left", ...o });
  const cx = CARD_WIDTH / 2;

  text("HORRORHUB", cx, 96, 30, { align: "center", color: MUTED, weight: 700 });
  text(`My ${w.year} in horror`, cx, 220, 110, { align: "center", font: "spooky", color: RED, weight: 400 });
  text(w.personality.title, cx, 300, 52, { align: "center", weight: 700 });

  // the two big numbers
  text(String(w.films), 300, 520, 180, { align: "center", weight: 800 });
  text(w.films === 1 ? "film" : "films", 300, 580, 44, { align: "center", color: MUTED });
  text(String(w.hours), 780, 520, 180, { align: "center", weight: 800 });
  text(w.estimatedHours ? "hours (est.)" : "hours", 780, 580, 44, { align: "center", color: MUTED });

  const rows = [];
  if (w.topTags.length) rows.push(["Most watched", w.topTags.map((t) => `#${t.tag}`).join("  ")]);
  rows.push(["Scariest", `${clip(w.scariest.title, 28)} · ${w.scariest.scare}/10${w.scariest.estimated ? " (est.)" : ""}`]);
  if (w.topRated.length) rows.push(["Top rated", w.topRated.map((f) => clip(f.title, 22)).join(", ")]);
  rows.push(["Busiest month", `${w.busiestMonth.name} · ${plural(w.busiestMonth.count, "watch")}`]);
  rows.push(["Favorite night", `${w.favoriteDay.name}s`]);
  if (w.longestStreak >= 2) rows.push(["Longest streak", plural(w.longestStreak, "day")]);
  if (w.bigNight) rows.push(["Biggest night", `${plural(w.bigNight.count, "film")} in one sitting`]);

  let y = 700;
  for (const [label, value] of rows.slice(0, 7)) {
    text(label.toUpperCase(), 90, y, 26, { color: MUTED, weight: 700 });
    text(value, 90, y + 46, 40, { maxWidth: CARD_WIDTH - 180 });
    y += 100;
  }

  text("Made with HorrorHub · everything stays on my device", cx, CARD_HEIGHT - 60, 26, { align: "center", color: MUTED, weight: 500 });
  return { width: CARD_WIDTH, height: CARD_HEIGHT, ops };
}

const FONTS = { spooky: '"Creepster", system-ui, sans-serif', sans: 'system-ui, "Segoe UI", Helvetica, Arial, sans-serif' };

export function drawWrapped(ctx, layout) {
  const bg = ctx.createRadialGradient(layout.width / 2, layout.height * 0.2, 50, layout.width / 2, layout.height * 0.5, layout.height);
  bg.addColorStop(0, "#4a0b0b");
  bg.addColorStop(0.55, "#170505");
  bg.addColorStop(1, "#070707");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  ctx.textBaseline = "alphabetic";
  for (const op of layout.ops) {
    let size = op.size;
    const font = (s) => `${op.weight} ${s}px ${FONTS[op.font]}`;
    ctx.font = font(size);
    // shrink anything that would run off its space
    const limit = op.maxWidth || layout.width - 120;
    while (ctx.measureText(op.text).width > limit && size > 14) {
      size -= 2;
      ctx.font = font(size);
    }
    ctx.fillStyle = op.color;
    ctx.textAlign = op.align;
    ctx.fillText(op.text, op.x, op.y);
  }
}

// The card as a PNG.
export async function wrappedBlob(w) {
  const layout = layoutWrapped(w);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  try {
    await document.fonts?.load?.('64px "Creepster"');
  } catch {
    /* falls back to the system font */
  }
  drawWrapped(canvas.getContext("2d"), layout);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't draw the image."))), "image/png"));
}

