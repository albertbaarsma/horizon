// ─── Datums ───────────────────────────────────────────────────────────────────
// toISOString() rekent in UTC. Wie een Date lokaal opbouwt (setDate/getDay) en
// dan met toISOString().slice(0,10) formatteert, krijgt tussen middernacht en
// de UTC-offset (in NL 's zomers 2 uur) de VERKEERDE dag terug. Dat is precies
// het moment waarop je nog aan het werk bent, dus formatteer altijd lokaal.

/** YYYY-MM-DD van een Date, in de lokale tijdzone (niet UTC). */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Vandaag als YYYY-MM-DD, lokaal. */
export function todayLocal(): string {
  return toLocalISODate(new Date())
}

/** De maandag van de week waarin `d` valt (ma = begin van de week). */
export function mondayOfWeek(d: Date): Date {
  const out = new Date(d)
  out.setHours(12, 0, 0, 0)   // middaguur: immuun voor zomertijd-sprongen
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7))
  return out
}

/** Datum n dagen na `date` (YYYY-MM-DD in, YYYY-MM-DD uit). */
export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return toLocalISODate(d)
}
