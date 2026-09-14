import { describe, it, expect, afterEach, vi } from 'vitest'
import { toLocalISODate, todayLocal, mondayOfWeek, addDays } from '@/lib/dates'

afterEach(() => vi.useRealTimers())

describe('toLocalISODate', () => {
  it('formatteert een datum als YYYY-MM-DD', () => {
    expect(toLocalISODate(new Date(2026, 7, 9, 12, 0))).toBe('2026-08-09')
  })

  it('vult maand en dag aan met een nul', () => {
    expect(toLocalISODate(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05')
  })

  it('houdt de LOKALE dag aan, ook net na middernacht (waar toISOString misgaat)', () => {
    // 9 aug 00:30 lokaal — in UTC+2 is dat 8 aug 22:30 UTC
    const justAfterMidnight = new Date(2026, 7, 9, 0, 30)
    expect(toLocalISODate(justAfterMidnight)).toBe('2026-08-09')
    // dit is precies het geval waarin de oude aanpak een dag terugviel:
    if (justAfterMidnight.getTimezoneOffset() < 0) {
      expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2026-08-08')
    }
  })

  it('klopt ook laat op de avond', () => {
    expect(toLocalISODate(new Date(2026, 7, 9, 23, 59))).toBe('2026-08-09')
  })
})

describe('todayLocal', () => {
  it('geeft de lokale datum van nu', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 9, 1, 15))
    expect(todayLocal()).toBe('2026-08-09')
  })
})

describe('mondayOfWeek', () => {
  it('geeft maandag terug voor elke dag van die week', () => {
    // 2026-08-09 is een zondag, 2026-08-03 de maandag ervoor
    expect(toLocalISODate(mondayOfWeek(new Date(2026, 7, 9, 12, 0)))).toBe('2026-08-03')  // zo
    expect(toLocalISODate(mondayOfWeek(new Date(2026, 7, 3, 12, 0)))).toBe('2026-08-03')  // ma
    expect(toLocalISODate(mondayOfWeek(new Date(2026, 7, 6, 12, 0)))).toBe('2026-08-03')  // do
  })

  it('werkt over een maandgrens heen', () => {
    // 2026-09-01 is een dinsdag → maandag 31 aug
    expect(toLocalISODate(mondayOfWeek(new Date(2026, 8, 1, 12, 0)))).toBe('2026-08-31')
  })

  it('gaat net na middernacht niet naar de verkeerde week', () => {
    expect(toLocalISODate(mondayOfWeek(new Date(2026, 7, 3, 0, 5)))).toBe('2026-08-03')
  })
})

describe('addDays', () => {
  it('telt dagen op en trekt ze af', () => {
    expect(addDays('2026-08-09', 1)).toBe('2026-08-10')
    expect(addDays('2026-08-09', -1)).toBe('2026-08-08')
    expect(addDays('2026-08-09', 7)).toBe('2026-08-16')
  })

  it('rolt netjes over maand- en jaargrenzen', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
})
