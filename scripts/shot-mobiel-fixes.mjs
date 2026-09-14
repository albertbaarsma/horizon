// Verificatie van de 3 mobiele fixes: urgent-balk, kanban-swipe, project-modal
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
const zapOverlay = () => page.evaluate(() => document.querySelector('nextjs-portal')?.remove())
await zapOverlay()

// 1. Urgent-balk (1 regel op Dag-tab)
await page.getByRole('button', { name: 'Dag', exact: true }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: 'visual-review/fix-urgentbalk.png' })

// 2. Kanban swipe
await zapOverlay()
await page.getByRole('button', { name: 'Taken', exact: true }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: 'visual-review/fix-kanban.png' })

// 3. Project-modal header
await zapOverlay()
await page.getByRole('button', { name: 'Projecten', exact: true }).click()
await page.waitForTimeout(500)
await page.locator('[draggable="true"]').first().click()
await page.waitForTimeout(600)
await page.screenshot({ path: 'visual-review/fix-projectmodal.png' })

console.log('✓ fix-screenshots gemaakt')
await browser.close()
