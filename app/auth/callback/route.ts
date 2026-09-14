import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', origin))
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.session) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  const { provider_token, provider_refresh_token, user } = data.session

  // Store Google Calendar tokens if this was a Google OAuth login
  if (provider_token) {
    await supabase.from('profiles').update({
      google_access_token: provider_token,
      google_refresh_token: provider_refresh_token ?? null,
      google_token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      google_calendar_connected: true,
    }).eq('id', user.id)
  }

  return NextResponse.redirect(new URL(next, origin))
}
