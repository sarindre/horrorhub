const pad = (n) => String(n).padStart(2, "0");

function formatUTC(d) {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(
    dt.getUTCMinutes()
  )}00Z`;
}

// RFC 5545 TEXT escaping: backslash, semicolon, comma and newlines
export function escapeICSText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function createICS({ events }) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HorrorHub//EN"];
  events.forEach((e, i) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${i}-${Date.now()}@horrorhub`,
      `DTSTAMP:${formatUTC(new Date())}`,
      `DTSTART:${formatUTC(e.start)}`,
      e.end ? `DTEND:${formatUTC(e.end)}` : `DURATION:PT2H`,
      `SUMMARY:${escapeICSText(e.title || "Movie")}`,
      e.description ? `DESCRIPTION:${escapeICSText(e.description)}` : null,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.filter(Boolean).join("\r\n");
}
