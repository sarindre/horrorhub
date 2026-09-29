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

// A bad date in one row must not sink the whole import.
function toISO(value) {
  if (!value) return null;
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
  const iWatched = findColumn(header, ["watched date", "watched on", "date"]);
  const iRating = findColumn(header, ["rating", "your rating"]);
  return body
    .map((r) => {
      const title = (r[iTitle] || "").trim();
      const year = Number(r[iYear]) || undefined;
      const watched = toISO(r[iWatched]);
      const item = { id: `letterboxd:${title}:${year || ""}`, title, year };
      if (watched) item.watchedDates = [watched];
      const rating = Number(r[iRating]);
      if (rating > 0) item.rating = rating;
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
