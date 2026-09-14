// Tablet-rondgang: iPad portrait (768x1024) en landscape (1024x768)
import { chromium } from 'playwright-core'

async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel, headless: true }) } catch { /* volgende */ }
  }
  throw new Error('geen browser')
}

const browser = await launch()

for (const [naam, w, h] of [['portrait', 768, 1024], ['landscape', 1024, 768]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true })
  await page.goto('http://localhost:3000/api/dev-login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const zap = () => page.evaluate(() => document.querySelector('nextjs-portal')?.remove())
  await zap()

  for (const [label, slug] of [['Dag','dag'], ['Week','week'], ['Tasks','taken'], ['Projects','projecten'], ['Maand','maand']]) {
    await zap()
    // desktop-topbar tabs hebben title "<Naam> — Alt+N"
    await page.locator(`button[title^="${label} "]`).first().click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `visual-review/t-${naam}-${slug}.png` })
  }

  // project-modal
  await zap()
  await page.locator('button[title^="Projects "]').first().click()
  await page.waitForTimeout(500)
  await page.locator('[draggable="true"]').first().click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `visual-review/t-${naam}-projectmodal.png` })
  await page.keyboard.press('Escape')
  await page.close()
}

console.log('✓ tablet-screenshots gemaakt')
await browser.close()
