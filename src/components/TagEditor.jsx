import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { Badge } from "./ui/badge.jsx";

const SUGGESTED_TAGS = [
  "supernatural",
  "slasher",
  "found-footage",
  "psychological",
  "gore",
  "slow-burn",
  "folk-horror",
  "creature",
  "haunted",
  "possession",
  "vampire",
  "zombie",
  "occult",
  "sci-horror",
  "cosmic",
  "home-invasion",
  "survival",
  "arthouse",
  "campy",
  "classic",
];

export function TagEditor({ tags = [], onChange }) {
  const [input, setInput] = useState("");
  const add = (t) => {
    const v = t.trim().toLowerCase();
    if (!v) return;
    if (tags.includes(v)) return;
    onChange?.([...tags, v]);
    setInput("");
  };
  const remove = (t) => onChange?.(tags.filter((x) => x !== t));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <Badge key={t} className="cursor-pointer" onClick={() => remove(t)} title="Remove tag">
            #{t}
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
        {SUGGESTED_TAGS.map((t) => (
          <button key={t} onClick={() => add(t)} className="px-2 py-1 rounded-full border hover:bg-muted">
            #{t}
          </button>
        ))}
      </div>
    </div>
  );
}
