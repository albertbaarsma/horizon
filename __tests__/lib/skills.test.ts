import { describe, it, expect } from 'vitest'
import { normalizeSkill, displaySkill, skillsFromEvents, findSkill } from '@/lib/skills'
import type { XpEvent } from '@/lib/types'

function ev(overrides: Partial<XpEvent> = {}): XpEvent {
  return {
    id: 1, user_id: 'u', amount: 10, reason: 'test', cat_id: null,
    source: 'skill', skill: 'sociaal', ref_id: null, seen: false,
    created_at: '2026-08-01T10:00:00Z',
    ...overrides,
  }
}

describe('normalizeSkill', () => {
  it('maakt namen vergelijkbaar (case, spaties)', () => {
    expect(normalizeSkill('Sociaal')).toBe('sociaal')
    expect(normalizeSkill('  IT  ')).toBe('it')
    expect(normalizeSkill('Muziek   maken')).toBe('muziek maken')
  })
})

describe('displaySkill', () => {
  it('geeft nette weergavenamen', () => {
    expect(displaySkill('sociaal')).toBe('Sociaal')
    expect(displaySkill('muziek maken')).toBe('Muziek Maken')
  })
})

describe('skillsFromEvents', () => {
  it('telt XP per skill op en berekent level', () => {
    const skills = skillsFromEvents([
      ev({ id: 1, skill: 'muziek', amount: 60 }),
      ev({ id: 2, skill: 'muziek', amount: 40 }),
      ev({ id: 3, skill: 'it', amount: 10 }),
    ])
    expect(skills.map(s => [s.label, s.xp])).toEqual([['Muziek', 100], ['It', 10]])
    expect(skills[0].level).toBeGreaterThanOrEqual(2)   // 100 XP = level 2 op de curve
    expect(skills[0].count).toBe(2)
  })

  it('voegt varianten van dezelfde naam samen', () => {
    const skills = skillsFromEvents([
      ev({ id: 1, skill: 'Sociaal', amount: 10 }),
      ev({ id: 2, skill: 'sociaal ', amount: 5 }),
      ev({ id: 3, skill: 'SOCIAAL', amount: 5 }),
    ])
    expect(skills).toHaveLength(1)
    expect(skills[0].xp).toBe(20)
  })

  it('negeert events zonder skill (bv. gewone taak-XP)', () => {
    const skills = skillsFromEvents([
      ev({ id: 1, skill: null, source: 'task' }),
      ev({ id: 2, skill: '', source: 'task' }),
      ev({ id: 3, skill: '   ', source: 'task' }),
      ev({ id: 4, skill: 'marketing', amount: 15 }),
    ])
    expect(skills.map(s => s.label)).toEqual(['Marketing'])
  })

  it('sorteert aflopend op XP', () => {
    const skills = skillsFromEvents([
      ev({ id: 1, skill: 'a', amount: 5 }),
      ev({ id: 2, skill: 'b', amount: 50 }),
      ev({ id: 3, skill: 'c', amount: 20 }),
    ])
    expect(skills.map(s => s.label)).toEqual(['B', 'C', 'A'])
  })

  it('houdt het laatste tijdstip per skill bij', () => {
    const skills = skillsFromEvents([
      ev({ id: 1, skill: 'x', created_at: '2026-08-01T10:00:00Z' }),
      ev({ id: 2, skill: 'x', created_at: '2026-08-05T10:00:00Z' }),
      ev({ id: 3, skill: 'x', created_at: '2026-08-03T10:00:00Z' }),
    ])
    expect(skills[0].lastAt).toBe('2026-08-05T10:00:00Z')
  })

  it('geeft een lege lijst zonder events', () => {
    expect(skillsFromEvents([])).toEqual([])
  })
})

describe('findSkill', () => {
  it('vindt een bestaande skill ongeacht schrijfwijze', () => {
    const skills = skillsFromEvents([ev({ skill: 'ondernemen', amount: 10 })])
    expect(findSkill(skills, 'Ondernemen')?.xp).toBe(10)
    expect(findSkill(skills, '  ONDERNEMEN ')?.xp).toBe(10)
    expect(findSkill(skills, 'zingen')).toBeUndefined()
  })
})

// ─── Levensgebieden mét vaardigheden ──────────────────────────────────────────

import { areasWithSkills, NO_AREA } from '@/lib/skills'

const CATS = [{ id: 'muzikant', name: 'Muzikant' }, { id: 'thuis', name: 'Thuis & Land' }]

describe('areasWithSkills', () => {
  it('hangt een skill onder het levensgebied waar zijn XP vandaan komt', () => {
    const areas = areasWithSkills([
      ev({ id: 1, skill: 'muziek', amount: 30, cat_id: 'muzikant' }),
      ev({ id: 2, skill: 'klussen', amount: 20, cat_id: 'thuis' }),
    ], CATS)
    const muzikant = areas.find(a => a.id === 'muzikant')!
    const thuis    = areas.find(a => a.id === 'thuis')!
    expect(muzikant.skills.map(s => s.label)).toEqual(['Muziek'])
    expect(thuis.skills.map(s => s.label)).toEqual(['Klussen'])
  })

  it('telt ook XP mee die niet van een skill komt (taken, doelen)', () => {
    const areas = areasWithSkills([
      ev({ id: 1, skill: null, source: 'task', amount: 10, cat_id: 'muzikant' }),
      ev({ id: 2, skill: 'muziek', amount: 15, cat_id: 'muzikant' }),
    ], CATS)
    expect(areas.find(a => a.id === 'muzikant')!.xp).toBe(25)
  })

  it('kiest bij XP uit meerdere gebieden het zwaarste als thuisbasis', () => {
    const areas = areasWithSkills([
      ev({ id: 1, skill: 'discipline', amount: 10, cat_id: 'muzikant' }),
      ev({ id: 2, skill: 'discipline', amount: 40, cat_id: 'thuis' }),
    ], CATS)
    expect(areas.find(a => a.id === 'thuis')!.skills.map(s => s.label)).toEqual(['Discipline'])
    expect(areas.find(a => a.id === 'muzikant')!.skills).toEqual([])
    // de XP blijft wel bij het gebied waar het verdiend is
    expect(areas.find(a => a.id === 'muzikant')!.xp).toBe(10)
  })

  it('zet skills zonder levensgebied in de overig-bak', () => {
    const areas = areasWithSkills([ev({ id: 1, skill: 'sociaal', amount: 10, cat_id: null })], CATS)
    const overig = areas.find(a => a.id === NO_AREA)!
    expect(overig.name).toBe('Overig')
    expect(overig.skills.map(s => s.label)).toEqual(['Sociaal'])
  })

  it('sorteert gebieden aflopend op XP', () => {
    const areas = areasWithSkills([
      ev({ id: 1, amount: 5,  cat_id: 'muzikant', skill: null, source: 'task' }),
      ev({ id: 2, amount: 50, cat_id: 'thuis',    skill: null, source: 'task' }),
    ], CATS)
    expect(areas.map(a => a.id)).toEqual(['thuis', 'muzikant'])
  })

  it('geeft een lege lijst zonder events', () => {
    expect(areasWithSkills([], CATS)).toEqual([])
  })
})
