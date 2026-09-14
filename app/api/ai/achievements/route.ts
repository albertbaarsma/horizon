import { NextRequest, NextResponse } from 'next/server'
import { getBearerToken, getUserIdFromToken } from '@/lib/ai-api-auth'
import { listAchievements, addAchievement, deleteAchievement } from '@/lib/ai-tools'

// GET /api/ai/achievements?limit=20
export async function GET(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50')
    return NextResponse.json(await listAchievements(userId, limit))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST /api/ai/achievements — add a new achievement
export async function POST(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const body = await req.json()
  if (!body.text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  try {
    return NextResponse.json(await addAchievement(userId, body))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE /api/ai/achievements?id=123
export async function DELETE(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    return NextResponse.json(await deleteAchievement(userId, id))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
