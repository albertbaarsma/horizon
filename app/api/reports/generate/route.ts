import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { generateLifeReport, type ReportKind } from '@/lib/report-generator'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { kind } = await req.json() as { kind?: string }
  if (kind !== 'week' && kind !== 'month') return NextResponse.json({ error: 'Ongeldig type — gebruik "week" of "month"' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('ai_api_key').eq('id', user.id).single()
  const apiKey = (profile?.ai_api_key as string | null) || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Geen API key geconfigureerd' }, { status: 400 })

  const result = await generateLifeReport(supabase, user.id, kind as ReportKind, apiKey)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json({ report: result.report })
}
