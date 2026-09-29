import { Button } from "./ui/button.jsx";

// "N films are hidden by your content limits" with a way to see them anyway.
export function HiddenNotice({ count, onReveal }) {
  if (!count) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm">
      <span>
        {count} film{count === 1 ? " is" : "s are"} hidden by your content limits (change them in Settings).
      </span>
      <Button size="sm" variant="outline" onClick={onReveal}>Show anyway</Button>
    </div>
  );
}
