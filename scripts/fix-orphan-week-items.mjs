// Reparatie: planningsitems die naar een verwijderde herhaaltaak wijzen.
// De verwijzing wordt losgekoppeld (recur_id → null); het item zelf blijft
// staan, inclusief of het afgevinkt was. Draai met --fix om weg te schrijven.
import fs from 'fs'
import pg from 'pg'

const FIX = process.argv.includes('--fix')
const env = {}
for (const line of fs.readFileSync('D:/projects/horizon/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const m = env.SUPABASE_DB_URL.match(/^postgres(?:ql)?:\/\/([^:@/]+):(.*)@([^:@/]+):(\d+)\/(\w+)/)
const client = new pg.Client({
  host: m[3], port: Number(m[4]), user: m[1], database: m[5],
  password: env.SUPABASE_DB_PASSWORD ?? m[2], ssl: { rejectUnauthorized: false },
})
await client.connect()

const los = (await client.query(`
  select w.id, w.text, w.date, w.done, w.recur_id
  from week_items w
  where w.recur_id is not null
    and not exists (select 1 from recurring_tasks r where r.id = w.recur_id)
  order by w.id`)).rows

console.log(`Planningsitems met een verdwenen herhaaltaak: ${los.length}`)
los.forEach(w => console.log(`  #${w.id} "${w.text}" (${String(w.date).slice(0, 10)}${w.done ? ', afgevinkt' : ''}) → herhaaltaak ${w.recur_id}`))

if (!los.length) { await client.end(); process.exit(0) }
if (!FIX) { console.log('\n(alleen tonen — draai met --fix om los te koppelen)'); await client.end(); process.exit(0) }

await client.query(`update week_items set recur_id = null where id = any($1)`, [los.map(w => w.id)])
console.log(`\nLosgekoppeld: ${los.length} items blijven staan als gewone planning.`)
await client.end()
