import { describe, it, expect } from 'vitest'
import {
  normalizeText, keywords, similarity, completedEvidence, achievementHint,
  recurringHint, daysSinceTouched, reviewTasks, certainlyDoneIds, VERDICT_META,
} from '@/lib/task-freshness'
import type { Task, WeekItem, Achievement, RecurringTask } from '@/lib/types'

const NU = new Date('2026-08-08T12:00:00Z')

function task(id: number, name: string, extra: Partial<Task> = {}): Task {
  return {
    id, user_id: 'u', proj_id: 'p', name, status: 'backlog', urgent: false, priority: 0,
    created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z', ...extra,
  }
}
function week(text: string, extra: Partial<WeekItem> = {}): WeekItem {
  return {
    id: 1, user_id: 'u', date: '2026-07-24', type: 'task', text, done: true,
    proj_id: null, task_id: null, recur_id: null, created_at: '', ...extra,
  }
}
function ach(text: string, date = '2026-08-06'): Achievement {
  return { id: 1, user_id: 'u', date, text, cat_id: 'c', emoji: '🏆', created_at: '' }
}
function recur(name: string): RecurringTask {
  return { id: 1, user_id: 'u', name, type: 'task', days: ['monday'], cat_id: null, proj_id: null, active: true, created_at: '' }
}

const leeg = { tasks: [], weekItems: [], achievements: [], recurringTasks: [], now: NU }

// ── Tekstvergelijking ─────────────────────────────────────────────────────────

describe('normalizeText', () => {
  it('haalt emoji, leestekens en dubbele spaties weg', () => {
    expect(normalizeText('🏋️ Sportschool  vr!')).toBe('sportschool vr')
    expect(normalizeText('ING — Rekening geblokkeerd…')).toBe('ing rekening geblokkeerd')
  })
})

describe('keywords', () => {
  it('laat stopwoorden en korte woorden vallen', () => {
    expect(keywords('Opvolging na de rondleiding (mails)')).toEqual(['opvolging', 'rondleiding', 'mails'])
  })
})

describe('similarity', () => {
  it('herkent een langere formulering van dezelfde taak', () => {
    expect(similarity('Schuur opruimen', 'Schuur opruimen — alles een vaste plek geven')).toBe(1)
  })

  it('geeft 0 bij niets gemeenschappelijk', () => {
    expect(similarity('Regenpijp repareren', 'Setlist oefenen')).toBe(0)
  })

  it('geeft 0 als er geen inhoudswoorden zijn', () => {
    expect(similarity('de en het', 'Piano oefenen')).toBe(0)
  })
})

// ── Bewijs dat iets al klaar is ───────────────────────────────────────────────

describe('completedEvidence', () => {
  it('vindt een afgevinkt weekitem dat naar de taak verwijst', () => {
    const t = task(7, 'Regenpijp repareren')
    expect(completedEvidence(t, [week('Iets anders', { task_id: '7' })])?.text).toBe('Iets anders')
  })

  it('vindt een afgevinkt weekitem met dezelfde tekst, ook met emoji ervoor', () => {
    expect(completedEvidence(task(3, 'Was doen'), [week('🧺 Was doen')])).not.toBeNull()
  })

  it('trapt niet in een weekitem dat nog niet afgevinkt is', () => {
    expect(completedEvidence(task(3, 'Was doen'), [week('🧺 Was doen', { done: false })])).toBeNull()
  })

  it('trapt niet in een weekitem dat er alleen op lijkt', () => {
    expect(completedEvidence(task(3, 'Was doen'), [week('Was ophangen en opvouwen')])).toBeNull()
  })
})

describe('achievementHint', () => {
  it('vindt een win die op de taak lijkt', () => {
    expect(achievementHint(task(1, 'Schuur opruimen'), [ach('Schuur opruimen — alles een vaste plek geven')])).not.toBeNull()
  })

  it('geeft niets terug bij een losse gedachte die niet past', () => {
    expect(achievementHint(task(1, 'Regenpijp repareren'), [ach('Lekker gewandeld met de kids')])).toBeNull()
  })
})

describe('recurringHint', () => {
  it('herkent een taak die al als herhaaltaak bestaat', () => {
    const r = recurringHint(task(1, '🏋️ Sportschool vr'), [recur('Sportschool vr')])
    expect(r).not.toBeNull()
    expect(r).not.toBe(true)
  })

  it('herkent ritme-woorden ook zonder herhaaltaak', () => {
    expect(recurringHint(task(1, 'Setlist oefenen (30 min dagelijks)'), [])).toBe(true)
    expect(recurringHint(task(2, 'Sportschool 4x deze week'), [])).toBe(true)
    expect(recurringHint(task(3, 'Wekelijkse plansessie'), [])).toBe(true)
  })

  it('ziet een gewone taak niet als ritme', () => {
    expect(recurringHint(task(1, 'Regenpijp repareren'), [recur('Sportschool')])).toBeNull()
  })
})

describe('daysSinceTouched', () => {
  it('rekent vanaf de laatste wijziging', () => {
    expect(daysSinceTouched(task(1, 'x', { updated_at: '2026-07-09T12:00:00Z' }), NU)).toBe(30)
  })

  it('valt terug op de aanmaakdatum', () => {
    expect(daysSinceTouched(task(1, 'x', { updated_at: '', created_at: '2026-08-06T12:00:00Z' }), NU)).toBe(2)
  })

  it('gaat niet stuk op een onbruikbare datum', () => {
    expect(daysSinceTouched(task(1, 'x', { updated_at: 'geen datum', created_at: '' }), NU)).toBe(0)
  })
})

// ── Het overzicht ─────────────────────────────────────────────────────────────

describe('reviewTasks', () => {
  it('laat afgeronde taken buiten beschouwing', () => {
    expect(reviewTasks({ ...leeg, tasks: [task(1, 'Klaar', { status: 'done', updated_at: '2026-01-01T10:00:00Z' })] })).toEqual([])
  })

  it('laat een verse taak met rust', () => {
    expect(reviewTasks({ ...leeg, tasks: [task(1, 'Nieuwe taak van vandaag', { updated_at: '2026-08-08T09:00:00Z' })] })).toEqual([])
  })

  it('zet hard bewijs bovenaan', () => {
    const found = reviewTasks({
      ...leeg,
      tasks: [
        task(1, 'Oude taak', { updated_at: '2026-06-01T10:00:00Z' }),
        task(2, 'Was doen'),
      ],
      weekItems: [week('🧺 Was doen')],
    })
    expect(found[0].task.id).toBe(2)
    expect(found[0].verdict).toBe('klaar')
    expect(found[1].verdict).toBe('oud')
  })

  it('noemt de datum van het afgevinkte weekitem in de reden', () => {
    const found = reviewTasks({ ...leeg, tasks: [task(2, 'Was doen')], weekItems: [week('🧺 Was doen')] })
    expect(found[0].reason).toContain('2026-07-24')
  })

  it('geeft elke taak precies één oordeel', () => {
    const found = reviewTasks({
      ...leeg,
      tasks: [task(1, 'Schuur opruimen', { updated_at: '2026-06-01T10:00:00Z' })],
      achievements: [ach('Schuur opruimen — alles een vaste plek geven')],
    })
    expect(found).toHaveLength(1)
    expect(found[0].verdict).toBe('mogelijk-klaar')
  })

  it('laat een oude taak waar wél aan gewerkt is met rust', () => {
    const bezig = task(1, 'Pitch document 2 A4', { updated_at: '2026-06-01T10:00:00Z', actual_min: 45 })
    expect(reviewTasks({ ...leeg, tasks: [bezig] })).toEqual([])
  })

  it('gebruikt de meegegeven drempel voor "lang stil"', () => {
    const t = [task(1, 'Iets', { updated_at: '2026-07-25T12:00:00Z' })]   // 14 dagen
    expect(reviewTasks({ ...leeg, tasks: t })).toEqual([])
    expect(reviewTasks({ ...leeg, tasks: t, staleDays: 10 })).toHaveLength(1)
  })

  it('geeft voor elk oordeel een leesbare reden', () => {
    const found = reviewTasks({
      ...leeg,
      tasks: [task(1, 'Was doen'), task(2, 'Wekelijkse plansessie'), task(3, 'Oud', { updated_at: '2026-05-01T10:00:00Z' })],
      weekItems: [week('🧺 Was doen')],
    })
    found.forEach(f => {
      expect(f.reason.length).toBeGreaterThan(10)
      expect(VERDICT_META[f.verdict]).toBeDefined()
    })
  })
})

describe('certainlyDoneIds', () => {
  it('geeft alleen taken met hard bewijs', () => {
    const ids = certainlyDoneIds(
      [task(1, 'Was doen'), task(2, 'Schuur opruimen'), task(3, 'Was doen', { status: 'done' })],
      [week('🧺 Was doen')],
    )
    expect([...ids]).toEqual([1])
  })
})
