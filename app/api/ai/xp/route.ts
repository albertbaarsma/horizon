import { NextRequest, NextResponse } from 'next/server'
import { getBearerToken, getUserIdFromToken } from '@/lib/ai-api-auth'
import { getXpStatus } from '@/lib/ai-tools'

// GET /api/ai/xp — huidige XP-status, level en skills per levensgebied
export async function GET(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  try {
    return NextResponse.json(await getXpStatus(userId))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
