// Eénmalige herclassificatie: het oude 'meerjaren'-bucket (goals.horizon) is
// gesplitst in vier zichtbare periodes ('2-4jr','5-9jr','10jr+','ooit') —
// zie lib/goal-horizons.ts. horizon is een vrij text-veld (geen DB check
// constraint), dus dit is puur een data-update, geen schema-migratie.
//
// Regel: geen deadline → 'ooit' (letterlijk niet ingepland = someday/misschien).
// Wel deadline → jaren-vooruit = max(2, deadlineJaar - huidigJaar) — de vloer
// van 2 zorgt dat een 'meerjaren'-doel nooit terugvalt in 'jaar' of korter,
// ook niet als de deadline inmiddels dichterbij is dan ooit bedoeld.
//   2-4 jaar  → '2-4jr'
//   5-9 jaar  → '5-9jr'
//   10+ jaar  → '10jr+'
import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])
)
const dbUrl = env.SUPABASE_DB_URL
const m = dbUrl.match(/^postgres(?:ql)?:\/\/([^:@/]+):(.*)@([^:@/]+):(\d+)\/(\w+)/)
const [, urlUser, urlPass, host, port, database] = m
const client = new pg.Client({ host, port: Number(port), user: urlUser, database, password: env.SUPABASE_DB_PASSWORD ?? urlPass, ssl: { rejectUnauthorized: false } })

function nieuweHorizon(deadline, vandaag) {
  if (!deadline) return 'ooit'
  const jarenVooruit = Math.max(2, deadline.getUTCFullYear() - vandaag.getUTCFullYear())
  if (jarenVooruit <= 4) return '2-4jr'
  if (jarenVooruit <= 9) return '5-9jr'
  return '10jr+'
}

const apply = process.argv.includes('--apply')

await client.connect()
const vandaag = new Date()
const { rows } = await client.query(`select id, text, deadline from goals where horizon = 'meerjaren' order by deadline nulls last`)

console.log(`${rows.length} doelen met horizon 'meerjaren' gevonden.${apply ? '' : '  (dry run — geef --apply mee om echt te schrijven)'}\n`)
for (const row of rows) {
  const deadline = row.deadline ? new Date(row.deadline) : null
  const horizon = nieuweHorizon(deadline, vandaag)
  if (apply) await client.query(`update goals set horizon = $1 where id = $2`, [horizon, row.id])
  const deadlineStr = deadline ? deadline.toISOString().slice(0, 10) : '(geen deadline)'
  console.log(`#${row.id} → ${horizon.padEnd(6)} — ${deadlineStr.padEnd(12)} — ${row.text}`)
}

console.log(apply ? `\n✓ ${rows.length} doelen bijgewerkt.` : `\n(niets geschreven — dry run)`)
console.log('Let op: #60 "Fysiek voel ik me topfit" heeft geen deadline en is dus naar \'ooit\' gezet —')
console.log('dat is een lopend/ongedateerd doel, geen "misschien"-doel. Zet zelf een deadline of horizon als \'ooit\' niet klopt.')

await client.end()
