import { NextRequest, NextResponse } from 'next/server'
import { adminClient, getBearerToken, getUserIdFromToken } from '@/lib/ai-api-auth'

// GET /api/ai/projects — levensgebieden + projecten, zodat een taak in de
// juiste categorie terechtkomt (proj_id bepaalt de categorie van een taak,
// er is geen los cat_id-veld op tasks). Alleen lezen.
export async function GET(req: NextRequest) {
  const token = getBearerToken(req)
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 })

  const userId = await getUserIdFromToken(token)
  if (!userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

  const supabase = adminClient()
  const [{ data: categories, error: catError }, { data: projects, error: projError }] = await Promise.all([
    supabase.from('categories').select('id, name').eq('user_id', userId).order('name'),
    supabase.from('projects').select('id, name, cat_id, status').eq('user_id', userId).order('name'),
  ])

  if (catError)  return NextResponse.json({ error: catError.message }, { status: 500 })
  if (projError) return NextResponse.json({ error: projError.message }, { status: 500 })

  return NextResponse.json({ categories: categories ?? [], projects: projects ?? [] })
}
