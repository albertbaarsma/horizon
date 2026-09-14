import { describe, it, expect } from 'vitest'
import { goalKind, isHobbyGoal, splitByKind, progressOf, goalProgress, KIND_META, HOBBY } from '@/lib/goal-kinds'
import type { Goal } from '@/lib/types'

function goal(id: number, over: Partial<Goal> = {}): Goal {
  return { id, user_id: 'u', horizon: 'jaar', text: `doel ${id}`, done: false, cat_id: null, deadline: null, created_at: '', ...over }
}

describe('goalKind', () => {
  it('behandelt een doel zonder soort als gewoon doel', () => {
    expect(goalKind(goal(1))).toBe('doel')
    expect(goalKind({ kind: undefined })).toBe('doel')
  })

  it('herkent een hobbydoel', () => {
    expect(goalKind(goal(1, { kind: 'hobby' }))).toBe('hobby')
    expect(isHobbyGoal(goal(1, { kind: 'hobby' }))).toBe(true)
    expect(isHobbyGoal(goal(1))).toBe(false)
  })

  it('geeft elke soort een eigen kleur en label', () => {
    expect(KIND_META.doel.color).not.toBe(KIND_META.hobby.color)
    expect(KIND_META[HOBBY].label).toBe('Hobbydoel')
  })
})

describe('splitByKind', () => {
  it('scheidt doelen en hobbydoelen met behoud van volgorde', () => {
    const g = [goal(1), goal(2, { kind: 'hobby' }), goal(3), goal(4, { kind: 'hobby' })]
    const { doelen, hobbys } = splitByKind(g)
    expect(doelen.map(x => x.id)).toEqual([1, 3])
    expect(hobbys.map(x => x.id)).toEqual([2, 4])
  })

  it('gaat om met een lege lijst', () => {
    expect(splitByKind([])).toEqual({ doelen: [], hobbys: [] })
  })
})

describe('progressOf', () => {
  it('rekent af op hele procenten', () => {
    expect(progressOf([goal(1, { done: true }), goal(2), goal(3)])).toEqual({ done: 1, total: 3, pct: 33 })
  })

  it('deelt nooit door nul', () => {
    expect(progressOf([])).toEqual({ done: 0, total: 0, pct: 0 })
  })
})

describe('goalProgress', () => {
  const goals = [
    goal(1, { done: true }), goal(2, { done: true }), goal(3),
    goal(4, { kind: 'hobby', done: true }), goal(5, { kind: 'hobby' }),
    goal(6, { done: true, deleted_at: '2026-08-01' }),
  ]

  it('laat hobbydoelen buiten het cijfer dat telt', () => {
    expect(goalProgress(goals).doelen).toEqual({ done: 2, total: 3, pct: 67 })
  })

  it('geeft hobbydoelen hun eigen cijfer', () => {
    expect(goalProgress(goals).hobbys).toEqual({ done: 1, total: 2, pct: 50 })
  })

  it('laat weggegooide doelen helemaal buiten beschouwing', () => {
    // doel 6 staat op gehaald maar zit in de prullenbak — die telt niet mee
    expect(goalProgress(goals).doelen.total).toBe(3)
  })

  it('een hobbydoel erbij verandert je voortgangscijfer niet', () => {
    const voor = goalProgress(goals).doelen
    const na = goalProgress([...goals, goal(7, { kind: 'hobby' }), goal(8, { kind: 'hobby', done: true })]).doelen
    expect(na).toEqual(voor)
  })
})
