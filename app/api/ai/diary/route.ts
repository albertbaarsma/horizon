import { NextRequest, NextResponse } from 'next/server'
import { adminClient, getBearerToken, getUserIdFromToken } from '@/lib/ai-api-auth'

// GET /api/ai/diary?limit=20 — recente dagboekregels
export async function GET(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20')

  const { data, error } = await adminClient()
    .from('diary_entries')
    .select('id, date, text')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .limit(Number.isFinite(limit) ? limit : 20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/ai/diary  { text, date? }
export async function POST(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const body = await req.json()
  const text = String(body.text ?? '').trim()
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const { data, error } = await adminClient()
    .from('diary_entries')
    .insert({ user_id: userId, text, date: body.date ?? new Date().toISOString().slice(0, 10) })
    .select('id, date, text')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
