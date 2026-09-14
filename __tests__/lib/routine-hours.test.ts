import { describe, it, expect } from 'vitest'
import {
  minutesFor, routinesOnDay, minutesPerDay, weekLoad,
  formatMinutes, formatHours, DEFAULT_DURATION_MIN,
} from '@/lib/routine-hours'
import type { RecurringTask } from '@/lib/types'

function rt(overrides: Partial<RecurringTask> = {}): RecurringTask {
  return {
    id: 1, user_id: 'u', name: 'Sport', type: 'sport',
    days: ['monday'], cat_id: null, proj_id: null, active: true,
    duration_min: 60, created_at: '',
    ...overrides,
  }
}

describe('minutesFor', () => {
  it('gebruikt de opgegeven duur', () => {
    expect(minutesFor(rt({ duration_min: 45 }))).toBe(45)
  })

  it('valt terug op de standaardduur als er geen duur is ingevuld', () => {
    expect(minutesFor(rt({ duration_min: null }))).toBe(DEFAULT_DURATION_MIN)
    expect(minutesFor(rt({ duration_min: undefined }))).toBe(DEFAULT_DURATION_MIN)
  })

  it('respecteert een duur van 0 (niet verwarren met "niet ingevuld")', () => {
    expect(minutesFor(rt({ duration_min: 0 }))).toBe(0)
  })
})

describe('routinesOnDay', () => {
  it('geeft alleen actieve taken van die dag', () => {
    const tasks = [
      rt({ id: 1, days: ['monday'] }),
      rt({ id: 2, days: ['tuesday'] }),
      rt({ id: 3, days: ['monday'], active: false }),
    ]
    expect(routinesOnDay(tasks, 'monday').map(t => t.id)).toEqual([1])
  })

  it('geeft een lege lijst voor een dag zonder routines', () => {
    expect(routinesOnDay([rt({ days: ['monday'] })], 'sunday')).toEqual([])
  })
})

describe('minutesPerDay', () => {
  it('telt meerdere routines op dezelfde dag bij elkaar op', () => {
    const tasks = [
      rt({ id: 1, days: ['monday'], duration_min: 60 }),
      rt({ id: 2, days: ['monday'], duration_min: 30 }),
    ]
    expect(minutesPerDay(tasks)[0]).toBe(90)
  })

  it('verdeelt een taak over al zijn dagen (ma→zo volgorde)', () => {
    const tasks = [rt({ days: ['monday', 'thursday'], duration_min: 45 })]
    expect(minutesPerDay(tasks)).toEqual([45, 0, 0, 45, 0, 0, 0])
  })

  it('negeert inactieve taken', () => {
    expect(minutesPerDay([rt({ active: false })])).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})

describe('weekLoad', () => {
  it('rekent totaal, budget en vrije tijd door', () => {
    // 2 routines: 4× 60 min (ma/di/wo/do) + 1× 30 min (za) = 270 min
    const tasks = [
      rt({ id: 1, days: ['monday','tuesday','wednesday','thursday'], duration_min: 60 }),
      rt({ id: 2, days: ['saturday'], duration_min: 30 }),
    ]
    const load = weekLoad(tasks, 16)
    expect(load.totalMin).toBe(270)
    expect(load.occurrences).toBe(5)
    expect(load.budgetMin).toBe(16 * 60 * 7)   // 6720
    expect(load.freeMin).toBe(6720 - 270)
    expect(load.pctBusy).toBe(4)               // 270/6720 ≈ 4%
  })

  it('vindt de drukste dag', () => {
    const tasks = [
      rt({ id: 1, days: ['wednesday'], duration_min: 120 }),
      rt({ id: 2, days: ['monday'], duration_min: 30 }),
    ]
    const load = weekLoad(tasks)
    expect(load.busiestDay).toEqual({ index: 2, min: 120 })  // 2 = woensdag
  })

  it('geeft negatieve vrije tijd bij overboeking (eerlijk, niet afgekapt)', () => {
    const tasks = [rt({ days: ['monday'], duration_min: 200 })]
    const load = weekLoad(tasks, 1)   // budget 1u/dag = 420 min...
    expect(load.budgetMin).toBe(420)
    expect(load.freeMin).toBe(220)
    const overbooked = weekLoad([rt({ days: ['monday','tuesday'], duration_min: 300 })], 1)
    expect(overbooked.freeMin).toBeLessThan(0)
  })

  it('kapt het percentage af op 100 bij extreme overboeking', () => {
    const load = weekLoad([rt({ days: ['monday'], duration_min: 6000 })], 1)
    expect(load.pctBusy).toBe(100)
  })

  it('gaat veilig om met geen routines', () => {
    const load = weekLoad([])
    expect(load.totalMin).toBe(0)
    expect(load.occurrences).toBe(0)
    expect(load.busiestDay.min).toBe(0)
  })
})

describe('formatMinutes', () => {
  it('formatteert uren en minuten', () => {
    expect(formatMinutes(90)).toBe('1u 30m')
    expect(formatMinutes(60)).toBe('1u')
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(0)).toBe('0m')
  })

  it('formatteert negatieve tijd (overboekt)', () => {
    expect(formatMinutes(-90)).toBe('-1u 30m')
  })
})

describe('formatHours', () => {
  it('geeft uren met één decimaal en Nederlandse komma', () => {
    expect(formatHours(155)).toBe('2,6u')
    expect(formatHours(60)).toBe('1,0u')
  })
})
