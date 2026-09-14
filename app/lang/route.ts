// ─── Taalvoorkeur wisselen ──────────────────────────────────────────────────
// Zet het `aos_lang`-cookie en stuurt terug naar de pagina waar vandaan
// geklikt is. Een gewone GET-link, geen JavaScript nodig — past bij de
// landingspagina's die bewust server components zonder JS zijn.

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const to = searchParams.get('to') === 'nl' ? 'nl' : 'en'
  const gevraagdPad = searchParams.get('path') ?? '/'
  // Alleen relatieve paden toestaan, anders is dit een open redirect
  const pad = gevraagdPad.startsWith('/') && !gevraagdPad.startsWith('//') ? gevraagdPad : '/'

  const res = NextResponse.redirect(new URL(pad, req.url))
  res.cookies.set('aos_lang', to, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return res
}
