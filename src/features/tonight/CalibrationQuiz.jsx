import { useState } from "react";
import { Card, CardContent } from "../../components/ui/card.jsx";
import { Button } from "../../components/ui/button.jsx";
import { CALIBRATION_ANSWERS, CALIBRATION_FILMS } from "../../lib/calibration.js";

// The taste quiz: one film at a time, four answers. Finishing (or stopping
// early) saves what was answered; nothing is written until then.
export function CalibrationQuiz({ initialAnswers = {}, onSave, onCancel }) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [index, setIndex] = useState(0);
  const film = CALIBRATION_FILMS[index];
  const last = index === CALIBRATION_FILMS.length - 1;

  const finish = (finalAnswers) => onSave({ answers: finalAnswers, doneAt: new Date().toISOString() });
  const answer = (id) => {
    const next = { ...answers, [film.key]: id };
    setAnswers(next);
    if (last) finish(next);
    else setIndex(index + 1);
  };

  return (
    <Card className="rounded-2xl border-red-500/40">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-lg font-semibold">Teach HorrorHub your taste</div>
            <div className="text-sm opacity-70">One tap per film. It shapes your picks and how scary they'll be. Nothing is added to your library.</div>
          </div>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>

        <div role="status" aria-live="polite" className="text-xs uppercase tracking-wide opacity-70">
          Film {index + 1} of {CALIBRATION_FILMS.length}
        </div>
        <div className="h-1.5 overflow-hidden rounded bg-white/10" aria-hidden="true">
          <div className="h-full rounded bg-red-600" style={{ width: `${(index / CALIBRATION_FILMS.length) * 100}%` }} />
        </div>

        <div>
          <div className="text-2xl font-semibold">{film.title} <span className="text-base font-normal opacity-60">({film.year})</span></div>
          <div className="mt-1 text-sm opacity-70">{film.tags.map((t) => `#${t}`).join(" ")}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CALIBRATION_ANSWERS.map((a) => (
            <Button key={a.id} variant={answers[film.key] === a.id ? "default" : "outline"} onClick={() => answer(a.id)}>{a.label}</Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>← Back</Button>
          <Button size="sm" variant="ghost" onClick={() => finish(answers)}>Finish now</Button>
        </div>
      </CardContent>
    </Card>
  );
}
