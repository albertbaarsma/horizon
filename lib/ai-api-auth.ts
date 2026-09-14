import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Gedeelde auth-laag voor de externe AI REST API (app/api/ai/*) — token uit
// profiles.ai_token, service-role client (bypasst RLS zelf, filtert handmatig
// op user_id). Bestond al losstaand gekopieerd in elke route; hier gedeeld
// zodat nieuwe routes 'm niet opnieuw hoeven te schrijven.

export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export async function getUserIdFromToken(token: string): Promise<string | null> {
  const { data } = await adminClient()
    .from('profiles')
    .select('id')
    .eq('ai_token', token)
    .single()
  return data?.id ?? null
}
