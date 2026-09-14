// ─── Standaardweergave op Projecten, 19 augustus 2026 ────────────────────────
import fs from 'fs'
import pg from 'pg'

const FIX = process.argv.includes('--fix')
const UID = '0f94db83-d9ad-40f2-b8b0-631202af7d0e'

const env = {}
for (const l of fs.readFileSync('D:/projects/horizon/.env.local', 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const m = env.SUPABASE_DB_URL.match(/^postgres(?:ql)?:\/\/([^:@/]+):(.*)@([^:@/]+):(\d+)\/(\w+)/)
const db = new pg.Client({ host: m[3], port: Number(m[4]), user: m[1], database: m[5],
  password: env.SUPABASE_DB_PASSWORD ?? m[2], ssl: { rejectUnauthorized: false } })
await db.connect()

const huidig = (await db.query('select start_tab from profiles where id=$1', [UID])).rows[0]
console.log(`start_tab: ${huidig?.start_tab ?? '(niet gezet, dus "week")'} → projects`)
if (FIX) {
  await db.query(`update profiles set start_tab='projects' where id=$1`, [UID])
  console.log('bijgewerkt')
} else {
  console.log('(alleen tonen — draai met --fix om weg te schrijven)')
}
await db.end()
