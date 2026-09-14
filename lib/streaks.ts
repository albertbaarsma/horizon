import type { RecurringTask, WeekItem } from './types'

// Streak = aantal aaneengesloten geplande dagen (volgens rt.days) waarop de
// herhaaltaak is afgerond, terugtellend vanaf vandaag. Vandaag-nog-niet-gedaan
// breekt de streak niet; een gemiste geplande dag vóór vandaag wel.
export function computeStreak(rt: RecurringTask, today: string, weekItems: WeekItem[]): number {
  // Let op: filteren op w.done, niet op enkel het bestáán van de rij — sinds
  // herhalingen eager gematerialiseerd worden (lib/recurring.ts) bestaat er
  // altijd een rij op een geplande dag, ook als hij nog niet is afgevinkt.
  const doneDates = new Set(weekItems.filter(w => w.recur_id === rt.id && w.done).map(w => w.date))
  const DAY_EN_LIST = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  let streak = 0
  const d = new Date(today + 'T12:00:00')
  for (let i = 0; i < 366; i++) {
    const dateStr = d.toISOString().slice(0, 10)
    const dayName = DAY_EN_LIST[d.getDay()]
    if (rt.days.includes(dayName)) {
      if (doneDates.has(dateStr)) {
        streak++
      } else if (dateStr < today) {
        break  // gemiste geplande dag
      }
      // vandaag nog niet gedaan: nog niet breken
    }
    d.setDate(d.getDate() - 1)
  }
  return streak
}
