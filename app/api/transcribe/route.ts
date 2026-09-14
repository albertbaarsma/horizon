import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!checkRateLimit(user.id, 20)) return NextResponse.json({ error: 'Te veel verzoeken. Even wachten.' }, { status: 429 })

  const form = await req.formData()
  const file = form.get('audio') as File | null
  if (!file) return NextResponse.json({ error: 'Geen audiobestand' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles').select('ai_token').eq('id', user.id).single()
  const apiKey = profile?.ai_token || process.env.GROQ_API_KEY

  const groqForm = new FormData()
  groqForm.append('file', file)
  groqForm.append('model', 'whisper-large-v3-turbo')
  groqForm.append('language', 'nl')
  groqForm.append('response_format', 'json')

  const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: groqForm,
  })

  if (!resp.ok) {
    const e = await resp.text()
    return NextResponse.json({ error: `Transcriptie mislukt: ${e}` }, { status: 500 })
  }

  const data = await resp.json()
  return NextResponse.json({ text: data.text ?? '' })
}
