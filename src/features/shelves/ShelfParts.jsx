import { Film } from "lucide-react";
import { TMDB_IMG } from "../../lib/tmdb.js";

// A 2x2 collage of a shelf's first four posters.
export function ShelfCover({ films, className = "" }) {
  const posters = films.filter((f) => f.poster).slice(0, 4);
  return (
    <div className={`grid grid-cols-2 gap-0.5 overflow-hidden rounded-lg bg-white/10 ${className}`} aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) =>
        posters[i] ? (
          <img key={i} src={TMDB_IMG(posters[i].poster, "w185")} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div key={i} className="flex items-center justify-center bg-white/5">
            {i === 0 && !posters.length ? <Film className="h-5 w-5 opacity-40" /> : null}
          </div>
        )
      )}
    </div>
  );
}

// One film in a horizontal strip: poster, title and the reason it's there.
export function FilmTile({ item, reasons = [], onOpen }) {
  return (
    <button type="button" onClick={() => onOpen?.(item)} className="w-28 shrink-0 text-left" title={item.title}>
      {item.poster ? (
        <img src={TMDB_IMG(item.poster, "w185")} alt="" loading="lazy" decoding="async" className="h-40 w-28 rounded-lg object-cover" />
      ) : (
        <div className="flex h-40 w-28 items-center justify-center rounded-lg bg-white/10">
          <Film className="h-6 w-6 opacity-50" />
        </div>
      )}
      <div className="mt-1 line-clamp-2 text-sm leading-tight">{item.title}</div>
      {reasons.length ? <div className="line-clamp-2 text-[11px] opacity-60">{reasons[0]}</div> : null}
    </button>
  );
}
