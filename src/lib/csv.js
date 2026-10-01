import { isoDateOnly, parseDay } from "./dates.js";

// One CSV cell: quoted when it contains a comma, quote or line break.
const cell = (value) => {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Rows (objects) to CSV text, with the columns in the order given.
export function toCSV(columns, rows) {
  return [columns.join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))].join("\r\n") + "\r\n";
}

// Minimal CSV parser supporting quoted fields, escaped quotes and CRLF.
export function parseCSV(text) {
  const rows = [];
  let cur = "";
  let row = [];
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else { q = false; }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      q = true;
    } else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (cur !== "" || row.length) { row.push(cur); rows.push(row); row = []; cur = ""; }
      if (c === "\r" && text[i + 1] === "\n") i++; // swallow CRLF
    } else {
      cur += c;
    }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// A bad date in one row must not sink the whole import. A bare "YYYY-MM-DD" is a local
// calendar day (new Date() would read it as UTC, the evening before west of UTC).
function toISO(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const day = parseDay(text);
    return Number.isNaN(day.getTime()) ? null : isoDateOnly(day);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const findColumn = (header, names) => {
  for (const name of names) {
    const idx = header.indexOf(name);
    if (idx >= 0) return idx;
  }
  return -1;
};

function readTable(text) {
  const rows = parseCSV(String(text || ""));
  if (!rows.length) throw new Error("That CSV file is empty.");
  const header = rows[0].map((h) => h.trim().toLowerCase());
  return { header, body: rows.slice(1).filter((r) => r.some((cell) => cell.trim() !== "")) };
}

// Import rows are partial on purpose: no default tags/scares, so merging an
// import never overwrites what the user already curated.
// Letterboxd ratings are already 0.5-5 stars.
export function parseLetterboxdCSV(text) {
  const { header, body } = readTable(text);
  const iTitle = findColumn(header, ["name", "title"]);
  if (iTitle < 0) throw new Error("This doesn't look like a Letterboxd export (no Name/Title column).");
  const iYear = findColumn(header, ["year"]);
  const iWatched = findColumn(header, ["watched date", "watcheddate", "watched on", "date"]);
  const iRating = findColumn(header, ["rating", "your rating"]);
  const iTmdb = findColumn(header, ["tmdbid", "tmdb id"]);
  const iTags = findColumn(header, ["tags"]);
  const iReview = findColumn(header, ["review"]);
  return body
    .map((r) => {
      const title = (r[iTitle] || "").trim();
      const year = Number(r[iYear]) || undefined;
      const watched = toISO(r[iWatched]);
      // a TMDb id (as in HorrorHub's own Letterboxd export) links the film to TMDb straight away
      const tmdbId = iTmdb >= 0 ? Number(r[iTmdb]) : NaN;
      const item = { id: Number.isInteger(tmdbId) && tmdbId > 0 ? tmdbId : `letterboxd:${title}:${year || ""}`, title, year };
      if (watched) item.watchedDates = [watched];
      const rating = Number(r[iRating]);
      if (rating > 0) item.rating = rating;
      const tags = iTags >= 0 ? (r[iTags] || "").split(",").map((t) => t.trim()).filter(Boolean) : [];
      if (tags.length) item.tags = tags;
      const review = iReview >= 0 ? (r[iReview] || "").trim() : "";
      if (review) item.notes = review;
      return item;
    })
    .filter((i) => i.title);
}

// IMDb rates out of 10; HorrorHub uses 5 stars, so halve it.
export function parseImdbCSV(text) {
  const { header, body } = readTable(text);
  const iConst = findColumn(header, ["const"]);
  const iTitle = findColumn(header, ["title"]);
  if (iTitle < 0) throw new Error("This doesn't look like an IMDb export (no Title column).");
  const iYear = findColumn(header, ["year"]);
  const iRating = findColumn(header, ["your rating"]);
  const iDate = findColumn(header, ["date rated"]);
  return body
    .map((r) => {
      const title = (r[iTitle] || "").trim();
      const year = Number(r[iYear]) || undefined;
      const imdbId = iConst >= 0 ? (r[iConst] || "").trim() : "";
      const item = { id: imdbId ? `imdb:${imdbId}` : `imdb:${title}:${year || ""}`, title, year };
      const rated = toISO(r[iDate]);
      if (rated) item.watchedDates = [rated];
      const rating10 = Number(r[iRating]);
      if (rating10 > 0) item.rating = Math.min(5, Math.round(rating10) / 2);
      return item;
    })
    .filter((i) => i.title);
}
