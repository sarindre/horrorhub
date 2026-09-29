import { tmdbGet } from "./tmdb.js";
import { inferTags, mergeInferred, tagState } from "./tagging.js";
import { inferFlags } from "./contentFlags.js";

const META_CACHE_MS = 30 * 60 * 1000;
const MAX_KEYWORDS = 40;

// One request gives everything catalog intelligence needs: genres, runtime,
// overview and TMDb's keywords (append_to_response saves a second call).
export async function fetchFilmMeta(id, { apiKey, signal } = {}) {
  const d = await tmdbGet(`/movie/${id}?language=en-US&append_to_response=keywords`, { apiKey, signal, cacheMs: META_CACHE_MS });
  return {
    id,
    title: d.title,
    overview: d.overview || "",
    runtime: typeof d.runtime === "number" && d.runtime > 0 ? d.runtime : undefined,
    year: d.release_date ? Number(d.release_date.slice(0, 4)) : undefined,
    genreIds: (d.genres || []).map((g) => g.id),
    keywords: (d.keywords?.keywords || []).map((k) => String(k.name).toLowerCase()),
  };
}

// Tags and content flags this metadata supports.
export function analyzeMeta(meta) {
  return {
    tags: inferTags(meta),
    flags: inferFlags(meta),
    keywords: (meta.keywords || []).slice(0, MAX_KEYWORDS),
    runtime: meta.runtime,
  };
}

// Whatever we can tell from what a film already carries locally (list rows have
// an overview and year but no keywords). Used the moment a film is added, and
// as the fallback when TMDb has no record.
export const analyzeLocal = (item) => analyzeMeta({ overview: item.overview, year: item.year, keywords: [], genreIds: [] });

// The library patch for applying an analysis to a film. Inferred values are
// merged in (never re-adding what you removed, never touching what you typed).
export function analysisPatch(item, analysis, now = new Date().toISOString()) {
  const tags = mergeInferred(tagState(item), analysis.tags);
  const flags = mergeInferred({ list: item.contentFlags || [], auto: item.autoFlags || [], removed: item.removedFlags || [] }, analysis.flags);
  return {
    tags: tags.list,
    autoTags: tags.auto,
    removedTags: tags.removed,
    contentFlags: flags.list,
    autoFlags: flags.auto,
    removedFlags: flags.removed,
    keywords: analysis.keywords.length ? analysis.keywords : item.keywords || [],
    ...(analysis.runtime ? { runtime: analysis.runtime } : {}),
    taggedAt: now,
  };
}
