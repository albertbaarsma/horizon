import { describe, it, expect } from 'vitest'
import { moodMeta, entryForDate, lastDays, summarize, describePattern, sortByDateDesc } from '@/lib/mood'
import type { MoodEntry } from '@/lib/types'

function m(date: string, mood: number, extra: Partial<MoodEntry> = {}): MoodEntry {
  return { id: Math.random(), user_id: 'u', date, mood, created_at: '', ...extra }
}

describe('moodMeta', () => {
  it('geeft label en emoji per stand, over de volle -10..+10 breedte', () => {
    expect(moodMeta(-10).label).toBe('Zwaar omlaag')
    expect(moodMeta(0).label).toBe('Neutraal')
    expect(moodMeta(10).label).toBe('Heel hoog')
  })

  it('gebruikt geen klinische termen in de labels', () => {
    const labels = [-10, -7, -3, -1, 0, 2, 6, 10].map(v => moodMeta(v).label)
    expect(labels.join(' ')).not.toMatch(/manisch|depressie|manie/i)
  })

  it('rondt af en begrenst buiten de schaal', () => {
    expect(moodMeta(1.4)).toBe(moodMeta(1))
    expect(moodMeta(-99)).toBe(moodMeta(-10))
    expect(moodMeta(99)).toBe(moodMeta(10))
  })
})

describe('sortByDateDesc / entryForDate', () => {
  it('sorteert nieuw → oud', () => {
    const sorted = sortByDateDesc([m('2026-08-01', 0), m('2026-08-05', 1), m('2026-08-03', -1)])
    expect(sorted.map(e => e.date)).toEqual(['2026-08-05', '2026-08-03', '2026-08-01'])
  })

  it('vindt de entry van een dag', () => {
    expect(entryForDate([m('2026-08-05', 2)], '2026-08-05')?.mood).toBe(2)
    expect(entryForDate([m('2026-08-05', 2)], '2026-08-06')).toBeUndefined()
  })
})

describe('lastDays', () => {
  it('pakt alleen de dagen binnen het venster', () => {
    const entries = [m('2026-08-07', 1), m('2026-08-05', 0), m('2026-08-01', -1)]
    const week = lastDays(entries, 7, '2026-08-07')
    expect(week.map(e => e.date)).toEqual(['2026-08-07', '2026-08-05', '2026-08-01'])
    const three = lastDays(entries, 3, '2026-08-07')
    expect(three.map(e => e.date)).toEqual(['2026-08-07', '2026-08-05'])
  })

  it('negeert toekomstige datums', () => {
    const entries = [m('2026-08-09', 3), m('2026-08-07', 0)]
    expect(lastDays(entries, 7, '2026-08-07').map(e => e.date)).toEqual(['2026-08-07'])
  })
})

describe('summarize', () => {
  it('rekent gemiddelden uit over stemming, energie en slaap', () => {
    const s = summarize([
      m('2026-08-03', 2, { energy: 4, sleep_hours: 8 }),
      m('2026-08-02', 0, { energy: 2, sleep_hours: 6 }),
    ])
    expect(s.count).toBe(2)
    expect(s.avgMood).toBe(1)
    expect(s.avgEnergy).toBe(3)
    expect(s.avgSleep).toBe(7)
    expect(s.minSleep).toBe(6)
    expect(s.maxSleep).toBe(8)
  })

  it('telt opeenvolgende lage dagen vanaf de meest recente', () => {
    const s = summarize([
      m('2026-08-05', -2), m('2026-08-04', -3), m('2026-08-03', -2), m('2026-08-02', 0),
    ])
    expect(s.lowStreak).toBe(3)
    expect(s.highStreak).toBe(0)
  })

  it('telt opeenvolgende hoge dagen', () => {
    const s = summarize([m('2026-08-05', 3), m('2026-08-04', 2), m('2026-08-03', 0)])
    expect(s.highStreak).toBe(2)
    expect(s.lowStreak).toBe(0)
  })

  it('breekt de reeks af bij een dag die er niet bij past', () => {
    const s = summarize([m('2026-08-05', 0), m('2026-08-04', -3), m('2026-08-03', -3)])
    expect(s.lowStreak).toBe(0)   // meest recente dag is niet laag
  })

  it('berekent een trend tussen de laatste 3 en de 3 daarvoor', () => {
    const s = summarize([
      m('2026-08-06', 2), m('2026-08-05', 2), m('2026-08-04', 2),
      m('2026-08-03', 0), m('2026-08-02', 0), m('2026-08-01', 0),
    ])
    expect(s.trend).toBe(2)
  })

  it('laat velden leeg als er niets is ingevuld', () => {
    const s = summarize([])
    expect(s.count).toBe(0)
    expect(s.avgMood).toBeNull()
    expect(s.avgSleep).toBeNull()
    expect(s.trend).toBeNull()
  })

  it('negeert ontbrekende energie/slaap zonder de gemiddelden te verpesten', () => {
    const s = summarize([m('2026-08-02', 1, { sleep_hours: 7 }), m('2026-08-01', 1)])
    expect(s.avgSleep).toBe(7)      // alleen de ingevulde nacht
    expect(s.avgEnergy).toBeNull()
  })
})

describe('describePattern', () => {
  it('beschrijft alleen wat er staat, zonder diagnose of advies', () => {
    const lines = describePattern(summarize([
      m('2026-08-05', -2, { sleep_hours: 4 }), m('2026-08-04', -3, { sleep_hours: 5 }), m('2026-08-03', -2, { sleep_hours: 6 }),
    ]))
    const text = lines.join(' ')
    expect(text).toContain('3 dagen op rij laag ingevuld')
    expect(text).toContain('Kortste nacht: 4 uur')
    // geen diagnostische of adviserende taal
    expect(text).not.toMatch(/manisch|depressie|diagnose|je moet|neem .* medicat/i)
  })

  it('meldt niets bijzonders bij korte reeksen', () => {
    const lines = describePattern(summarize([m('2026-08-05', -2), m('2026-08-04', 0)]))
    expect(lines.join(' ')).not.toContain('op rij')
  })

  it('geeft een duidelijke melding als er nog niets is ingevuld', () => {
    expect(describePattern(summarize([]))).toEqual(['Nog niets ingevuld.'])
  })
})
