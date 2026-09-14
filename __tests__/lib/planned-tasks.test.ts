import { describe, it, expect } from 'vitest'
import { plannedTaskDates, formatPlannedDate } from '@/lib/planned-tasks'
import type { WeekItem } from '@/lib/types'

function item(id: number, date: string, task_id: string | null, done = false): WeekItem {
  return { id, user_id: 'u', date, type: 'task', text: 'x', done, proj_id: null, task_id, recur_id: null, created_at: '' }
}

describe('plannedTaskDates', () => {
  const today = '2026-09-11'

  it('neemt open items van vandaag en later mee', () => {
    const map = plannedTaskDates([item(1, '2026-09-11', '10'), item(2, '2026-09-14', '11')], today)
    expect(map.get(10)).toBe('2026-09-11')
    expect(map.get(11)).toBe('2026-09-14')
  })

  it('negeert afgevinkte items, dagen die voorbij zijn en items zonder taak', () => {
    const map = plannedTaskDates([
      item(1, '2026-09-14', '10', true),
      item(2, '2026-09-10', '11'),
      item(3, '2026-09-14', null),
    ], today)
    expect(map.size).toBe(0)
  })

  it('kiest de eerstvolgende dag als een taak vaker in de week staat', () => {
    const map = plannedTaskDates([item(1, '2026-09-17', '10'), item(2, '2026-09-15', '10')], today)
    expect(map.get(10)).toBe('2026-09-15')
  })
})

describe('formatPlannedDate', () => {
  it('toont korte dag, dag van de maand en maand', () => {
    expect(formatPlannedDate('2026-09-15')).toBe('di 15 sep')
  })
})
