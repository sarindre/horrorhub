import { useRef } from "react";
import { Download, Upload, CalendarPlus } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { parseImdbCSV, parseLetterboxdCSV } from "../../lib/csv.js";
import { createICS } from "../../lib/ics.js";
import { buildExport } from "../../lib/library.js";

export function ExportImport({ data, onImport, watchlist = [] }) {
  const fileRef = useRef(null);
  const lbRef = useRef(null);
  const imdbRef = useRef(null);

  const saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const today = () => new Date().toISOString().slice(0, 10);

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(buildExport(data), null, 2)], { type: "application/json" });
    saveBlob(blob, `horrorhub-${today()}.json`);
  };

  // Reads a file, turns its text into an import payload, and hands it to the
  // app, which validates, previews and merges it. Nothing is applied here.
  const readImport = (file, parse, label) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImport?.(parse(String(reader.result || "")), label);
      } catch (err) {
        alert(err?.message || `Couldn't read that ${label} file.`);
      }
    };
    reader.readAsText(file);
  };
  const parseJSONFile = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("That file isn't valid JSON.");
    }
  };
  const pick = (parse, label) => (e) => {
    const f = e.target.files?.[0];
    if (f) readImport(f, parse, label);
    e.target.value = ""; // allow re-picking the same file
  };

  const downloadICS = () => {
    const days = Math.min(30, watchlist.length);
    const start = new Date();
    const events = Array.from({ length: days }).map((_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      d.setHours(20, 0, 0, 0);
      const m = watchlist[i];
      return { title: `Watch: ${m.title}${m.year ? ` (${m.year})` : ""}`, start: d, description: `From your HorrorHub watchlist.` };
    });
    saveBlob(new Blob([createICS({ events })], { type: "text/calendar" }), `horrorhub-watchlist-${today()}.ics`);
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <Button onClick={downloadJSON}>
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>
      <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={pick(parseJSONFile, "JSON")} />
      <Button variant="secondary" onClick={() => fileRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" />
        Import
      </Button>
      <input ref={lbRef} type="file" accept=".csv,text/csv" className="hidden" onChange={pick(parseLetterboxdCSV, "Letterboxd CSV")} />
      <Button variant="secondary" onClick={() => lbRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" />
        Import Letterboxd CSV
      </Button>
      <input ref={imdbRef} type="file" accept=".csv,text/csv" className="hidden" onChange={pick(parseImdbCSV, "IMDb CSV")} />
      <Button variant="secondary" onClick={() => imdbRef.current?.click()}>
        <Upload className="h-4 w-4 mr-2" />
        Import IMDb CSV
      </Button>
      <Button variant="outline" onClick={downloadICS}>
        <CalendarPlus className="h-4 w-4 mr-2" />
        Export ICS
      </Button>
    </div>
  );
}
