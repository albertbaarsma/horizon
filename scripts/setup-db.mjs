// Provisions a fresh Supabase database for Horizon: applies supabase/schema.sql,
// then every migration in supabase/*.sql and db/*.sql, in filename order.
//
// Requires SUPABASE_DB_URL in .env.local (Supabase → Project Settings →
// Database → Connection string). Run this once, right after creating a new
// Supabase project and before starting the app.
//
// Usage:  node scripts/setup-db.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')])
)

const dbUrl = env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('✗ SUPABASE_DB_URL ontbreekt in .env.local.')
  console.error('  Haal de "Connection string" (URI) op via Supabase → Project Settings → Database.')
  process.exit(1)
}

const m = dbUrl.match(/^postgres(?:ql)?:\/\/([^:@/]+):(.*)@([^:@/]+):(\d+)\/(\w+)/)
if (!m) { console.error('✗ Kon SUPABASE_DB_URL niet ontleden. Verwacht: postgresql://user:pass@host:port/db'); process.exit(1) }
const [, urlUser, urlPass, host, port, database] = m

const client = new pg.Client({
  host,
  port: Number(port),
  user: urlUser,
  database,
  password: env.SUPABASE_DB_PASSWORD ?? urlPass,
  ssl: { rejectUnauthorized: false },
})

// schema.sql first, then every other migration in supabase/ and db/, alphabetically.
// Most are idempotent ("if not exists"); a handful of older ones under db/ are not,
// which only matters if you run this script twice against the same database.
const files = [
  'supabase/schema.sql',
  ...readdirSync('supabase').filter(f => f.endsWith('.sql') && f !== 'schema.sql').sort().map(f => join('supabase', f)),
  ...readdirSync('db').filter(f => f.endsWith('.sql')).sort().map(f => join('db', f)),
]

let ok = 0, skipped = 0, failed = 0

try {
  await client.connect()
  for (const file of files) {
    const sql = readFileSync(file, 'utf8')
    try {
      await client.query(sql)
      console.log(`✓ ${file}`)
      ok++
    } catch (e) {
      // "already exists" is expected if you re-run this against a database
      // that already has some migrations applied — not a real failure.
      if (/already exists/i.test(e.message)) {
        console.log(`· ${file} — al toegepast (overgeslagen)`)
        skipped++
      } else {
        console.error(`✗ ${file} — ${e.message}`)
        failed++
      }
    }
  }
} catch (e) {
  console.error(`✗ Kon geen verbinding maken: ${e.message}`)
  if (e.code === '28P01') {
    console.error('  → Wachtwoord geweigerd. Controleer: (1) gebruik je het DATABASE-wachtwoord (niet je Supabase-login)?')
    console.error('    (2) staan er speciale tekens in die percent-encoded moeten worden? Simpelste fix: reset het DB-wachtwoord naar alleen letters/cijfers.')
  }
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}

console.log(`\n${ok} toegepast, ${skipped} overgeslagen, ${failed} mislukt (van ${files.length}).`)
if (failed > 0) {
  console.error('Los de mislukte bestanden hierboven één voor één op met: node scripts/migrate.mjs <bestand>')
  process.exitCode = 1
}
