// Volledige mobiele rondgang: alle tabs + menu's + modals
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

const shot = (n) => page.screenshot({ path: `visual-review/m-${n}.png` })
// Next.js dev-overlay (N-knopje) ligt over de bottom-nav en blokkeert kliks
const zapOverlay = () => page.evaluate(() => document.querySelector('nextjs-portal')?.remove())
await zapOverlay()

// Hoofdtabs via bottom-nav
for (const tab of ['Dag', 'Week', 'Taken', 'Projecten']) {
  await zapOverlay()
  await page.getByRole('button', { name: tab, exact: true }).click()
  await page.waitForTimeout(600)
  await shot(`tab-${tab.toLowerCase()}`)
}

// Meer-tabs
for (const [label, naam] of [['Maand','maand'], ['Doelen','doelen'], ['Wins','wins'], ['Inzicht','inzicht'], ['Visie','visie'], ['Mail','mail']]) {
  await zapOverlay()
  await page.getByRole('button', { name: 'Meer tabs en acties' }).click()
  await page.waitForTimeout(350)
  await page.getByRole('button', { name: label }).last().click()
  await page.waitForTimeout(700)
  await shot(`tab-${naam}`)
}

// Sidebar
await page.locator('button', { hasText: '☰' }).first().click()
await page.waitForTimeout(400)
await shot('sidebar')
await page.keyboard.press('Escape')
await page.mouse.click(340, 400) // backdrop
await page.waitForTimeout(300)

// Projectdetail
await page.getByRole('button', { name: 'Projecten', exact: true }).click()
await page.waitForTimeout(500)
await page.locator('[draggable="true"]').first().click()
await page.waitForTimeout(500)
await shot('project-modal')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// Jarvis open
await page.locator('button[title*="Horizon AI"], button[aria-label*="Jarvis"], button[aria-label*="AI"]').last().click().catch(() => {})
await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-jarvis')))
await page.waitForTimeout(600)
await shot('jarvis')

console.log('✓ alle screenshots gemaakt')
await browser.close()
