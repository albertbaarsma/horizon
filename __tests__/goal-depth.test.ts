import { describe, it, expect } from 'vitest'
import { beoordeelGoalUitwerking, goalsDieOmUitwerkingVragen, goalUitwerkPrompt } from '@/lib/goal-depth'
import type { Goal } from '@/lib/types'

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 1, user_id: 'u', horizon: 'kwartaal', text: 'Album afmaken', done: false,
    cat_id: 'muziek', deadline: null, created_at: '', ...over,
  }
}

describe('beoordeelGoalUitwerking — het SMART-signaal', () => {
  it('vraagt om uitwerking als een actief doel geen result heeft', () => {
    const u = beoordeelGoalUitwerking(goal())
    expect(u.vraagtErom).toBe(true)
    expect(u.ontbreekt).toContain('een duidelijk result')
  })

  it('zwijgt zodra er een result staat, ook zonder why', () => {
    const u = beoordeelGoalUitwerking(goal({ result: 'Tien nummers, gemixt en gemasterd.' }))
    expect(u.vraagtErom).toBe(false)
  })

  it('noemt why ook als het ontbreekt, ook al triggert het niet zelf', () => {
    const u = beoordeelGoalUitwerking(goal())
    expect(u.ontbreekt).toContain('een why')
  })

  // Jordan: "voor sommige levensdelen is het genoeg om 4x per week te sporten" —
  // hobbydoelen zijn er voor de lol, geen SMART-eis.
  it('laat hobbydoelen met rust', () => {
    const u = beoordeelGoalUitwerking(goal({ kind: 'hobby' }))
    expect(u.draagtGewicht).toBe(false)
    expect(u.vraagtErom).toBe(false)
  })

  it('laat afgeronde doelen met rust', () => {
    const u = beoordeelGoalUitwerking(goal({ done: true }))
    expect(u.vraagtErom).toBe(false)
  })

  it('een lege string telt als ontbrekend, geen kale spatie-tekst', () => {
    expect(beoordeelGoalUitwerking(goal({ result: '   ' })).vraagtErom).toBe(true)
  })
})

describe('goalsDieOmUitwerkingVragen', () => {
  it('filtert precies de doelen die er baat bij hebben', () => {
    const goals = [
      goal({ id: 1 }),
      goal({ id: 2, result: 'Duidelijk' }),
      goal({ id: 3, kind: 'hobby' }),
      goal({ id: 4, done: true }),
    ]
    expect(goalsDieOmUitwerkingVragen(goals).map(g => g.id)).toEqual([1])
  })
})

describe('goalUitwerkPrompt', () => {
  it('noemt het doel en vraagt eerst door in plaats van meteen in te vullen', () => {
    const u = beoordeelGoalUitwerking(goal())
    const p = goalUitwerkPrompt(goal(), u)
    expect(p).toContain('Album afmaken')
    expect(p).toMatch(/Vraag me alleen door/i)
    expect(p).toMatch(/Vul nog niets in/i)
  })

  it('neemt al vastgelegd result/why/notities mee in plaats van opnieuw te vragen', () => {
    const g = goal({ result: 'Tien nummers klaar', why: 'Ik wil het live spelen', notes: 'Studio is geboekt' })
    const p = goalUitwerkPrompt(g, beoordeelGoalUitwerking(g))
    expect(p).toContain('Tien nummers klaar')
    expect(p).toContain('Ik wil het live spelen')
    expect(p).toContain('Studio is geboekt')
  })

  it('biedt aan om op te hakken in sub-doelen', () => {
    const p = goalUitwerkPrompt(goal(), beoordeelGoalUitwerking(goal()))
    expect(p).toMatch(/sub-doelen/i)
  })
})
