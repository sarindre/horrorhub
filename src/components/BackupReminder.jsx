import { Button } from "./ui/button.jsx";
import { ageLabel } from "../lib/backup.js";

// A slim banner for two situations: automatic backup has paused and needs one
// click to resume, or there's no backup of your library (or an old one).
export function BackupReminder({ reminder, paused, supported, lastBackupAt, onReconnect, onExport, onSetup, onSnooze }) {
  if (paused) {
    return (
      <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm">
        <span className="min-w-0">Automatic backup is paused until you allow access to your backup folder again.</span>
        <Button size="sm" onClick={onReconnect}>Reconnect</Button>
      </div>
    );
  }
  if (!reminder) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm">
      <span className="min-w-0 flex-1">
        {reminder.kind === "never"
          ? "Your library only lives on this device, and you haven't backed it up yet."
          : `Your last backup was ${ageLabel(lastBackupAt)}. Your library only lives on this device.`}
      </span>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onExport}>Export now</Button>
        {supported ? <Button size="sm" variant="outline" onClick={onSetup}>Set up automatic backup</Button> : null}
        <Button size="sm" variant="ghost" onClick={onSnooze}>Remind me later</Button>
      </div>
    </div>
  );
}
