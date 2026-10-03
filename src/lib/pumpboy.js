// "Find PumpBoy": each day the mascot hides on a few screens, peeking from an edge. Which
// screens, and where, is worked out from the date alone (nothing to store, the same all day),
// and only what you've found is remembered. Pure functions; components/PumpBoyHider.jsx shows him.

export const SPOTS = ["bottom-right", "bottom-left", "right", "left"];

// A small seeded random-number generator (mulberry32) fed by a string, so a day always shuffles the same way.
function seeded(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Where he hides on `day` ("YYYY-MM-DD"): { viewId: spot }. One to three screens, and two to
// four in October, when he gets bolder.
export function hidingPlaces(day, viewIds) {
  const rand = seeded(`pumpboy:${day}`);
  const october = day.slice(5, 7) === "10";
  const count = Math.min(viewIds.length, (october ? 2 : 1) + Math.floor(rand() * 3));
  const pool = [...viewIds];
  const places = {};
  for (let i = 0; i < count; i++) {
    const view = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    places[view] = SPOTS[Math.floor(rand() * SPOTS.length)];
  }
  return places;
}

// What's remembered: how many times in all, and which screens you've found him on today.
export const emptyFinds = () => ({ total: 0, day: "", views: [] });

export function normalizeFinds(raw) {
  const f = raw && typeof raw === "object" ? raw : {};
  return {
    total: Number.isFinite(f.total) && f.total > 0 ? Math.floor(f.total) : 0,
    day: typeof f.day === "string" ? f.day : "",
    views: Array.isArray(f.views) ? f.views.filter((v) => typeof v === "string") : [],
  };
}

export function foundToday(finds, day, view) {
  const f = normalizeFinds(finds);
  return f.day === day && f.views.includes(view);
}

export function recordFind(finds, day, view) {
  const f = normalizeFinds(finds);
  if (foundToday(f, day, view)) return f;
  return { total: f.total + 1, day, views: f.day === day ? [...f.views, view] : [view] };
}

export function findMessage(total) {
  if (total <= 1) return "You found PumpBoy, drawn by totalnightmare! He'll hide somewhere new tomorrow.";
  if (total % 10 === 0) return `Found him again! That's ${total} times. You're good at this.`;
  return `Found him! That's ${total} so far.`;
}
