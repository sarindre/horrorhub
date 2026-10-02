import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button.jsx";
import { Input } from "./ui/input.jsx";
import { checkToken, cleanToken, diagnoseToken } from "../lib/tokenCheck.js";
import { isAbort } from "../lib/tmdb.js";

const TONE = { ok: "text-emerald-400", bad: "text-red-300", offline: "text-amber-300", error: "text-red-300", shape: "text-amber-300", checking: "opacity-70" };

// The TMDb token box. What you paste is tidied (spaces, quotes, "Bearer "), common mistakes
// are named straight away (like pasting the short API Key), and the token is tested against
// TMDb a moment after you stop typing, so you know it works before you leave this screen.
// `check` is injectable for tests.
export function TokenField({ value, onChange, check = checkToken, id = "tmdb-token" }) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [attempt, setAttempt] = useState(0);
  const shape = useMemo(() => diagnoseToken(value), [value]);

  useEffect(() => {
    if (!value || shape) {
      setStatus({ state: "idle", message: "" });
      return;
    }
    const controller = new AbortController();
    setStatus({ state: "checking", message: "Checking your token…" });
    const timer = setTimeout(
      async () => {
        try {
          const result = await check(value, { signal: controller.signal });
          if (!controller.signal.aborted) setStatus(result);
        } catch (err) {
          if (!isAbort(err) && !controller.signal.aborted) setStatus({ state: "error", message: "Couldn't test the token." });
        }
      },
      attempt ? 0 : 700 // a pressed "Test token" doesn't wait
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value, shape, check, attempt]);

  const line = shape ? { tone: "shape", text: shape.message } : status.state !== "idle" ? { tone: status.state, text: status.message } : null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(cleanToken(e.target.value))}
          placeholder="Paste your TMDb API Read Access Token"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`${id}-status`}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>{visible ? "Hide" : "Show"}</Button>
        <Button type="button" variant="outline" size="sm" disabled={!value || !!shape || status.state === "checking"} onClick={() => setAttempt((n) => n + 1)}>Test token</Button>
      </div>
      <div id={`${id}-status`} role="status" aria-live="polite" className={`min-h-[1.25rem] text-sm ${line ? TONE[line.tone] : ""}`}>
        {line ? (line.tone === "ok" ? "✓ " : "") + line.text : ""}
      </div>
    </div>
  );
}
