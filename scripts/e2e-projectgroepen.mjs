// Tijdelijke e2e-test: sub-project uit groep slepen naar GEDAAN + "Alles klaar".
// Maakt wegwerpdata aan, test, verifieert in DB, ruimt op.
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── Wegwerpdata ───────────────────────────────────────────────────────────────
setTimeout(() => { console.error('✗ TIMEOUT — script na 120s afgebroken'); process.exit(1) }, 120000).unref?.()
const { data: any1 } = await db.from('projects').select('user_id').limit(1).single()
const uid = any1.user_id
await db.from('projects').delete().in('id', ['zz-testgroep', 'zz-sub1', 'zz-sub2'])
await db.from('projects').insert([
  { id:'zz-testgroep', user_id:uid, cat_id:'persoonlijk', name:'ZZ Testgroep', emoji:'🧪', status:'actief', proj_type:'project', description:'tijdelijk', vision:'', notes:null, html_content:null, is_priority:false, sort_order:998 },
  { id:'zz-sub1', user_id:uid, cat_id:'persoonlijk', name:'ZZ Sub Een', emoji:'1️⃣', status:'actief', proj_type:'project', parent_id:'zz-testgroep', description:'', vision:'', notes:null, html_content:null, is_priority:false, sort_order:998 },
  { id:'zz-sub2', user_id:uid, cat_id:'persoonlijk', name:'ZZ Sub Twee', emoji:'2️⃣', status:'actief', proj_type:'project', parent_id:'zz-testgroep', description:'', vision:'', notes:null, html_content:null, is_priority:false, sort_order:998 },
])
console.log('✓ wegwerpdata aangemaakt')

// ── Browser ───────────────────────────────────────────────────────────────────
async function launch() {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel, headless: true, timeout: 30000 }) } catch { /* volgende */ }
  }
  throw new Error('geen browser')
}
const browser = await launch()
console.log('· browser gestart')
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.setDefaultTimeout(20000)
await page.goto('http://localhost:3000/api/dev-login', { waitUntil: 'domcontentloaded', timeout: 60000 })
console.log('· ingelogd:', page.url())
await page.waitForTimeout(2500)
await page.getByRole('button', { name: /Projecten/ }).first().click()
console.log('· projecten-tab open')
await page.waitForTimeout(800)

// Groep uitklappen
await page.locator('[draggable="true"]', { hasText: 'ZZ Testgroep' }).first().click()
console.log('· groep uitgeklapt')
await page.waitForTimeout(400)

// Test 1: sub1 naar GEDAAN / ARCHIEF slepen (synthetische events — Playwright's
// dragTo hangt op HTML5-dnd in headless Chromium)
await page.evaluate(() => {
  const src = [...document.querySelectorAll('[draggable="true"]')].find(el => el.getAttribute('title')?.startsWith('ZZ Sub Een'))
  src.dispatchEvent(new DragEvent('dragstart', { bubbles: true }))
})
await page.waitForTimeout(300)   // React verwerkt dragSubId-state
await page.evaluate(() => {
  const labels = [...document.querySelectorAll('div')]
    .filter(el => (el.textContent ?? '').trim().startsWith('✅ Gedaan / archief'))
  const label = labels[labels.length - 1]           // kleinste/diepste match
  const wrapper = label.parentElement               // sectie-div met onDrop
  wrapper.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true }))
  wrapper.dispatchEvent(new DragEvent('drop',     { bubbles: true, cancelable: true }))
})
await page.waitForTimeout(1000)
const { data: s1 } = await db.from('projects').select('parent_id, status').eq('id', 'zz-sub1').single()
console.log(s1.parent_id === null && s1.status === 'archief'
  ? '✓ Test 1: sub uit groep gesleept naar GEDAAN — losgemaakt + archief'
  : `✗ Test 1 FAALT: parent_id=${s1.parent_id}, status=${s1.status}`)

// Test 2: "✓ Alles klaar" op de groep
await page.getByRole('button', { name: '✓ Alles klaar' }).first().click()
await page.waitForTimeout(800)
const { data: rest } = await db.from('projects').select('id, status, parent_id').in('id', ['zz-testgroep', 'zz-sub2'])
const ok2 = rest.every(r => r.status === 'archief')
console.log(ok2
  ? '✓ Test 2: hele groep (hoofd + sub) naar archief via Alles klaar'
  : `✗ Test 2 FAALT: ${JSON.stringify(rest)}`)

await page.screenshot({ path: 'visual-review/subdrag-test.png' })
await browser.close()

// ── Opruimen ──────────────────────────────────────────────────────────────────
await db.from('projects').delete().in('id', ['zz-testgroep', 'zz-sub1', 'zz-sub2'])
console.log('✓ wegwerpdata opgeruimd')
