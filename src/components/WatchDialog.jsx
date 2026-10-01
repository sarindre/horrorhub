import { useId, useState } from "react";
import { Calendar as CalIcon, Check } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { DateField } from "./ui/date-field.jsx";
import { Label } from "./ui/label.jsx";
import { Slider } from "./ui/slider.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog.jsx";
import { dayKey, isoDateOnly } from "../lib/dates.js";
import { longAgoDate, rememberWatch } from "../lib/watch.js";
import { COMPANY, WHEN } from "../lib/diary.js";

// "Log a watch date": pick a day, or use today / long ago, and optionally note how
// scared you were, who with, and when (the scare diary). Calls onLog(iso, diary) with
// the stored date and the note (undefined if you skipped it); the caller decides what to
// do with them (see lib/watch.js).
export function WatchDialog({ label = "Watched", variant = "secondary", longAgo = false, onLog }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date());
  const fieldId = useId();
  const [scared, setScared] = useState(null); // null until you move the slider
  const [company, setCompany] = useState(null);
  const [when, setWhen] = useState(null);

  const change = (next) => {
    if (next) {
      setDate(new Date()); // start from today each time
      setScared(null);
      setCompany(null);
      setWhen(null);
    }
    setOpen(next);
  };
  const log = (day, { remember = true, diary = true } = {}) => {
    const iso = isoDateOnly(day);
    const note = { ...(scared !== null ? { scared } : {}), ...(company ? { company } : {}), ...(when ? { when } : {}) };
    onLog(iso, diary && Object.keys(note).length ? note : undefined);
    if (remember) rememberWatch(iso);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger>
        <Button variant={variant} size="sm">
          <CalIcon className="h-4 w-4 mr-1" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log a watch date</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor={fieldId}>When did you watch it?</Label>
            <DateField id={fieldId} value={date} onChange={setDate} max={dayKey(new Date())} />
          </div>
          <fieldset className="flex flex-col gap-3 rounded-xl border p-3">
            <legend className="px-1 text-xs uppercase tracking-wide opacity-70">How was it? (optional)</legend>
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor={`${fieldId}-scared`} className="text-sm">How scared were you?</Label>
              <Slider id={`${fieldId}-scared`} aria-label="How scared were you?" value={[scared ?? 5]} min={0} max={10} step={1} onValueChange={(v) => setScared(v[0])} className="max-w-[10rem]" />
              <span className="min-w-[3rem] text-sm tabular-nums">{scared === null ? "not set" : `${scared}/10`}</span>
              {scared !== null ? <Button size="sm" variant="ghost" onClick={() => setScared(null)}>Clear</Button> : null}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Who with">
              {COMPANY.map((c) => (
                <Button key={c.id} size="sm" variant={company === c.id ? "default" : "outline"} aria-pressed={company === c.id} onClick={() => setCompany(company === c.id ? null : c.id)}>{c.label}</Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="When">
              {WHEN.map((w) => (
                <Button key={w.id} size="sm" variant={when === w.id ? "default" : "outline"} aria-pressed={when === w.id} onClick={() => setWhen(when === w.id ? null : w.id)}>{w.label}</Button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => log(date)}>
              <Check className="h-4 w-4 mr-2" />
              Save date
            </Button>
            <Button variant="outline" onClick={() => log(new Date())}>
              <CalIcon className="h-4 w-4 mr-2" />
              Watched today
            </Button>
            {longAgo ? (
              <Button variant="outline" onClick={() => log(longAgoDate(), { remember: false, diary: false })}>
                <CalIcon className="h-4 w-4 mr-2" />
                Watched long ago
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
