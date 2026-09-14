import type { createClient } from '@/lib/supabase-server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const j = await r.json()
  return j.access_token ?? null
}

export async function getGoogleToken(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: p } = await supabase
    .from('profiles')
    .select('google_access_token, google_refresh_token, google_token_expires_at, google_calendar_connected')
    .eq('id', userId).single()

  if (!p?.google_calendar_connected || !p.google_access_token) return null

  const expired = p.google_token_expires_at
    ? new Date(p.google_token_expires_at) < new Date(Date.now() + 60_000)
    : false

  if (!expired) return p.google_access_token
  if (!p.google_refresh_token) return null

  const fresh = await refreshGoogleToken(p.google_refresh_token)
  if (!fresh) return null

  await supabase.from('profiles').update({
    google_access_token: fresh,
    google_token_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  }).eq('id', userId)

  return fresh
}

function headerVal(headers: { name: string; value: string }[], name: string) {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

export interface GmailMessage {
  id: string
  subject: string
  from: string
  date: string
  snippet: string
  labelIds: string[]
}

export async function fetchGmailMessages(token: string, maxResults = 20): Promise<GmailMessage[]> {
  const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
  const auth = { Authorization: `Bearer ${token}` }

  const listResp = await fetch(`${BASE}/messages?q=is:unread&maxResults=${maxResults}`, { headers: auth })
  if (!listResp.ok) {
    if (listResp.status === 403) throw new Error('GMAIL_SCOPE_MISSING')
    if (listResp.status === 401) throw new Error('GMAIL_TOKEN_INVALID')
    throw new Error(`GMAIL_API_${listResp.status}`)
  }

  const { messages = [] } = await listResp.json()

  const details = await Promise.all(
    (messages as { id: string }[]).map(async ({ id }) => {
      const r = await fetch(
        `${BASE}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: auth }
      )
      if (!r.ok) return null
      const m = await r.json()
      const headers: { name: string; value: string }[] = m.payload?.headers ?? []
      return {
        id,
        subject: headerVal(headers, 'Subject') || '(geen onderwerp)',
        from: headerVal(headers, 'From'),
        date: headerVal(headers, 'Date'),
        snippet: (m.snippet ?? '').slice(0, 300),
        labelIds: m.labelIds ?? [],
      } as GmailMessage
    })
  )

  return details.filter((d): d is GmailMessage => d !== null)
}
