import { dayKey, parseDay } from "../../lib/dates.js";

// A date input that works in local calendar days. `value` and `onChange` deal in Date
// objects (local midnight). The input's "YYYY-MM-DD" text is never handed to the Date
// constructor, which would read it as UTC and land on the previous day west of UTC.
export function DateField({ value, onChange, className = "", ...rest }) {
  return (
    <input
      type="date"
      value={dayKey(value)}
      onChange={(e) => {
        if (e.target.value) onChange?.(parseDay(e.target.value)); // empty while the user is typing
      }}
      className={"rounded-xl border px-3 py-2 text-sm " + className}
      {...rest}
    />
  );
}
