import { NextRequest, NextResponse } from 'next/server'
import { getBearerToken, getUserIdFromToken } from '@/lib/ai-api-auth'
import { listWeekItems, addWeekItem, updateWeekItem, deleteWeekItem } from '@/lib/ai-tools'

// GET /api/ai/week-items?from=2026-07-11&to=2026-07-18
export async function GET(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  try {
    const from = req.nextUrl.searchParams.get('from') ?? undefined
    const to = req.nextUrl.searchParams.get('to') ?? undefined
    return NextResponse.json(await listWeekItems(userId, from, to))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST /api/ai/week-items  { date, text, type?, time_block?, task_id? }
export async function POST(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const body = await req.json()
  try {
    return NextResponse.json(await addWeekItem(userId, body), { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg.includes('required') || msg.includes('time_block') ? 400 : 500 })
  }
}

// PATCH /api/ai/week-items?id=123  { text?, done?, date?, type?, task_id?, time_block? }
export async function PATCH(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  try {
    return NextResponse.json(await updateWeekItem(userId, id, body))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg.includes('No fields') || msg.includes('time_block') ? 400 : 500 })
  }
}

// DELETE /api/ai/week-items?id=123
export async function DELETE(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    return NextResponse.json(await deleteWeekItem(userId, id))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
