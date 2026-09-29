// Weekly watch plan: spread films across your preferred days/time.
// Pure, so the planner UI and the calendar export use the same schedule.

// planDays are weekday numbers (0 = Sunday); planTime is "HH:MM".
// Slots earlier than `start` (e.g. tonight's time already passed) are skipped.
export function buildWeeklyPlan(films, { planDays = [], planTime = "20:00", start = new Date(), days = 28 } = {}) {
  const daySet = new Set(planDays);
  const [hh, mm] = String(planTime || "20:00").split(":").map(Number);
  const hour = Number.isFinite(hh) ? hh : 20; // 0 (midnight) is a valid hour
  const minute = Number.isFinite(mm) ? mm : 0;
  const plan = [];
  let next = 0;
  for (let d = 0; d < days && next < films.length; d++) {
    const slot = new Date(start);
    slot.setDate(slot.getDate() + d);
    if (!daySet.has(slot.getDay())) continue;
    slot.setHours(hour, minute, 0, 0);
    if (slot < start) continue;
    plan.push({ film: films[next++], start: slot });
  }
  return plan;
}

export const planEventTitle = (film) => `Watch: ${film.title}${film.year ? ` (${film.year})` : ""}`;
