import { useMemo, useState } from "react";
import { Users, Flame, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Slider } from "../../components/ui/slider.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Label } from "../../components/ui/label.jsx";
import { CONTENT_FLAGS } from "../../lib/contentFlags.js";
import { MOOD_PRESETS } from "../../lib/moods.js";
import { MAX_PEOPLE, MIN_PEOPLE, groupSummary, loadSavedPeople, newPerson, normalizePeople, personFromYou, rankForGroup, saveSavedPeople } from "../../lib/group.js";
import { useTasteProfile } from "../../lib/calibrationContext.js";
import { usePersistentState } from "../../lib/usePersistentState.js";

const VIBES = MOOD_PRESETS.filter((m) => m.id !== "all");
const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

// made once, so the guest keeps the same id until you edit the group
const STARTING_GROUP = [personFromYou({}), newPerson("Guest")];

// Group night: everyone's limits and vibes in, the films that suit the whole room out.
export function GroupNight({ library, settings, onOpenDetails }) {
  const profile = useTasteProfile(library);
  const [stored, setStored] = usePersistentState("group.people", null);
  const [allowSeen, setAllowSeen] = usePersistentState("group.allowSeen", false);
  const [saved, setSaved] = useState(loadSavedPeople);
  const [openId, setOpenId] = useState(null);

  // Your limits always come from Settings, so they can't drift from the rest of the app.
  const people = useMemo(() => {
    const list = normalizePeople(stored);
    const base = list.length >= MIN_PEOPLE ? list : STARTING_GROUP;
    return base.map((p) => (p.you ? { ...p, avoidFlags: settings.avoidFlags || [], maxScares: settings.maxScares ?? 10 } : p));
  }, [stored, settings.avoidFlags, settings.maxScares]);

  const update = (id, patch) => setStored(people.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const add = (person) => {
    if (people.length >= MAX_PEOPLE) return;
    setStored([...people, person]);
    setOpenId(person.id);
  };
  const remove = (id) => people.length > MIN_PEOPLE && setStored(people.filter((p) => p.id !== id));
  const saveFriend = (person) => {
    const next = [...saved.filter((s) => s.name.toLowerCase() !== person.name.toLowerCase()), { ...person, you: false }];
    saveSavedPeople(next);
    setSaved(loadSavedPeople());
  };
  const forget = (id) => {
    saveSavedPeople(saved.filter((s) => s.id !== id));
    setSaved(loadSavedPeople());
  };
  const available = saved.filter((s) => !people.some((p) => p.id === s.id || p.name.toLowerCase() === s.name.toLowerCase()));

  const result = useMemo(() => rankForGroup(library, people, { profile, allowSeen }), [library, people, profile, allowSeen]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Users className="h-5 w-5" /> Group night</h2>
        <p className="text-sm opacity-70">Add everyone who's watching. Their limits are hard rules; among what's left, the film that keeps the least-happy person happiest wins.</p>
      </div>

      <div className="space-y-3">
        {people.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            open={openId === p.id}
            onToggle={() => setOpenId(openId === p.id ? null : p.id)}
            canRemove={people.length > MIN_PEOPLE}
            onChange={(patch) => update(p.id, patch)}
            onRemove={() => remove(p.id)}
            onSave={() => saveFriend(p)}
          />
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={people.length >= MAX_PEOPLE} onClick={() => add(newPerson(`Guest ${people.length}`))}>
            <Plus className="mr-1 h-4 w-4" /> Add person
          </Button>
          {available.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={people.length >= MAX_PEOPLE} onClick={() => add({ ...s })}>+ {s.name}</Button>
              <button type="button" aria-label={`Forget ${s.name}`} title={`Forget ${s.name}`} className="rounded p-1 opacity-60 hover:opacity-100" onClick={() => forget(s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {people.length >= MAX_PEOPLE ? <span className="text-xs opacity-70">Four is the most.</span> : null}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!allowSeen} onChange={(e) => setAllowSeen(e.target.checked)} />
        Include films someone has already seen (listed last)
      </label>

      <div className="space-y-3">
        <div className="text-xs uppercase tracking-wide opacity-70">
          {result.picks.length ? `Best for ${people.map((p) => p.name).join(", ")}` : "No film fits everyone"}
        </div>
        {result.picks.map((pick, i) => (
          <PickRow key={pick.item.id} pick={pick} first={i === 0} people={people} onOpen={() => onOpenDetails(pick.item)} onToggleSeen={(person) => update(person.id, { seen: toggle(person.seen, pick.item.id) })} />
        ))}
        {!result.picks.length ? (
          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-4 text-sm">
              {library.length ? (
                <div>Every film in your library breaks someone's limits{allowSeen ? "" : " or has been seen by someone"}. Loosen a limit, or tick "include films someone has already seen".</div>
              ) : (
                <div>Your library is empty. Add some films first, then come back.</div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <RuledOut ruledOut={result.ruledOut} />
        <p className="text-xs opacity-60">Content warnings come from TMDb keywords and your ratings, so an absent warning isn't a guarantee. Check anything that really matters before pressing play.</p>
      </div>
    </div>
  );
}

function PersonCard({ person, open, onToggle, canRemove, onChange, onRemove, onSave }) {
  const limits = [];
  if (person.avoidFlags.length) limits.push(`avoids ${person.avoidFlags.length}`);
  if (person.maxScares < 10) limits.push(`max scare ${person.maxScares}`);
  const vibes = person.moods.map((m) => VIBES.find((v) => v.id === m)?.label).filter(Boolean);
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold">{person.name}{person.you ? <span className="ml-2 text-xs font-normal opacity-60">you</span> : null}</div>
            <div className="text-xs opacity-70">{[...limits, vibes.length ? `likes ${vibes.join(", ")}` : ""].filter(Boolean).join(" · ") || "No limits, no stated vibe"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" aria-expanded={open} onClick={onToggle}>{open ? "Done" : "Edit"}</Button>
            {canRemove ? <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${person.name}`}><Trash2 className="h-4 w-4" /></Button> : null}
          </div>
        </div>

        {open ? (
          <div className="space-y-4 border-t pt-3">
            {!person.you ? (
              <div className="grid gap-1">
                <Label htmlFor={`name-${person.id}`}>Name</Label>
                <Input id={`name-${person.id}`} value={person.name} maxLength={30} onChange={(e) => onChange({ name: e.target.value })} />
              </div>
            ) : null}

            {person.you ? (
              <div className="text-sm opacity-70">Your scare limit ({person.maxScares}) and content to avoid come from Settings → Catalog &amp; Content.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor={`max-${person.id}`}>Scare limit</Label>
                  <Slider id={`max-${person.id}`} aria-label={`${person.name}'s scare limit`} value={[person.maxScares]} min={0} max={10} step={1} onValueChange={(v) => onChange({ maxScares: v[0] })} className="max-w-xs" />
                  <span className="tabular-nums text-sm">{person.maxScares}</span>
                </div>
                <fieldset className="space-y-1">
                  <legend className="text-sm">Avoids</legend>
                  <div className="flex flex-wrap gap-2">
                    {CONTENT_FLAGS.map((f) => (
                      <Button key={f.id} size="sm" variant={person.avoidFlags.includes(f.id) ? "default" : "outline"} aria-pressed={person.avoidFlags.includes(f.id)} onClick={() => onChange({ avoidFlags: toggle(person.avoidFlags, f.id) })}>{f.label}</Button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <fieldset className="space-y-1">
              <legend className="text-sm">Vibes they enjoy</legend>
              <div className="flex flex-wrap gap-2">
                {VIBES.map((v) => (
                  <Button key={v.id} size="sm" variant={person.moods.includes(v.id) ? "default" : "outline"} aria-pressed={person.moods.includes(v.id)} onClick={() => onChange({ moods: toggle(person.moods, v.id) })}>{v.label}</Button>
                ))}
              </div>
            </fieldset>

            {!person.you ? <Button size="sm" variant="ghost" onClick={onSave}>Save {person.name} for next time</Button> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PickRow({ pick, first, people, onOpen, onToggleSeen }) {
  const { item } = pick;
  const guests = people.filter((p) => !p.you);
  return (
    <Card className={`rounded-2xl ${first ? "border-red-500/50" : ""}`}>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {first ? <div className="text-xs uppercase tracking-wide opacity-70">Best compromise</div> : null}
            <h3 className="text-lg font-semibold">{item.title}{item.year ? <span className="text-sm font-normal opacity-60"> ({item.year})</span> : null}</h3>
            <div className="flex flex-wrap items-center gap-x-3 text-sm opacity-80">
              <span className="flex items-center gap-1"><Flame className="h-4 w-4" /> Scare {pick.scare}/10{pick.estimated ? " (est.)" : ""}</span>
              {item.runtime ? <span>{Math.floor(item.runtime / 60)}h {item.runtime % 60}m</span> : null}
            </div>
          </div>
          <Button size="sm" onClick={onOpen}>Details</Button>
        </div>
        <div className="text-sm">{groupSummary(pick)}</div>
        {pick.seenBy.length ? <div className="text-xs text-amber-300">Already seen by {pick.seenBy.map((p) => p.name).join(", ")}</div> : null}
        {guests.length ? (
          <div className="flex flex-wrap gap-2">
            {guests.map((g) => {
              const seen = g.seen.some((id) => String(id) === String(item.id));
              return (
                <Button key={g.id} size="sm" variant={seen ? "default" : "ghost"} aria-pressed={seen} onClick={() => onToggleSeen(g)}>{g.name} has seen it</Button>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RuledOut({ ruledOut }) {
  const rows = ruledOut.filter((r) => r.count > 0);
  if (!rows.length) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer opacity-80">Ruled out by limits</summary>
      <ul className="mt-2 space-y-1 opacity-80">
        {rows.map((r) => (
          <li key={r.person.id}>
            {r.person.name}: {r.count} film{r.count === 1 ? "" : "s"} (for example {r.examples.join(", ")})
          </li>
        ))}
      </ul>
    </details>
  );
}
