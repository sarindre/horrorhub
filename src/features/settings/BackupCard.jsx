import { FolderSync, Download, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { ageLabel } from "../../lib/backup.js";
import { KEEP_DATED_BACKUPS } from "../../lib/backup.js";
import { isDesktopApp } from "../../lib/desktop.js";

// Where your library is kept safe: automatic backups to a folder, installing
// the app, and asking the browser not to clear its data. `backup` is
// useAutoBackup(), `app` is useInstallPrompt().
export function BackupCard({ backup, app }) {
  const { supported, status, folderName, lastBackupAt, error, busy } = backup;
  const last = lastBackupAt ? `Last backup ${ageLabel(lastBackupAt)}.` : "No backup yet.";

  return (
    <div className="space-y-5">
      <section aria-label="Automatic backup" className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><FolderSync className="h-4 w-4" /> Automatic backup</div>

        {status === "unsupported" ? (
          <div className="space-y-1 text-sm opacity-80">
            <div>This browser can't save to a folder on its own. Chrome, Edge and other Chromium browsers can.</div>
            <div>{last} Use Export below, and HorrorHub will remind you when it's been a while.</div>
          </div>
        ) : status === "loading" ? (
          <div className="text-sm opacity-70">Checking…</div>
        ) : status === "off" ? (
          <div className="space-y-2 text-sm">
            <div className="opacity-80">
              Pick a folder and HorrorHub keeps a backup there, updated a few seconds after every change. Choose one inside OneDrive, Dropbox or iCloud and your library is also safe if this computer is lost.
            </div>
            <Button onClick={backup.choose}>Choose backup folder</Button>
          </div>
        ) : status === "needs-permission" ? (
          <div className="space-y-2 text-sm">
            <div role="alert" className="text-amber-300">Automatic backup is paused. The browser needs you to allow access to “{folderName}” again.</div>
            <Button onClick={backup.reconnect}>Reconnect</Button>
            <Button variant="ghost" onClick={backup.disable}>Turn off</Button>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div role="status">
              {status === "error" ? (
                <span className="text-red-300">Couldn't write to “{folderName}”: {error}</span>
              ) : (
                <span>Backing up to <strong>{folderName || "your folder"}</strong>. {last}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={backup.backupNow} disabled={busy}>{busy ? "Backing up…" : status === "error" ? "Try again" : "Back up now"}</Button>
              <Button variant="ghost" onClick={backup.choose}>Change folder</Button>
              <Button variant="ghost" onClick={backup.disable}>Turn off</Button>
            </div>
          </div>
        )}
        {supported && error && status === "off" ? <div role="alert" className="text-sm text-red-300">{error}</div> : null}
        <div className="text-xs opacity-60">
          Saves your library, shelves, challenges, plans and settings (comfort limits, region, taste quiz) as horrorhub-backup.json plus the last {KEEP_DATED_BACKUPS} daily copies. API keys are never included. Restore with Import below.
        </div>
      </section>

      <section aria-label="Install" className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" /> Use it as an app</div>
        {app.installed ? (
          <div className="text-sm opacity-80">Installed. You're using HorrorHub as an app, and it works without internet (searching TMDb still needs a connection).</div>
        ) : app.canInstall ? (
          <div className="space-y-2 text-sm">
            <div className="opacity-80">Get a home-screen or desktop icon, your own window, and your library available offline.</div>
            <Button onClick={app.install}>Install HorrorHub</Button>
          </div>
        ) : (
          <div className="text-sm opacity-80">
            To install, use your browser's menu: “Install app” in Chrome or Edge, or Share → “Add to Home Screen” on iPhone. It then works offline (searching TMDb still needs a connection).
          </div>
        )}
      </section>

      {isDesktopApp() ? null : (
      <section aria-label="Storage" className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Browser storage</div>
        {app.persisted === true ? (
          <div className="text-sm opacity-80">Protected: the browser has agreed not to clear HorrorHub's data when space runs low.</div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="opacity-80">Your library is kept in this browser. If the disk runs low the browser may clear it, unless you ask it to keep it.</div>
            {app.canProtect ? <Button variant="outline" onClick={app.protectStorage}>Ask the browser to keep my data</Button> : null}
            {app.persisted === false ? <div className="text-xs opacity-60">The browser hasn't agreed yet. Installing the app, or using it more, often helps. A backup folder covers you either way.</div> : null}
          </div>
        )}
      </section>
      )}
    </div>
  );
}
