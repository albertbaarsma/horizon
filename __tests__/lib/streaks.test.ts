import { describe, it, expect } from 'vitest'
import { computeStreak } from '@/lib/streaks'
import type { RecurringTask, WeekItem } from '@/lib/types'

// 2026-07-14 is een dinsdag
const TODAY = '2026-07-14'

function makeRecur(days: string[], overrides: Partial<RecurringTask> = {}): RecurringTask {
  return {
    id: 1, user_id: 'uid', name: 'Sporten', type: 'sport', days,
    cat_id: null, proj_id: null, active: true, created_at: '',
    ...overrides,
  }
}

function doneOn(dates: string[], recurId = 1): WeekItem[] {
  return dates.map((date, i) => ({
    id: i + 1, user_id: 'uid', date, type: 'sport' as const, text: 'Sporten',
    done: true, proj_id: null, task_id: null, recur_id: recurId, created_at: '',
  }))
}

describe('computeStreak', () => {
  it('returns 0 when the task was never completed', () => {
    expect(computeStreak(makeRecur(['tuesday']), TODAY, [])).toBe(0)
  })

  it('counts consecutive completed scheduled days', () => {
    const items = doneOn(['2026-07-14', '2026-07-07', '2026-06-30'])
    expect(computeStreak(makeRecur(['tuesday']), TODAY, items)).toBe(3)
  })

  it('does not break when today is scheduled but not yet done', () => {
    const items = doneOn(['2026-07-07', '2026-06-30'])
    expect(computeStreak(makeRecur(['tuesday']), TODAY, items)).toBe(2)
  })

  it('breaks on a missed scheduled day in the past', () => {
    // 7/14 gedaan, 7/7 gemist, 6/30 gedaan → streak stopt op 1
    const items = doneOn(['2026-07-14', '2026-06-30'])
    expect(computeStreak(makeRecur(['tuesday']), TODAY, items)).toBe(1)
  })

  it('skips non-scheduled days when walking back', () => {
    // ma+wo schema: ma 7/13 ✓, wo 7/8 ✓, ma 7/6 ✓, wo 7/1 gemist → 3
    const items = doneOn(['2026-07-13', '2026-07-08', '2026-07-06'])
    expect(computeStreak(makeRecur(['monday', 'wednesday']), TODAY, items)).toBe(3)
  })

  it('only counts completions of the matching recurring task', () => {
    const otherTask = doneOn(['2026-07-14', '2026-07-07'], 99)
    expect(computeStreak(makeRecur(['tuesday']), TODAY, otherTask)).toBe(0)
  })

  it('handles a daily schedule', () => {
    const items = doneOn(['2026-07-14', '2026-07-13', '2026-07-12', '2026-07-11', '2026-07-10'])
    const daily = makeRecur(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'])
    expect(computeStreak(daily, TODAY, items)).toBe(5)
  })

  it('returns 0 for an empty days array', () => {
    const items = doneOn(['2026-07-14'])
    expect(computeStreak(makeRecur([]), TODAY, items)).toBe(0)
  })

  // Sinds herhalingen eager gematerialiseerd worden (lib/recurring.ts) bestaat
  // er altijd een rij op een geplande dag, ook vóórdat hij is afgevinkt — het
  // bestaan van de rij mag de streak dus niet ophogen, alleen done:true telt.
  it('does not count a materialized-but-not-yet-done row as a completion', () => {
    const notDoneYet: WeekItem = {
      id: 99, user_id: 'uid', date: '2026-07-07', type: 'sport', text: 'Sporten',
      done: false, proj_id: null, task_id: null, recur_id: 1, created_at: '',
    }
    const items = [...doneOn(['2026-07-14']), notDoneYet]
    // 7/14 (vandaag) gedaan, 7/7 wél gematerialiseerd maar niet afgevinkt → telt als gemist, streak stopt op 1
    expect(computeStreak(makeRecur(['tuesday']), TODAY, items)).toBe(1)
  })
})
