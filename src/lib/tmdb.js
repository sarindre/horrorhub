export const TMDB_BASE = "https://api.themoviedb.org/3";

export const TMDB_IMG = (path, size = "w342") => (path ? `https://image.tmdb.org/t/p/${size}${path}` : "");
