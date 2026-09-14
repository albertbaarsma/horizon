import { NextRequest, NextResponse } from 'next/server'
import { adminClient, getBearerToken, getUserIdFromToken } from '@/lib/ai-api-auth'

// GET /api/ai/mood?days=14 — recente stemmingsregistraties (standaard 14 dagen)
export async function GET(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '14')
  const from = new Date()
  from.setDate(from.getDate() - (Number.isFinite(days) ? days : 14))

  const { data, error } = await adminClient()
    .from('mood_entries')
    .select('date, mood, energy, sleep_hours, note, source')
    .eq('user_id', userId)
    .gte('date', from.toISOString().slice(0, 10))
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/ai/mood  { mood, date?, energy?, sleep_hours?, note? }
// Eén meting per dag: opnieuw invullen voor dezelfde datum werkt de bestaande dag bij.
export async function POST(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const body = await req.json()
  const mood = Math.round(Number(body.mood))
  if (!Number.isFinite(mood) || mood < -10 || mood > 10)
    return NextResponse.json({ error: 'mood must be a number between -10 and 10' }, { status: 400 })

  const row: Record<string, unknown> = {
    user_id: userId, mood,
    date: body.date ?? new Date().toISOString().slice(0, 10),
  }
  if (body.energy !== undefined)      row.energy = Math.max(1, Math.min(5, Math.round(Number(body.energy))))
  if (body.sleep_hours !== undefined) row.sleep_hours = Math.max(0, Math.min(24, Number(body.sleep_hours)))
  if (body.note !== undefined)        row.note = String(body.note)

  const { data, error } = await adminClient()
    .from('mood_entries')
    .upsert(row, { onConflict: 'user_id,date' })
    .select('date, mood, energy, sleep_hours, note')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
