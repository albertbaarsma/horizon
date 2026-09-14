import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getGoogleToken, fetchGmailMessages } from '@/lib/google-api'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await getGoogleToken(supabase, user.id)
  if (!token) return NextResponse.json({ error: 'Google niet verbonden', connected: false }, { status: 400 })

  try {
    const messages = await fetchGmailMessages(token, 25)
    return NextResponse.json({ messages, connected: true })
  } catch (e) {
    const code = (e as Error).message
    if (code === 'GMAIL_SCOPE_MISSING')
      return NextResponse.json({ error: 'Gmail-scope niet toegestaan. Log opnieuw in met Google.', connected: false }, { status: 403 })
    if (code === 'GMAIL_TOKEN_INVALID')
      return NextResponse.json({ error: 'Google-token verlopen. Log opnieuw in.', connected: false }, { status: 401 })
    return NextResponse.json({ error: `Gmail-fout: ${code}`, connected: false }, { status: 500 })
  }
}
