import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// After a build, list every file in dist and write the list (plus a fingerprint of
// the build) into dist/sw.js, so the service worker can store the whole app and
// work offline, including screens that load on demand.
function offlineManifest() {
  let outDir = 'dist'
  const walk = (dir, base = '') =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name), `${base}${e.name}/`) : [`${base}${e.name}`]
    )
  return {
    name: 'horrorhub-offline-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js')
      if (!fs.existsSync(swPath)) return
      const files = walk(outDir).filter((f) => f !== 'sw.js' && !f.endsWith('.map')).sort()
      const hash = crypto.createHash('sha1')
      for (const f of files) hash.update(f).update(fs.readFileSync(path.join(outDir, f)))
      const build = hash.digest('hex').slice(0, 12)
      const sw = fs
        .readFileSync(swPath, 'utf8')
        .replace('"__BUILD__"', JSON.stringify(build))
        .replace('/*__PRECACHE__*/[]', JSON.stringify(['./', ...files]))
      fs.writeFileSync(swPath, sw)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Served from the site root by default. On GitHub Pages the app lives under /<repo>/, so the
  // deploy workflow sets BASE_PATH (see .github/workflows/deploy.yml).
  base: process.env.BASE_PATH || '/',
  plugins: [react(), offlineManifest()],
  test: {
    setupFiles: ["./src/test/setup.js"],
    // Tests run in a timezone west of UTC on purpose: that is where date bugs (the previous
    // evening) show up. Override with TZ=... to try others.
    env: { TZ: process.env.TZ || "America/Los_Angeles" },
  },
})
