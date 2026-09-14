import { describe, it, expect } from 'vitest'
import {
  horizonFromDeadline, deadlineForBucket, effectiveHorizon, resolveHorizonDrop,
  isDeadlinePostponed, withOriginalDeadline, DEADLINE_HORIZONS,
} from '@/lib/deadline-horizon'

const VANDAAG = '2026-09-06'

describe('horizonFromDeadline', () => {
  it('te laat telt als nu', () => {
    expect(horizonFromDeadline('2026-09-01', VANDAAG)).toBe('nu')
  })
  it('binnen 7 dagen is nu', () => {
    expect(horizonFromDeadline('2026-09-13', VANDAAG)).toBe('nu')   // +7 dagen
    expect(horizonFromDeadline('2026-09-14', VANDAAG)).toBe('6w')   // +8 dagen
  })
  it('binnen 6 weken (42 dagen) is 6w', () => {
    expect(horizonFromDeadline('2026-10-18', VANDAAG)).toBe('6w')   // +42 dagen
    expect(horizonFromDeadline('2026-10-19', VANDAAG)).toBe('kwartaal')   // +43 dagen
  })
  it('binnen 3 maanden (90 dagen) is kwartaal', () => {
    expect(horizonFromDeadline('2026-12-05', VANDAAG)).toBe('kwartaal')   // +90 dagen
    expect(horizonFromDeadline('2026-12-06', VANDAAG)).toBe('jaar')   // +91 dagen
  })
  it('binnen een jaar (365 dagen) is jaar', () => {
    expect(horizonFromDeadline('2027-09-06', VANDAAG)).toBe('jaar')   // +365 dagen
    expect(horizonFromDeadline('2027-09-07', VANDAAG)).toBe('2-4jr')   // +366 dagen
  })
  it('een deadline over enkele jaren valt in 2-4jr, niet plat in jaar', () => {
    // Bug gevonden 2026-09-06: doelen met een deadline over 3-12 jaar (heel
    // normaal voor bestaande 2-4jr/5-9jr/10jr+ doelen) werden allemaal "jaar".
    expect(horizonFromDeadline('2029-09-01', VANDAAG)).toBe('2-4jr')   // ~3 jaar
    expect(horizonFromDeadline('2033-09-01', VANDAAG)).toBe('5-9jr')   // ~7 jaar
    expect(horizonFromDeadline('2038-09-01', VANDAAG)).toBe('10jr+')   // ~12 jaar
  })
})

describe('deadlineForBucket', () => {
  it('geeft null voor ooit/doorlopend — die blijven altijd puur handmatig', () => {
    for (const h of ['doorlopend', 'ooit'] as const) {
      expect(deadlineForBucket(h, VANDAAG)).toBeNull()
    }
  })
  it('geeft voor elke deadline-horizon een datum die er ook echt in valt', () => {
    for (const h of DEADLINE_HORIZONS) {
      const datum = deadlineForBucket(h, VANDAAG)
      expect(datum).not.toBeNull()
      expect(horizonFromDeadline(datum!, VANDAAG)).toBe(h)
    }
  })
})

describe('effectiveHorizon', () => {
  it('gebruikt het handmatige horizon-veld als er geen deadline is', () => {
    expect(effectiveHorizon({ horizon: 'kwartaal', deadline: null }, VANDAAG)).toBe('kwartaal')
  })
  it('een deadline wint altijd van het opgeslagen horizon-veld', () => {
    expect(effectiveHorizon({ horizon: 'jaar', deadline: '2026-09-08' }, VANDAAG)).toBe('nu')
  })
  it('geen horizon en geen deadline geeft null (nog niet ingedeeld)', () => {
    expect(effectiveHorizon({ horizon: null, deadline: null }, VANDAAG)).toBeNull()
  })
})

describe('resolveHorizonDrop', () => {
  it('zonder deadline: alleen het horizon-veld wijzigt, ongewijzigd gedrag', () => {
    expect(resolveHorizonDrop({ horizon: 'kwartaal', deadline: null }, 'jaar', VANDAAG)).toEqual({ horizon: 'jaar' })
  })
  it('met deadline: slepen naar een deadline-horizon verschuift ook de deadline mee', () => {
    const result = resolveHorizonDrop({ horizon: 'nu', deadline: '2026-09-08' }, 'jaar', VANDAAG)
    expect(result.horizon).toBe('jaar')
    expect(result.deadline).not.toBeNull()
    expect(horizonFromDeadline(result.deadline!, VANDAAG)).toBe('jaar')
  })
  it('met deadline: slepen naar een lange-termijn-horizon verschuift de deadline ook mee', () => {
    const result = resolveHorizonDrop({ horizon: 'nu', deadline: '2026-09-08' }, '2-4jr', VANDAAG)
    expect(result.horizon).toBe('2-4jr')
    expect(result.deadline).not.toBeNull()
    expect(horizonFromDeadline(result.deadline!, VANDAAG)).toBe('2-4jr')
  })
  it('met deadline: slepen naar ooit/doorlopend maakt het weer los van de deadline', () => {
    const result = resolveHorizonDrop({ horizon: 'nu', deadline: '2026-09-08' }, 'ooit', VANDAAG)
    expect(result).toEqual({ horizon: 'ooit', deadline: null })
  })
})

describe('isDeadlinePostponed', () => {
  it('true als de deadline later is dan de oorspronkelijke', () => {
    expect(isDeadlinePostponed({ deadline: '2026-12-01', original_deadline: '2026-10-01' })).toBe(true)
  })
  it('false als de deadline vervroegd is', () => {
    expect(isDeadlinePostponed({ deadline: '2026-09-01', original_deadline: '2026-10-01' })).toBe(false)
  })
  it('false als de deadline gelijk is aan de oorspronkelijke', () => {
    expect(isDeadlinePostponed({ deadline: '2026-10-01', original_deadline: '2026-10-01' })).toBe(false)
  })
  it('false zonder oorspronkelijke deadline om mee te vergelijken', () => {
    expect(isDeadlinePostponed({ deadline: '2026-10-01', original_deadline: null })).toBe(false)
  })
})

describe('withOriginalDeadline', () => {
  it('zet original_deadline mee als er nog geen was (eerste keer)', () => {
    expect(withOriginalDeadline({ deadline: null, original_deadline: null }, '2026-10-01'))
      .toEqual({ deadline: '2026-10-01', original_deadline: '2026-10-01' })
  })
  it('laat original_deadline ongemoeid bij een latere wijziging', () => {
    expect(withOriginalDeadline({ deadline: '2026-10-01', original_deadline: '2026-10-01' }, '2026-12-01'))
      .toEqual({ deadline: '2026-12-01' })
  })
  it('laat original_deadline ongemoeid als de deadline gewist wordt', () => {
    expect(withOriginalDeadline({ deadline: '2026-10-01', original_deadline: '2026-10-01' }, null))
      .toEqual({ deadline: null })
  })
})
