import { flagLabel } from "../lib/contentFlags.js";

// Warning chips for a film. Flags you've said you avoid are shown in red, the
// rest in amber; `reasons` (why it trips your limits) are spelled out below.
// Renders nothing when there's nothing to say.
export function ContentWarnings({ flags = [], avoid = [], reasons = [], showFlags = true }) {
  const chips = showFlags ? flags : flags.filter((f) => avoid.includes(f));
  if (!chips.length && !reasons.length) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {chips.length ? (
        <div className="flex flex-wrap items-center gap-1 text-[11px]" aria-label="Content warnings">
          {chips.map((f) => (
            <span
              key={f}
              className={`rounded border px-1.5 py-0.5 leading-4 ${
                avoid.includes(f) ? "border-red-500/60 bg-red-500/15 text-red-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"
              }`}
            >
              ⚠ {flagLabel(f)}
            </span>
          ))}
        </div>
      ) : null}
      {reasons.length ? <div className="text-[11px] text-red-300">{reasons.join(" · ")}</div> : null}
    </div>
  );
}
