import { describe, it, expect } from 'vitest'
import { computeMissingOccurrences } from '@/lib/recurring'
import type { RecurringTask, WeekItem } from '@/lib/types'

// 2026-07-14 is een dinsdag
const TODAY = '2026-07-14'

function makeRecur(overrides: Partial<RecurringTask> = {}): RecurringTask {
  return {
    id: 1, user_id: 'uid', name: 'Sporten', type: 'sport', days: ['tuesday'],
    cat_id: null, proj_id: null, active: true, created_at: '',
    ...overrides,
  }
}

function makeItem(overrides: Partial<WeekItem> = {}): WeekItem {
  return {
    id: 1, user_id: 'uid', date: TODAY, type: 'sport', text: 'Sporten',
    done: false, proj_id: null, task_id: null, recur_id: 1, created_at: '',
    ...overrides,
  }
}

describe('computeMissingOccurrences', () => {
  it('creates an occurrence on today if today matches the pattern and nothing exists yet', () => {
    const out = computeMissingOccurrences([makeRecur()], [], TODAY, 1)
    expect(out).toEqual([{ date: TODAY, type: 'sport', text: 'Sporten', proj_id: null, recur_id: 1 }])
  })

  it('skips a date where a row already exists for that pattern', () => {
    const out = computeMissingOccurrences([makeRecur()], [makeItem({ date: TODAY })], TODAY, 1)
    expect(out).toEqual([])
  })

  it('skips a date the pattern does not run on', () => {
    const out = computeMissingOccurrences([makeRecur({ days: ['monday'] })], [], TODAY, 1)
    expect(out).toEqual([])
  })

  it('ignores inactive patterns', () => {
    const out = computeMissingOccurrences([makeRecur({ active: false })], [], TODAY, 1)
    expect(out).toEqual([])
  })

  it('respects skip_dates even when no row exists yet', () => {
    const out = computeMissingOccurrences([makeRecur({ skip_dates: [TODAY] })], [], TODAY, 1)
    expect(out).toEqual([])
  })

  it('does not recreate an occurrence that was moved to a different day this week (moved_from)', () => {
    // De rij staat nu op woensdag, maar moved_from onthoudt dat dinsdag al "gedaan" is voor deze week
    const moved = makeItem({ date: '2026-07-15', moved_from: TODAY })
    const out = computeMissingOccurrences([makeRecur()], [moved], TODAY, 1)
    expect(out).toEqual([])
  })

  it('walks forward across multiple days, one occurrence per matching weekday', () => {
    // dinsdag (TODAY) en de dinsdag erna, 8 dagen verderop
    const out = computeMissingOccurrences([makeRecur()], [], TODAY, 9)
    expect(out.map(o => o.date)).toEqual([TODAY, '2026-07-21'])
  })

  it('handles multiple active patterns independently', () => {
    const a = makeRecur({ id: 1, name: 'Sporten', days: ['tuesday'] })
    const b = makeRecur({ id: 2, name: 'Pianoles', days: ['tuesday'], proj_id: 'muziek' })
    const out = computeMissingOccurrences([a, b], [], TODAY, 1)
    expect(out).toHaveLength(2)
    expect(out.find(o => o.recur_id === 2)).toEqual({ date: TODAY, type: 'sport', text: 'Pianoles', proj_id: 'muziek', recur_id: 2 })
  })

  it('returns nothing for an empty pattern list', () => {
    expect(computeMissingOccurrences([], [makeItem()], TODAY, 30)).toEqual([])
  })
})
