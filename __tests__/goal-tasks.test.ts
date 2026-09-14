import { describe, it, expect } from 'vitest'
import { tasksForGoal, hasLinkedTasks } from '@/lib/goal-tasks'
import type { Goal, Task, Project } from '@/lib/types'

function goal(text: string, over: Partial<Goal> = {}): Goal {
  return { id: 1, user_id: 'u', horizon: 'kwartaal', text, done: false, cat_id: 'muzikant', deadline: null, created_at: '', ...over }
}
function task(id: number, name: string, over: Partial<Task> = {}): Task {
  return { id, user_id: 'u', proj_id: null, name, status: 'backlog', urgent: false, priority: 0, created_at: '', updated_at: '', ...over }
}
function proj(id: string, cat: string): Project {
  return { id, user_id: 'u', cat_id: cat, name: id, emoji: '🎯', status: 'actief', description: '', vision: '',
    proj_type: 'project', notes: null, html_content: null, is_priority: false, sort_order: 0, created_at: '', updated_at: '' }
}

const projecten = [proj('setlist', 'muzikant'), proj('boerderij', 'thuis')]

describe('tasksForGoal', () => {
  it('vindt een taak met dezelfde woorden in hetzelfde levensgebied als sterkste vermoeden', () => {
    const g = goal('Vind 1 nieuwe klant (bejaardetehuis). Oefen de setlist dagelijks.')
    const t = task(1, 'Setlist oefenen dagelijks', { proj_id: 'setlist' })
    const gevonden = tasksForGoal(g, [t], projecten)
    expect(gevonden).toHaveLength(1)
    expect(gevonden[0].score).toBe(1)
    expect(gevonden[0].reason).toContain('Zelfde levensgebied')
  })

  it('vindt ook een losse inbox-taak die op het doel lijkt', () => {
    const g = goal('Setlist oefenen dagelijks voor de klanten')
    const gevonden = tasksForGoal(g, [task(1, 'Setlist oefenen')], projecten)
    expect(gevonden).toHaveLength(1)
    // Zonder project is het gebied onbekend, dus een zwakker vermoeden
    expect(gevonden[0].score).toBeLessThan(1)
    expect(gevonden[0].reason).toContain('lijkt op het doel')
  })

  it('koppelt niet op één gedeeld woord buiten het levensgebied', () => {
    const g = goal('Dak lekt niet meer, regenpijp gerepareerd', { cat_id: 'thuis' })
    expect(tasksForGoal(g, [task(1, 'Regenpijp bestellen', { proj_id: 'setlist' })], projecten)).toEqual([])
  })

  it('noemt een zwak vermoeden apart als het gebied wél klopt', () => {
    // Eén gedeeld woord is te mager om zeker te zijn, maar in hetzelfde
    // levensgebied wil je er wel naar kijken — bijv. je gigs-doel en losse
    // taken in Muzikant.
    const g = goal('10 gigs vinden voor Acme Co')
    const gevonden = tasksForGoal(g, [task(1, 'Gigs zoeken Amsterdam & Rotterdam', { proj_id: 'setlist' })], projecten)
    expect(gevonden).toHaveLength(1)
    expect(gevonden[0].score).toBeLessThan(0.5)
    expect(gevonden[0].reason).toContain('hetzelfde levensgebied')
  })

  it('laat afgeronde en weggegooide taken buiten beschouwing', () => {
    const g = goal('Setlist oefenen')
    const taken = [
      task(1, 'Setlist oefenen', { status: 'done', proj_id: 'setlist' }),
      task(2, 'Setlist oefenen', { deleted_at: '2026-08-01', proj_id: 'setlist' }),
    ]
    expect(tasksForGoal(g, taken, projecten)).toEqual([])
  })

  it('zet het sterkste vermoeden bovenaan', () => {
    const g = goal('Setlist oefenen dagelijks voor optredens')
    const taken = [
      task(1, 'Optredens zoeken'),                                       // zwakker
      task(2, 'Setlist oefenen dagelijks', { proj_id: 'setlist' }),       // sterk
    ]
    expect(tasksForGoal(g, taken, projecten)[0].task.id).toBe(2)
  })

  it('geeft niets terug bij een doel zonder herkenbare taken', () => {
    expect(tasksForGoal(goal('Grote liefde gevonden'), [task(1, 'Regenpijp repareren')], projecten)).toEqual([])
  })

  it('gaat om met een doel zonder levensgebied', () => {
    const g = goal('Setlist oefenen dagelijks', { cat_id: null })
    const gevonden = tasksForGoal(g, [task(1, 'Setlist oefenen', { proj_id: 'setlist' })], projecten)
    expect(gevonden).toHaveLength(1)
    expect(gevonden[0].score).toBeLessThan(1)
  })
})

describe('hasLinkedTasks', () => {
  it('zegt of er iets te beslissen valt', () => {
    expect(hasLinkedTasks(goal('Setlist oefenen'), [task(1, 'Setlist oefenen')], projecten)).toBe(true)
    expect(hasLinkedTasks(goal('Setlist oefenen'), [task(1, 'Gras maaien')], projecten)).toBe(false)
  })
})
