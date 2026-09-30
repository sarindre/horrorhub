import { Search, X } from "lucide-react";

export default function SearchBar({
  value,
  onChange,
  onSearch,
  onClear,
  loading = false,
  placeholder = "Search horror (title)…",
}) {
  function handleKey(e) {
    if (e.key === "Enter") onSearch?.();
  }

  return (
    <div
      className="
        w-full rounded-2xl border border-zinc-700/60 bg-zinc-900/70
        backdrop-blur-md shadow-lg
        focus-within:ring-2 focus-within:ring-emerald-400/60
        transition-all
      "
    >
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5">
        <Search className="w-5 h-5 text-zinc-400 shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="
            min-w-0 flex-1 bg-transparent outline-none text-base
            placeholder:text-zinc-500
          "
        />
        {value && (
          <button
            onClick={onClear}
            className="
              hidden sm:flex items-center gap-1 text-zinc-400 hover:text-zinc-100
              px-2 py-1 rounded-lg
            "
            title="Clear"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onSearch}
          disabled={loading}
          className="
            shrink-0 rounded-xl px-3 sm:px-4 py-2
            bg-emerald-500/90 hover:bg-emerald-500
            disabled:opacity-60 disabled:cursor-not-allowed
            text-black font-medium
          "
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
    </div>
  );
}

