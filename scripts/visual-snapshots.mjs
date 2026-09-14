// Visuele review: maakt screenshots van elke dashboard-tab.
// Gebruik:  node scripts/visual-snapshots.mjs   (dev-server moet draaien op :3000)
// Output:   visual-review/<tab>.png (+ mobiel van de dagtab)
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const OUT  = 'visual-review'

// Alt+N tab-volgorde in de app
const TABS = ['dag', 'week', 'maand', 'projecten', 'taken', 'doelen', 'achievements', 'inzicht', 'visie']

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel, headless: true }) } catch { /* volgende */ }
  }
  throw new Error('Geen Edge of Chrome gevonden voor playwright-core')
}

mkdirSync(OUT, { recursive: true })
const browser = await launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

// Inloggen via de dev-login route (zet auth-cookies en redirect naar /dashboard)
await page.goto(`${BASE}/api/dev-login`, { waitUntil: 'networkidle' })
if (!page.url().includes('/dashboard')) {
  console.error('Dev-login mislukt — draait de dev-server op :3000?')
  await browser.close()
  process.exit(1)
}
await page.waitForTimeout(1500)

for (let i = 0; i < TABS.length; i++) {
  await page.keyboard.press(`Alt+${i + 1}`)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/${String(i + 1).padStart(2, '0')}-${TABS[i]}.png` })
  console.log(`✓ ${TABS[i]}`)
}

// Mobiele weergave van de dagtab
await page.setViewportSize({ width: 390, height: 844 })
await page.keyboard.press('Alt+1')
await page.waitForTimeout(900)
await page.screenshot({ path: `${OUT}/10-dag-mobiel.png` })
console.log('✓ dag (mobiel)')

await browser.close()
console.log(`\nKlaar — screenshots in ${OUT}/`)
