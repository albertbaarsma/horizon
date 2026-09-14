import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: p } = await supabase
    .from('profiles')
    .select('google_calendar_connected, google_access_token, google_refresh_token, google_token_expires_at')
    .eq('id', user.id).single()

  const profileStatus = {
    connected: p?.google_calendar_connected ?? false,
    hasToken: !!p?.google_access_token,
    tokenExpiry: p?.google_token_expires_at ?? null,
    tokenExpired: p?.google_token_expires_at
      ? new Date(p.google_token_expires_at) < new Date(Date.now() + 60_000)
      : true,
    hasRefreshToken: !!p?.google_refresh_token,
  }

  if (!profileStatus.hasToken) {
    return NextResponse.json({ profileStatus, gmailTest: null, verdict: 'NO_TOKEN_IN_DB' })
  }

  // Test Gmail API call with the stored token
  const token = p!.google_access_token
  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${token}` },
  })

  const gmailTest = {
    status: resp.status,
    ok: resp.ok,
    body: resp.ok ? await resp.json() : await resp.text(),
  }

  let verdict = 'OK'
  if (!resp.ok) {
    if (resp.status === 403) verdict = 'GMAIL_API_NOT_ENABLED_OR_SCOPE_MISSING'
    else if (resp.status === 401) verdict = 'TOKEN_INVALID_OR_EXPIRED'
    else verdict = `GMAIL_ERROR_${resp.status}`
  }

  return NextResponse.json({ profileStatus, gmailTest, verdict })
}
