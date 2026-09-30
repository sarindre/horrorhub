// The 60-second taste quiz: about a dozen well-known horror films, each answered
// "loved it / it was fine / too intense / haven't seen it". The answers seed the
// taste profile and your scare tolerance before you've rated anything. Answers
// are stored in settings; the films themselves are not added to your library.

export const CALIBRATION_FILMS = [
  { key: "halloween-1978", title: "Halloween", year: 1978, tags: ["slasher", "classic"], scares: 6 },
  { key: "exorcist-1973", title: "The Exorcist", year: 1973, tags: ["possession", "occult", "supernatural", "disturbing", "classic"], scares: 9 },
  { key: "shining-1980", title: "The Shining", year: 1980, tags: ["haunted", "psychological", "slow-burn", "classic"], scares: 7 },
  { key: "alien-1979", title: "Alien", year: 1979, tags: ["sci-horror", "creature", "survival", "classic"], scares: 7 },
  { key: "scream-1996", title: "Scream", year: 1996, tags: ["slasher", "campy"], scares: 4 },
  { key: "evil-dead-1981", title: "The Evil Dead", year: 1981, tags: ["occult", "gore", "campy", "creature"], scares: 7 },
  { key: "tcm-1974", title: "The Texas Chain Saw Massacre", year: 1974, tags: ["slasher", "survival", "disturbing", "classic"], scares: 8 },
  { key: "the-thing-1982", title: "The Thing", year: 1982, tags: ["sci-horror", "creature", "body-horror", "gore", "classic"], scares: 8 },
  { key: "blair-witch-1999", title: "The Blair Witch Project", year: 1999, tags: ["found-footage", "supernatural", "survival"], scares: 6 },
  { key: "get-out-2017", title: "Get Out", year: 2017, tags: ["psychological", "slow-burn"], scares: 5 },
  { key: "conjuring-2013", title: "The Conjuring", year: 2013, tags: ["haunted", "supernatural", "possession"], scares: 6 },
  { key: "midsommar-2019", title: "Midsommar", year: 2019, tags: ["folk-horror", "psychological", "disturbing", "arthouse"], scares: 7 },
  { key: "hereditary-2018", title: "Hereditary", year: 2018, tags: ["occult", "psychological", "disturbing", "slow-burn", "supernatural"], scares: 9 },
];

export const CALIBRATION_KEYS = CALIBRATION_FILMS.map((f) => f.key);

// answer id -> how it reads to the taste engine (a star rating stands in for
// the opinion) and what the button says.
export const CALIBRATION_ANSWERS = [
  { id: "loved", label: "Loved it", rating: 5 },
  { id: "fine", label: "It was fine", rating: 3.5 },
  { id: "toomuch", label: "Too intense", rating: 2 },
  { id: "unseen", label: "Haven't seen it", rating: 0 },
];
export const ANSWER_IDS = CALIBRATION_ANSWERS.map((a) => a.id);
const answerById = new Map(CALIBRATION_ANSWERS.map((a) => [a.id, a]));

// Answers count for less than real ratings, and fade as your own history grows.
export const SEED_WEIGHT = 0.7;

export const emptyCalibration = () => ({ answers: {}, doneAt: "" });

// Coerces stored/imported data into { answers, doneAt } with known films and answers only.
export function normalizeCalibration(raw) {
  const out = emptyCalibration();
  if (!raw || typeof raw !== "object") return out;
  for (const [key, answer] of Object.entries(raw.answers && typeof raw.answers === "object" ? raw.answers : {})) {
    if (CALIBRATION_KEYS.includes(key) && ANSWER_IDS.includes(answer)) out.answers[key] = answer;
  }
  if (typeof raw.doneAt === "string" && !Number.isNaN(new Date(raw.doneAt).getTime())) out.doneAt = raw.doneAt;
  return out;
}

export const isCalibrated = (calibration) => !!calibration?.doneAt;
export const answeredCount = (calibration) => Object.values(calibration?.answers || {}).filter((a) => a !== "unseen").length;

// Rating-shaped stand-ins for the taste engine. Only opinions count: "haven't
// seen it" says nothing. `scaresRated` keeps the film's typical scare level
// from being re-estimated.
export function calibrationSignals(calibration) {
  const out = [];
  for (const film of CALIBRATION_FILMS) {
    const answer = answerById.get(calibration?.answers?.[film.key]);
    if (!answer || !answer.rating) continue;
    out.push({ id: `calibration:${film.key}`, title: film.title, year: film.year, tags: film.tags, rating: answer.rating, scares: film.scares, scaresRated: true, watchedDates: [], answer: answer.id, seed: true });
  }
  return out;
}

// The scare level you told us was too much: one below the mildest film you
// found too intense. null when nothing was too intense.
export function scareCeilingFrom(calibration) {
  const levels = calibrationSignals(calibration).filter((s) => s.answer === "toomuch").map((s) => s.scares);
  return levels.length ? Math.max(0, Math.min(...levels) - 1) : null;
}
