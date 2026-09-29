import { describe, expect, it } from "vitest";

describe("test environment", () => {
  it("runs in the timezone configured in vite.config.js", () => {
    // Guards the config: if this drifts back to the machine's own zone, date bugs that only
    // show up west of UTC stop being caught.
    expect(process.env.TZ).toBeTruthy();
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(process.env.TZ);
  });

  it("defaults to a zone west of UTC", () => {
    if (process.env.TZ !== "America/Los_Angeles") return; // someone chose another zone on purpose
    expect(new Date(2025, 9, 15, 12).getTimezoneOffset()).toBe(420); // PDT, UTC-7
    expect(new Date("2025-10-15").getDate()).toBe(14); // the trap this configuration exists to expose
  });
});
