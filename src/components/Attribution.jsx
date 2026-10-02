import tmdbLogo from "../assets/tmdb-logo.svg";

// TMDb's API terms require their logo and this notice wherever their data is used. The logo
// file is TMDb's own, unmodified, and links to their site.
export const TMDB_NOTICE = "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.";

export function Attribution() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-70">
      <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" aria-label="TMDB (opens The Movie Database)" className="inline-flex shrink-0">
        <img src={tmdbLogo} alt="TMDB" style={{ height: 14, width: "auto" }} />
      </a>
      <span className="min-w-0">Movie data and images from The Movie Database. {TMDB_NOTICE}</span>
    </div>
  );
}
