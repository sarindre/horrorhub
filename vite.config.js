import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ["./src/test/setup.js"],
    // Tests run in a timezone west of UTC on purpose: that is where date bugs (the previous
    // evening) show up. Override with TZ=... to try others.
    env: { TZ: process.env.TZ || "America/Los_Angeles" },
  },
})
