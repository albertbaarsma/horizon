// Google Calendar geeft een begintijd als ISO-string met offset
// ("2026-09-15T13:20:00+02:00"), of alleen een datum bij een hele-dag-event.
// We rekenen altijd om naar Nederlandse tijd: een event dat in een andere
// tijdzone is aangemaakt, moet hier toch op het juiste uur en de juiste dag staan.

const TZ = 'Europe/Amsterdam'

export interface CalendarEventStart {
  date?: string
  dateTime?: string
}

function amsterdamParts(iso: string): { date: string; time: string } | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

/** De dag (YYYY-MM-DD) waarop het event in Nederland begint. */
export function eventDate(start: CalendarEventStart | undefined): string | null {
  if (!start) return null
  if (start.date) return start.date
  if (start.dateTime) return amsterdamParts(start.dateTime)?.date ?? null
  return null
}

/** Begintijd HH:MM in Nederlandse tijd, of null bij een hele-dag-event. */
export function eventTimeBlock(start: CalendarEventStart | undefined): string | null {
  if (!start?.dateTime) return null
  return amsterdamParts(start.dateTime)?.time ?? null
}
