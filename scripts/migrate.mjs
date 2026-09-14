// Past een .sql-migratie toe op de Supabase-database via de directe Postgres-verbinding.
// Vereist SUPABASE_DB_URL in .env.local (Supabase → Project Settings → Database → Connection string).
// Gebruik:  node scripts/migrate.mjs supabase/xp-system.sql
import { readFileSync } from 'node:fs'
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

const file = process.argv[2]
if (!file) { console.error('Gebruik: node scripts/migrate.mjs <pad-naar-.sql>'); process.exit(1) }

// Host/poort/gebruiker/db uit de URL halen (die bevatten geen speciale tekens).
// Het wachtwoord komt bij voorkeur uit SUPABASE_DB_PASSWORD (letterlijk, geen URL-encoding nodig);
// anders het wachtwoord uit de URL (greedy tot de laatste @, dus @ in het wachtwoord mag).
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

const sql = readFileSync(file, 'utf8')

try {
  await client.connect()
  const res = await client.query(sql)
  const cmds = Array.isArray(res) ? res.map(r => r.command).filter(Boolean).join(', ') : res.command
  console.log(`✓ ${file} toegepast${cmds ? ` — ${cmds}` : ''}`)
} catch (e) {
  console.error(`✗ Migratie mislukt: ${e.message}`)
  if (e.code === '28P01') {
    console.error('  → Wachtwoord geweigerd. Controleer: (1) gebruik je het DATABASE-wachtwoord (niet je Supabase-login)?')
    console.error('    (2) staan er speciale tekens in die percent-encoded moeten worden? Simpelste fix: reset het DB-wachtwoord naar alleen letters/cijfers.')
  }
  process.exitCode = 1
} finally {
  await client.end().catch(() => {})
}
