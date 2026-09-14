// Screenshots van mobiele weergave: bottom-nav, meldingen, Meer-paneel
import { chromium } from 'playwright-core'

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel, headless: true }) } catch { /* volgende */ }
  }
  throw new Error('geen browser')
}

const browser = await launch()
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
await page.goto('http://localhost:3000/api/dev-login', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// 1. Dashboard met meldingen + bottom-nav
await page.screenshot({ path: 'visual-review/mobiel-dashboard.png' })

// 2. Meer-paneel open
await page.getByRole('button', { name: 'Meer tabs en acties' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: 'visual-review/mobiel-meer-paneel.png' })

console.log('✓ screenshots gemaakt')
await browser.close()
