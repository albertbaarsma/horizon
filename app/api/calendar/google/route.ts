import { createClient } from '@/lib/supabase-server'
import { getGoogleToken } from '@/lib/google-api'
import { isSameEvent } from '@/lib/calendar-dedupe'
import { eventDate, eventTimeBlock } from '@/lib/calendar-time'
import { NextRequest, NextResponse } from 'next/server'

// GET  → pull Google Calendar events for ±2 weeks into week_items (type: 'cal')
// POST → push a week_item to Google Calendar

// ── GET: pull Google Calendar → week_items ──────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await getGoogleToken(supabase, user.id)
  if (!token) return NextResponse.json({ error: 'Google Calendar not connected', connected: false }, { status: 400 })

  // Fetch events for ±2 weeks
  const from = new Date(); from.setDate(from.getDate() - 14)
  const to   = new Date(); to.setDate(to.getDate() + 30)

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  url.searchParams.set('timeMin', from.toISOString())
  url.searchParams.set('timeMax', to.toISOString())
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '250')

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!resp.ok) {
    const err = await resp.json()
    return NextResponse.json({ error: err.error?.message ?? 'Calendar API error' }, { status: resp.status })
  }

  const calData = await resp.json()
  const events: { date: string; summary: string; gcal_id: string; time_block: string | null }[] = []

  for (const ev of (calData.items ?? [])) {
    const dateStr = eventDate(ev.start)
    if (!dateStr) continue
    events.push({ date: dateStr, summary: ev.summary ?? '(Geen titel)', gcal_id: ev.id, time_block: eventTimeBlock(ev.start) })
  }

  // Fetch ALL existing items in the sync window in one query — manual tasks
  // count as duplicates too ("🎹 Pianoles Mio 09:30" vs gcal "Pianoles Mio")
  const fromStr = from.toISOString().slice(0, 10)
  const toStr   = to.toISOString().slice(0, 10)
  const { data: existing } = await supabase
    .from('week_items')
    .select('id, date, text, time_block')
    .eq('user_id', user.id)
    .gte('date', fromStr)
    .lte('date', toStr)

  type Known = { id: number | null; text: string; time_block: string | null }
  const byDate = new Map<string, Known[]>()
  for (const r of existing ?? []) {
    const list = byDate.get(r.date) ?? []
    list.push({ id: r.id as number, text: r.text as string, time_block: (r.time_block as string | null) ?? null })
    byDate.set(r.date, list)
  }

  // Staat een event er al maar zonder tijd, dan krijgt het alsnog de begintijd
  // uit de agenda. Een tijd die al gezet is (bijvoorbeeld met de hand) blijft staan.
  const timeBackfill = new Map<number, string>()

  const toInsert = events.filter(ev => {
    const sameDay = byDate.get(ev.date) ?? []
    const match = sameDay.find(k => isSameEvent(k.text, ev.summary))
    if (match) {
      if (ev.time_block && match.id !== null && !match.time_block && !timeBackfill.has(match.id)) {
        timeBackfill.set(match.id, ev.time_block)
      }
      return false
    }
    // also dedupe within this batch (recurring events can repeat a summary)
    sameDay.push({ id: null, text: ev.summary, time_block: ev.time_block })
    byDate.set(ev.date, sameDay)
    return true
  })

  if (toInsert.length) {
    await supabase.from('week_items').insert(toInsert.map(ev => ({
      user_id:    user.id,
      date:       ev.date,
      type:       'cal',
      text:       ev.summary,
      done:       false,
      proj_id:    null,
      recur_id:   null,
      time_block: ev.time_block,
    })))
  }

  if (timeBackfill.size) {
    await Promise.all([...timeBackfill].map(([id, time_block]) =>
      supabase.from('week_items').update({ time_block }).eq('id', id).eq('user_id', user.id)
    ))
  }

  return NextResponse.json({ synced: toInsert.length, timesAdded: timeBackfill.size, total: events.length, connected: true })
}

// ── POST: push a week_item to Google Calendar ───────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await getGoogleToken(supabase, user.id)
  if (!token) return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })

  const body = await req.json() as { date: string; summary: string; description?: string }

  const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: body.summary,
      description: body.description ?? '',
      start: { date: body.date },
      end:   { date: body.date },
    }),
  })

  if (!resp.ok) {
    const err = await resp.json()
    return NextResponse.json({ error: err.error?.message ?? 'Failed to create event' }, { status: resp.status })
  }

  const event = await resp.json()
  return NextResponse.json({ id: event.id, htmlLink: event.htmlLink })
}
