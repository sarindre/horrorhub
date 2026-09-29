import { useId, useState } from "react";
import { Calendar as CalIcon, Check } from "lucide-react";
import { Button } from "./ui/button.jsx";
import { DateField } from "./ui/date-field.jsx";
import { Label } from "./ui/label.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog.jsx";
import { dayKey, isoDateOnly } from "../lib/dates.js";
import { longAgoDate, rememberWatch } from "../lib/watch.js";

// "Log a watch date": pick a day, or use today / long ago. Calls onLog(iso) with the
// stored date; the caller decides what to do with it (see lib/watch.js).
export function WatchDialog({ label = "Watched", variant = "secondary", longAgo = false, onLog }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date());
  const fieldId = useId();

  const change = (next) => {
    if (next) setDate(new Date()); // start from today each time
    setOpen(next);
  };
  const log = (day, { remember = true } = {}) => {
    const iso = isoDateOnly(day);
    onLog(iso);
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
              <Button variant="outline" onClick={() => log(longAgoDate(), { remember: false })}>
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
