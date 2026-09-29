const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, "0");

// A watch date as HorrorHub stores it: local midnight of that day, as an ISO string.
export const isoDateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

// Calendar days are local "YYYY-MM-DD" strings. Always build and read them with
// the local getters: a text date passed to the Date constructor is read as UTC midnight,
// which is the previous evening anywhere west of UTC.
export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const parseDay = (key) => {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (key, n) => {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
export const daysBetween = (from, to) => Math.round((parseDay(to) - parseDay(from)) / DAY_MS);
