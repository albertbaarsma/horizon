import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateLifeReport, type ReportKind } from '@/lib/report-generator'

// Vercel Cron triggert dit wekelijks (kind=week) en maandelijks (kind=month) —
// zie vercel.json. Alleen aanroepbaar met het geheim dat Vercel automatisch
// meestuurt (CRON_SECRET), dus geen gebruikerssessie nodig: draait met de
// service-role key en genereert een rapport per profiel.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const kind = req.nextUrl.searchParams.get('kind')
  if (kind !== 'week' && kind !== 'month') return NextResponse.json({ error: 'Ongeldig type' }, { status: 400 })

  const fallbackKey = process.env.ANTHROPIC_API_KEY
  if (!fallbackKey) return NextResponse.json({ error: 'Geen ANTHROPIC_API_KEY geconfigureerd' }, { status: 500 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: profiles } = await admin.from('profiles').select('id, ai_api_key')
  const results: Record<string, string> = {}
  for (const p of (profiles ?? []) as { id: string; ai_api_key: string | null }[]) {
    const apiKey = p.ai_api_key || fallbackKey
    const result = await generateLifeReport(admin, p.id, kind as ReportKind, apiKey)
    results[p.id] = 'error' in result ? `error: ${result.error}` : 'ok'
  }

  return NextResponse.json({ kind, results })
}
