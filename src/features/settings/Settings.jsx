import { useEffect, useState } from "react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Label } from "../../components/ui/label.jsx";
import { ExportImport } from "./ExportImport.jsx";
import { THEMES } from "../../lib/settings.js";

const THEME_LABELS = { dark: "Dark", light: "Light", system: "System" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MIXER_ROWS = [
  ["Ghosts", "mixerGhosts"],
  ["Occult", "mixerOccult"],
  ["Slasher", "mixerSlasher"],
  ["Folk", "mixerFolk"],
];

function Toggle({ id, label, checked, onChange }) {
  return (
    <div className="pt-2 flex items-center gap-2">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

// Lets you type freely (e.g. "10") and only clamps and commits on blur/Enter,
// instead of snapping to the minimum after the first keystroke.
function NumberField({ value, min, max, onCommit, className = "w-20" }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Math.min(max, Math.max(min, Math.round(Number(draft)) || value));
    setDraft(String(n));
    onCommit(n);
  };
  return (
    <Input
      type="number"
      min={min}
      max={max}
      className={className}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
    />
  );
}

// API keys are masked by default; Show reveals them for checking a paste.
function SecretInput({ value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex gap-2">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
        {visible ? "Hide" : "Show"}
      </Button>
    </div>
  );
}

// Controlled by the app: `settings` is the single source of truth and every
// change goes through `update({ key: value })`, which validates and persists.
export function Settings({ settings, update, onImport, watchlist, data }) {
  const thisYear = new Date().getFullYear();
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="text-lg font-semibold">Appearance & Data</div>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <Button key={t} variant={settings.theme === t ? "default" : "outline"} onClick={() => update({ theme: t })}>
                {THEME_LABELS[t]}
              </Button>
            ))}
          </div>
          <div className="text-sm opacity-70">Dark is the default. System follows your device's light/dark setting.</div>
          <Toggle id="spookyfont-toggle" label="Spooky header font" checked={settings.spookyFont} onChange={(v) => update({ spookyFont: v })} />
          <Toggle id="flicker-toggle" label="Ambient edge flicker" checked={settings.flicker} onChange={(v) => update({ flicker: v })} />
          <Toggle id="fog-toggle" label="Fog overlay" checked={settings.fog} onChange={(v) => update({ fog: v })} />
          <Toggle id="audio-toggle" label="Ambient whispers/heartbeat" checked={settings.ambientAudio} onChange={(v) => update({ ambientAudio: v })} />
          <Toggle id="externaloff-toggle" label="Disable external lookups (OMDb / DoesTheDogDie)" checked={settings.externalOff} onChange={(v) => update({ externalOff: v })} />
          <Toggle id="lightsout-toggle" label="Lights‑Out dimmer" checked={settings.lightsOut} onChange={(v) => update({ lightsOut: v })} />
          <Toggle id="radar-toggle" label="Release Radar notifications" checked={settings.releaseRadar} onChange={(v) => update({ releaseRadar: v })} />
          <div className="pt-2 flex items-center gap-2">
            <Label className="text-sm">Nudge cadence (days 3–14)</Label>
            <NumberField value={settings.nudgeDays} min={3} max={14} onCommit={(n) => update({ nudgeDays: n })} />
          </div>
          <div className="pt-2 flex items-center gap-2">
            <Label className="text-sm">“Long ago” year</Label>
            <NumberField value={settings.longAgoYear} min={1800} max={thisYear} className="w-24" onCommit={(n) => update({ longAgoYear: n })} />
            <div className="text-xs opacity-70">Used when logging “Watched long ago” and to exclude from Stats.</div>
          </div>
          <div className="pt-4 text-sm font-semibold">Subgenre Mixer</div>
          <div className="grid grid-cols-2 gap-3 text-sm items-center">
            {MIXER_ROWS.map(([label, key]) => (
              <div key={key} className="contents">
                <Label>{label}</Label>
                <input type="range" min="0" max="2" step="1" value={settings[key]} onChange={(e) => update({ [key]: Number(e.target.value) })} />
              </div>
            ))}
          </div>
          <div className="pt-4 text-sm font-semibold">Accessibility</div>
          <Toggle id="hc-toggle" label="High-Contrast mode" checked={settings.highContrast} onChange={(v) => update({ highContrast: v })} />
          <Toggle id="dys-toggle" label="Dyslexia‑friendly font" checked={settings.dyslexic} onChange={(v) => update({ dyslexic: v })} />
          <div className="pt-4 text-sm font-semibold">Weekly Watch Plan</div>
          <div className="text-xs opacity-80">Preferred days</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {WEEKDAYS.map((d, idx) => (
              <label key={d} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={settings.planDays.includes(idx)}
                  onChange={(e) => update({ planDays: e.target.checked ? [...settings.planDays, idx] : settings.planDays.filter((x) => x !== idx) })}
                />
                {d}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm mt-2">
            <Label>Time</Label>
            <Input type="time" value={settings.planTime} onChange={(e) => update({ planTime: e.target.value })} className="w-28" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="text-lg font-semibold">Backup & Import</div>
          <div className="text-sm opacity-70">Export your library to JSON, import from JSON/CSV, or export a watchlist calendar.</div>
          <ExportImport data={data || []} onImport={onImport} watchlist={watchlist || []} />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="text-lg font-semibold">Connections</div>
          <div className="text-sm opacity-70">Keys are stored only in this browser (localStorage) and sent only to the service they belong to.</div>
          <Label className="text-sm">TMDb API Access Token (v4)</Label>
          <SecretInput value={settings.apiKey} onChange={(v) => update({ apiKey: v })} placeholder="Paste your Bearer token here" />
          <div className="text-sm opacity-70">Get a free account at themoviedb.org → Settings → API → v4 auth. Paste the long token here.</div>
          <div className="pt-3" />
          <Label className="text-sm">OMDb API Key (optional, for IMDb/RT ratings)</Label>
          <SecretInput value={settings.omdbKey} onChange={(v) => update({ omdbKey: v })} placeholder="If set, details pages show IMDb and Rotten Tomatoes" />
          <div className="pt-3" />
          <Label className="text-sm">DoesTheDogDie API Key (optional, for jump scares & content)</Label>
          <SecretInput value={settings.dddKey} onChange={(v) => update({ dddKey: v })} placeholder="If set, details pages auto-fill jump scares/gore/disturbing" />
        </CardContent>
      </Card>
    </div>
  );
}
