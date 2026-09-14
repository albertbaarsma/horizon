import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// ICS subscription endpoint — subscribe this URL in Google Calendar for read-only sync
// URL: /api/calendar/ics  (authenticated via session cookie)
// For public URL: /api/calendar/ics?uid=<user_id>  (less secure, personal use only)

const DAY_EN = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

function toICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

function toICSDateTime(dateStr: string): string {
  // Use noon UTC to avoid timezone boundary issues
  return `${dateStr.replace(/-/g, '')}T120000Z`
}

function escapeICS(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

const TYPE_EMOJI: Record<string, string> = {
  cal: '📅', sport: '💪', kids: '👧', urgent: '🔴', task: '○',
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Allow ?uid= param as fallback for calendar subscription (no cookie auth)
  const uid = req.nextUrl.searchParams.get('uid')
  const userId = user?.id ?? uid

  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // Fetch data
  const [
    { data: weekItems },
    { data: recurringTasks },
    { data: projects },
  ] = await Promise.all([
    supabase.from('week_items').select('*').eq('user_id', userId),
    supabase.from('recurring_tasks').select('*').eq('user_id', userId).eq('active', true),
    supabase.from('projects').select('id,name,emoji').eq('user_id', userId),
  ])

  const projMap = new Map((projects ?? []).map(p => [p.id, `${p.emoji} ${p.name.split('—')[0].trim()}`]))

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Horizon//Personal Dashboard//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Horizon',
    'X-WR-CALDESC:Weekplanning & doelen uit Horizon',
    'X-WR-TIMEZONE:Europe/Amsterdam',
  ]

  // ── One-off week items ──────────────────────────────────────────────────────
  for (const item of (weekItems ?? [])) {
    const emoji = TYPE_EMOJI[item.type] ?? '○'
    const summary = `${emoji} ${item.text}`
    const projLabel = item.proj_id ? (projMap.get(item.proj_id) ?? '') : ''
    const desc = [
      item.done ? '✅ Afgerond' : '○ Open',
      projLabel ? `Project: ${projLabel}` : '',
    ].filter(Boolean).join('\\n')

    const vevent = [
      'BEGIN:VEVENT',
      `UID:albert-os-week-${item.id}@personal`,
      `DTSTART;VALUE=DATE:${toICSDate(item.date)}`,
      `DTEND;VALUE=DATE:${toICSDate(item.date)}`,
      `SUMMARY:${escapeICS(summary)}`,
      desc ? `DESCRIPTION:${escapeICS(desc)}` : null,
      item.done ? 'STATUS:COMPLETED' : 'STATUS:NEEDS-ACTION',
      `CATEGORIES:${item.type.toUpperCase()}`,
      'END:VEVENT',
    ].filter((l): l is string => l !== null)
    lines.push(...vevent)
  }

  // ── Recurring tasks → expand for next 52 weeks ──────────────────────────────
  const today  = new Date()
  const cutoff = new Date(today); cutoff.setFullYear(today.getFullYear() + 1)

  for (const rt of (recurringTasks ?? [])) {
    const emoji = TYPE_EMOJI[rt.type] ?? '○'

    // Walk from today to cutoff, emit an event for each matching day
    const cur = new Date(today)
    while (cur <= cutoff) {
      const dayEn = DAY_EN[cur.getDay()]
      if (rt.days.includes(dayEn)) {
        const dateStr = cur.toISOString().slice(0, 10)
        // Skip if there's already a real week_item for this recur+date, or if this date was explicitly skipped
        const alreadyCovered = (weekItems ?? []).some(w => w.recur_id === rt.id && w.date === dateStr)
        const explicitlySkipped = rt.skip_dates?.includes(dateStr)
        if (!alreadyCovered && !explicitlySkipped) {
          lines.push(
            'BEGIN:VEVENT',
            `UID:albert-os-recur-${rt.id}-${dateStr}@personal`,
            `DTSTART;VALUE=DATE:${toICSDate(dateStr)}`,
            `DTEND;VALUE=DATE:${toICSDate(dateStr)}`,
            `SUMMARY:${escapeICS(`${emoji} ${rt.name}`)}`,
            'DESCRIPTION:↻ Herhaaltaak uit Horizon',
            'STATUS:NEEDS-ACTION',
            `CATEGORIES:${rt.type.toUpperCase()},RECURRING`,
            'END:VEVENT',
          )
        }
      }
      cur.setDate(cur.getDate() + 1)
    }
  }

  lines.push('END:VCALENDAR')

  const body = lines.join('\r\n')

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="albert-os.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  })
}
