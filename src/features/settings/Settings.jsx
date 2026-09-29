import { useEffect, useState } from "react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Label } from "../../components/ui/label.jsx";
import { ExportImport } from "./ExportImport.jsx";

export function Settings({ settings, onChange, onImport, watchlist, data }) {
  const [apiKey, setApiKey] = useState(settings.apiKey || "");
  const [omdbKey, setOmdbKey] = useState(settings.omdbKey || "");
  const [dddKey, setDddKey] = useState(settings.dddKey || "");
  const [theme, setTheme] = useState(settings.theme || "dark");
  const [flicker, setFlicker] = useState(settings.flicker ?? true);
  const [fog, setFog] = useState(settings.fog ?? true);
  const [ambientAudio, setAmbientAudio] = useState(settings.ambientAudio ?? false);
  const [lightsOut, setLightsOut] = useState(settings.lightsOut ?? false);
  const [seasonal, setSeasonal] = useState(settings.seasonal ?? (new Date().getMonth()===9));
  const [releaseRadar, setReleaseRadar] = useState(settings.releaseRadar ?? true);
  const [nudgeDays, setNudgeDays] = useState(settings.nudgeDays ?? 7);
  const [mGhosts, setMGhosts] = useState(settings.mixerGhosts ?? 1);
  const [mOccult, setMOccult] = useState(settings.mixerOccult ?? 1);
  const [mSlasher, setMSlasher] = useState(settings.mixerSlasher ?? 1);
  const [mFolk, setMFolk] = useState(settings.mixerFolk ?? 1);
  const [spookyFont, setSpookyFont] = useState(settings.spookyFont ?? true);
  const [highContrast, setHighContrast] = useState(settings.highContrast ?? false);
  const [dyslexic, setDyslexic] = useState(settings.dyslexic ?? false);
  const [externalOff, setExternalOff] = useState(settings.externalOff ?? false);
  const [planDays, setPlanDays] = useState(settings.planDays ?? [5,6]);
  const [planTime, setPlanTime] = useState(settings.planTime ?? '20:00');
  const [longAgoYear, setLongAgoYear] = useState(settings.longAgoYear ?? 1900);
  useEffect(() => {
    onChange?.({ apiKey, omdbKey, dddKey, theme, flicker, fog, ambientAudio, lightsOut, seasonal, releaseRadar, nudgeDays, mixerGhosts: mGhosts, mixerOccult: mOccult, mixerSlasher: mSlasher, mixerFolk: mFolk, highContrast, dyslexic, planDays, planTime, externalOff, spookyFont, longAgoYear });
  }, [apiKey, omdbKey, dddKey, theme, flicker, fog, ambientAudio, lightsOut, seasonal, releaseRadar, nudgeDays, mGhosts, mOccult, mSlasher, mFolk, highContrast, dyslexic, planDays, planTime, externalOff, spookyFont, longAgoYear]);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <div className="text-lg font-semibold">Appearance & Data</div>
          <div className="flex gap-2">
            <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => setTheme("dark")}>
              Dark
            </Button>
            <Button variant={theme === "light" ? "default" : "outline"} onClick={() => setTheme("light")}>
              Light
            </Button>
            <Button variant={theme === "system" ? "default" : "outline"} onClick={() => setTheme("system")}>
              System
            </Button>
          </div>
          <div className="text-sm opacity-70">Theme value is stored locally. Wire it to your app shell if you add a real theme switcher.</div>
          <div className="pt-2 flex items-center gap-2">
            <input id="spookyfont-toggle" type="checkbox" checked={spookyFont} onChange={(e)=>setSpookyFont(e.target.checked)} />
            <Label htmlFor="spookyfont-toggle">Spooky header font</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="flicker-toggle" type="checkbox" checked={flicker} onChange={(e)=>setFlicker(e.target.checked)} />
            <Label htmlFor="flicker-toggle">Ambient edge flicker</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="fog-toggle" type="checkbox" checked={fog} onChange={(e)=>setFog(e.target.checked)} />
            <Label htmlFor="fog-toggle">Fog overlay</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="audio-toggle" type="checkbox" checked={ambientAudio} onChange={(e)=>setAmbientAudio(e.target.checked)} />
            <Label htmlFor="audio-toggle">Ambient whispers/heartbeat</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="externaloff-toggle" type="checkbox" checked={externalOff} onChange={(e)=>setExternalOff(e.target.checked)} />
            <Label htmlFor="externaloff-toggle">Disable external lookups (OMDb / DoesTheDogDie)</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="lightsout-toggle" type="checkbox" checked={lightsOut} onChange={(e)=>setLightsOut(e.target.checked)} />
            <Label htmlFor="lightsout-toggle">Lights‑Out dimmer</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="seasonal-toggle" type="checkbox" checked={seasonal} onChange={(e)=>setSeasonal(e.target.checked)} />
            <Label htmlFor="seasonal-toggle">October theme (blood moon + countdown)</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="radar-toggle" type="checkbox" checked={releaseRadar} onChange={(e)=>setReleaseRadar(e.target.checked)} />
            <Label htmlFor="radar-toggle">Release Radar notifications</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <Label className="text-sm">Nudge cadence (days 3–14)</Label>
            <Input type="number" min={3} max={14} className="w-20" value={nudgeDays} onChange={(e)=> setNudgeDays(Math.min(14, Math.max(3, Number(e.target.value)||7)))} />
          </div>          <div className="pt-2 flex items-center gap-2">
            <Label className="text-sm">“Long ago” year</Label>
            <Input type="number" min="1800" max={new Date().getFullYear()} className="w-24" value={longAgoYear} onChange={(e)=> setLongAgoYear(Math.max(1800, Math.min(new Date().getFullYear(), Number(e.target.value)||1900)))} />
            <div className="text-xs opacity-70">Used when logging “Watched long ago” and to exclude from Stats.</div>
          </div>
          <div className="pt-4 text-sm font-semibold">Subgenre Mixer</div>
          <div className="grid grid-cols-2 gap-3 text-sm items-center">
            <Label>Ghosts</Label>
            <input type="range" min="0" max="2" step="1" value={mGhosts} onChange={e=>setMGhosts(Number(e.target.value))} />
            <Label>Occult</Label>
            <input type="range" min="0" max="2" step="1" value={mOccult} onChange={e=>setMOccult(Number(e.target.value))} />
            <Label>Slasher</Label>
            <input type="range" min="0" max="2" step="1" value={mSlasher} onChange={e=>setMSlasher(Number(e.target.value))} />
            <Label>Folk</Label>
            <input type="range" min="0" max="2" step="1" value={mFolk} onChange={e=>setMFolk(Number(e.target.value))} />
          </div>
          <div className="pt-4 text-sm font-semibold">Accessibility</div>
          <div className="pt-2 flex items-center gap-2">
            <input id="hc-toggle" type="checkbox" checked={highContrast} onChange={(e)=>setHighContrast(e.target.checked)} />
            <Label htmlFor="hc-toggle">High-Contrast mode</Label>
          </div>
          <div className="pt-2 flex items-center gap-2">
            <input id="dys-toggle" type="checkbox" checked={dyslexic} onChange={(e)=>setDyslexic(e.target.checked)} />
            <Label htmlFor="dys-toggle">Dyslexia‑friendly font</Label>
          </div>
          <div className="pt-4 text-sm font-semibold">Weekly Watch Plan</div>
          <div className="text-xs opacity-80">Preferred days</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,idx)=> (
              <label key={d} className="inline-flex items-center gap-1"><input type="checkbox" checked={planDays.includes(idx)} onChange={(e)=>{
                setPlanDays(p=> e.target.checked ? Array.from(new Set([...p, idx])) : p.filter(x=>x!==idx));
              }} />{d}</label>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm mt-2">
            <Label>Time</Label>
            <Input type="time" value={planTime} onChange={(e)=> setPlanTime(e.target.value||'20:00')} className="w-28" />
          </div>
          <div className="pt-2" />
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
          <Label className="text-sm">TMDb API Access Token (v4)</Label>
          <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your Bearer token here" />
          <div className="text-sm opacity-70">Get a free account at themoviedb.org → Settings → API → v4 auth. Paste the long token here.</div>
          <div className="pt-3" />
          <Label className="text-sm">OMDb API Key (optional, for IMDb/RT ratings)</Label>
          <Input type="text" value={omdbKey} onChange={(e) => setOmdbKey(e.target.value)} placeholder="If set, details pages show IMDb and Rotten Tomatoes" />
          <div className="pt-3" />
          <Label className="text-sm">DoesTheDogDie API Key (optional, for jump scares & content)</Label>
          <Input type="text" value={dddKey} onChange={(e) => setDddKey(e.target.value)} placeholder="If set, details pages auto-fill jump scares/gore/disturbing" />
        </CardContent>
      </Card>
    </div>
  );
}
