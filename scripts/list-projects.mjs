// Hulpscript: toon alle projecten (id, naam) — gebruikt door de drive-koppeling routine.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await supabase.from('projects').select('id, name, emoji').order('name')
if (error) { console.error(error.message); process.exit(1) }
for (const p of data) console.log(`${p.id}\t${p.emoji} ${p.name}`)
