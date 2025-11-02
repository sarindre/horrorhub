import { useEffect, useState } from "react";

export function useHybridRecommendations(items, apiKey) {
  const [existingTop, setExistingTop] = useState([]);
  const [similarPicks, setSimilarPicks] = useState([]);

  useEffect(() => {
    if (!apiKey || !items?.length) return;

    const controller = new AbortController();
    const signal = controller.signal;
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json;charset=utf-8",
    };

    const topRated = items.filter((i) => (i.rating || 0) >= 4);
    setExistingTop(topRated.slice(0, 3));

    async function fetchSimilar() {
      try {
        const liked = topRated.slice(0, 3);
        const requests = liked.map((movie) =>
          fetch(
            `https://api.themoviedb.org/3/movie/${movie.id}/similar?language=en-US&page=1`,
            { headers, signal }
          ).then((res) => (res.ok ? res.json() : { results: [] }))
        );
        const batches = await Promise.all(requests);
        const combined = batches.flatMap((d) => d?.results ?? []);

        // Dedupe and exclude items already in the local library
        const existingIds = new Set(items.map((i) => i.id));
        const seen = new Set();
        const picks = [];
        for (const r of combined) {
          if (!r || seen.has(r.id) || existingIds.has(r.id)) continue;
          seen.add(r.id);
          picks.push({
            id: r.id,
            title: r.title,
            year: r.release_date ? r.release_date.slice(0, 4) : "?",
            poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
            voteAvg: typeof r.vote_average === "number" ? r.vote_average : null,
            genre_ids: Array.isArray(r.genre_ids) ? r.genre_ids : [],
          });
          if (picks.length >= 15) break; // limit
        }
        if (!signal.aborted) setSimilarPicks(picks);
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.error("Failed to fetch similar movies:", err);
        }
      }
    }

    fetchSimilar();
    return () => controller.abort();
  }, [items, apiKey]);

  return { existingTop, similarPicks };
}
