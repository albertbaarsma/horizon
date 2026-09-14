// Eenmalige reparatie: XP en prestaties van weggegooide doelen opruimen.
// Draai met --fix om het echt weg te schrijven; zonder vlag alleen tonen.
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

const totaalVoor = (await client.query(`select coalesce(sum(amount),0)::int as xp from xp_events`)).rows[0].xp

// XP van doelen die in de prullenbak zitten of niet meer bestaan
const scheef = (await client.query(`
  select e.id, e.amount, e.reason, e.ref_id
  from xp_events e
  where e.source = 'goal'
    and (not exists (select 1 from goals g where g.id::text = e.ref_id)
         or exists (select 1 from goals g where g.id::text = e.ref_id and g.deleted_at is not null))
  order by e.id`)).rows

console.log(`XP-totaal nu: ${totaalVoor}`)
console.log(`\nXP van weggegooide/verdwenen doelen: ${scheef.length} stuks, ${scheef.reduce((s, r) => s + r.amount, 0)} XP`)
scheef.forEach(r => console.log(`  xp#${r.id}  +${r.amount}  ${r.reason}`))

// Prestaties die bij een weggegooid doel horen (koppeling via de tekst)
const LABEL = { nu: 'Focusdoel', wk: 'Weekdoel', '6w': 'Zesweken-doel', kwartaal: 'Kwartaaldoel', jaar: 'Jaardoel' }
const weg = (await client.query(`select * from goals where deleted_at is not null`)).rows
const teksten = weg.map(g => `${LABEL[g.horizon]} gehaald: ${g.text}`)
const achWeg = teksten.length
  ? (await client.query(`select id, text from achievements where text = any($1)`, [teksten])).rows
  : []
console.log(`\nPrestaties van weggegooide doelen: ${achWeg.length}`)
achWeg.forEach(a => console.log(`  ach#${a.id} "${a.text}"`))

if (!FIX) { console.log('\n(alleen tonen — draai met --fix om op te ruimen)'); await client.end(); process.exit(0) }

if (scheef.length) await client.query(`delete from xp_events where id = any($1)`, [scheef.map(r => r.id)])
if (achWeg.length) {
  await client.query(`delete from xp_events where source = 'achievement' and ref_id = any($1)`, [achWeg.map(a => String(a.id))])
  await client.query(`delete from achievements where id = any($1)`, [achWeg.map(a => a.id)])
}

const totaalNa = (await client.query(`select coalesce(sum(amount),0)::int as xp from xp_events`)).rows[0].xp
console.log(`\nOpgeruimd. XP-totaal: ${totaalVoor} → ${totaalNa} (${totaalNa - totaalVoor})`)
await client.end()
