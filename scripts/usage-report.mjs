// ─── Weekrapport gebruik ──────────────────────────────────────────────────────
// Leest de meting uit usage_events en schrijft er een leesbaar rapport van. Dit
// is het bestand dat je aan de AI geeft ("hier, verbeter de app hiermee"), en
// dat een geplande taak wekelijks kan neerzetten.
//
//   node scripts/usage-report.mjs              → op het scherm
//   node scripts/usage-report.mjs --out FILE   → naar een bestand
//   node scripts/usage-report.mjs --days 30    → alleen de laatste 30 dagen
import fs from 'fs'
import path from 'path'
import pg from 'pg'
import { execFileSync } from 'child_process'

const args = process.argv.slice(2)
const arg = (naam, standaard) => {
  const i = args.indexOf(naam)
  return i >= 0 && args[i + 1] ? args[i + 1] : standaard
}
const DAGEN = Number(arg('--days', '0'))
const UIT = arg('--out', null)
const ROOT = 'D:/projects/horizon'

// lib/usage-report.ts is TypeScript; even omzetten naar iets dat node kan lezen
const tmp = path.join(ROOT, '.usage-report.mjs')
execFileSync('npx', ['esbuild', 'lib/usage-report.ts', '--bundle', '--format=esm',
  `--outfile=${tmp}`, '--log-level=error', '--alias:@=.'], { cwd: ROOT, shell: true })

const env = {}
for (const l of fs.readFileSync(`${ROOT}/.env.local`, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const m = env.SUPABASE_DB_URL.match(/^postgres(?:ql)?:\/\/([^:@/]+):(.*)@([^:@/]+):(\d+)\/(\w+)/)
const db = new pg.Client({ host: m[3], port: Number(m[4]), user: m[1], database: m[5],
  password: env.SUPABASE_DB_PASSWORD ?? m[2], ssl: { rejectUnauthorized: false } })
await db.connect()

const waar = DAGEN > 0 ? `where created_at > now() - interval '${DAGEN} days'` : ''
const rows = (await db.query(`select kind, target, seconds, created_at from usage_events ${waar} order by created_at`)).rows
await db.end()

const { buildReport, reportAsText } = await import(`file:///${tmp.replace(/\\/g, '/')}`)
const events = rows.map(r => ({ ...r, created_at: new Date(r.created_at).toISOString() }))
const rapport = buildReport(events, new Date())
const tekst = reportAsText(rapport)

fs.rmSync(tmp, { force: true })

if (UIT) {
  fs.writeFileSync(UIT, tekst + '\n', 'utf8')
  console.log(`Rapport geschreven naar ${UIT} (${events.length} regels)`)
} else {
  console.log(tekst)
}
