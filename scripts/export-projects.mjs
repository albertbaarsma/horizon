// Dump projectdata als JSON (voor de drive-koppeling routine).
// Gebruik: node scripts/export-projects.mjs [proj_id proj_id ...]  (geen args = alle)
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
let q = supabase.from('projects').select('id, name, emoji, status, description, vision, notes').order('name')
const ids = process.argv.slice(2)
if (ids.length) q = q.in('id', ids)
const { data, error } = await q
if (error) { console.error(error.message); process.exit(1) }
console.log(JSON.stringify(data, null, 1))
