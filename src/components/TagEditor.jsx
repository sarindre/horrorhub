import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Badge } from "./ui/badge.jsx";
import { canonicalTag, SUGGESTED_TAGS } from "../lib/tagging.js";

// Tags for one film. Tags HorrorHub inferred from TMDb data are marked ✦ (click
// any tag to remove it; a removed inferred tag stays removed). What you type is
// normalized ("Folk Horror" -> #folk-horror) so the same tag never splits in two.
export function TagEditor({ tags = [], autoTags = [], onChange }) {
  const [input, setInput] = useState("");
  const add = (t) => {
    const v = canonicalTag(t);
    if (!v) return;
    if (tags.includes(v)) {
      setInput("");
      return;
    }
    onChange?.([...tags, v]);
    setInput("");
  };
  const remove = (t) => onChange?.(tags.filter((x) => x !== t));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <Badge key={t} className="cursor-pointer" onClick={() => remove(t)} title={autoTags.includes(t) ? "Added automatically from TMDb data. Click to remove." : "Remove tag"}>
            {autoTags.includes(t) ? "✦ " : ""}#{t}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add tag and press Enter"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add(input);
          }}
        />
        <Button onClick={() => add(input)}>
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 text-sm opacity-80">
        {SUGGESTED_TAGS.filter((t) => !tags.includes(t)).map((t) => (
          <button key={t} onClick={() => add(t)} className="px-2 py-1 rounded-full border hover:bg-muted">
            #{t}
          </button>
        ))}
      </div>
    </div>
  );
}
