import { describe, it, expect } from 'vitest'
import { eventDate, eventTimeBlock } from '@/lib/calendar-time'

describe('eventTimeBlock', () => {
  it('geeft de begintijd in Nederlandse tijd', () => {
    expect(eventTimeBlock({ dateTime: '2026-09-15T13:20:00+02:00' })).toBe('13:20')
  })

  it('rekent een andere tijdzone om naar Nederlandse tijd', () => {
    expect(eventTimeBlock({ dateTime: '2026-09-16T08:00:00Z' })).toBe('10:00')
  })

  it('houdt rekening met wintertijd', () => {
    expect(eventTimeBlock({ dateTime: '2026-12-01T09:00:00Z' })).toBe('10:00')
  })

  it('geeft null bij een hele-dag-event', () => {
    expect(eventTimeBlock({ date: '2026-09-18' })).toBeNull()
  })

  it('geeft null zonder start of bij een ongeldige tijd', () => {
    expect(eventTimeBlock(undefined)).toBeNull()
    expect(eventTimeBlock({ dateTime: 'geen-tijd' })).toBeNull()
  })
})

describe('eventDate', () => {
  it('neemt de datum van een hele-dag-event over', () => {
    expect(eventDate({ date: '2026-09-18' })).toBe('2026-09-18')
  })

  it('geeft de Nederlandse dag, ook als het in UTC nog de vorige dag is', () => {
    expect(eventDate({ dateTime: '2026-09-14T23:30:00Z' })).toBe('2026-09-15')
  })

  it('geeft null zonder start', () => {
    expect(eventDate(undefined)).toBeNull()
  })
})
