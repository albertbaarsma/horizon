import { describe, it, expect } from 'vitest'
import { beoordeelUitwerking, projectenDieOmUitwerkingVragen, uitwerkPrompt } from '@/lib/project-depth'
import type { Project, Task } from '@/lib/types'

function proj(over: Partial<Project> = {}): Project {
  return {
    id: 'tuinproject', user_id: 'u', cat_id: 'thuis', name: 'Schuur verbouwen', emoji: '🏚️',
    status: 'actief', description: '', vision: '', proj_type: 'project', notes: null,
    html_content: null, is_priority: true, sort_order: 0, created_at: '', updated_at: '', ...over,
  }
}

function taak(id: number, over: Partial<Task> = {}): Task {
  return {
    id, user_id: 'u', proj_id: 'tuinproject', name: `taak ${id}`, status: 'backlog',
    urgent: false, priority: 0, created_at: '', updated_at: '', ...over,
  }
}

const UITGEWERKT = {
  description: 'De stal ombouwen tot woonruimte, inclusief isolatie en vloerverwarming.',
  vision: 'Een warme ruimte waar je zo naar binnen kunt lopen.',
}

describe('beoordeelUitwerking — wanneer is een aanbod op zijn plaats', () => {
  it('vraagt erom als een prioriteitsproject leeg is', () => {
    const u = beoordeelUitwerking(proj(), [])
    expect(u.vraagtErom).toBe(true)
    expect(u.ontbreekt.length).toBeGreaterThanOrEqual(2)
  })

  it('zwijgt zodra het project is uitgewerkt', () => {
    const u = beoordeelUitwerking(proj(UITGEWERKT), [taak(1)])
    expect(u.ontbreekt).toEqual([])
    expect(u.vraagtErom).toBe(false)
  })

  // Jordan: "voor sommige levensdelen is het genoeg om 4x per week te sporten"
  it('laat een gewoon project dat niet je prioriteit is met rust, ook als het dun is', () => {
    const u = beoordeelUitwerking(proj({ is_priority: false, status: 'lopend' }), [])
    expect(u.draagtGewicht).toBe(false)
    expect(u.vraagtErom).toBe(false)
  })

  it('laat routines met rust', () => {
    const u = beoordeelUitwerking(proj({ proj_type: 'routine', name: '4x per week sporten' }), [])
    expect(u.vraagtErom).toBe(false)
  })

  it('laat slapende en gearchiveerde projecten met rust', () => {
    for (const status of ['slapend', 'visie', 'archief'] as const) {
      expect(beoordeelUitwerking(proj({ status }), []).vraagtErom, status).toBe(false)
    }
  })

  it('spreekt ook bij urgent zonder prioriteitsster', () => {
    expect(beoordeelUitwerking(proj({ is_priority: false, status: 'urgent' }), []).draagtGewicht).toBe(true)
  })

  it('zeurt niet om één ontbrekend ding', () => {
    // omschrijving en taak aanwezig, alleen het eindbeeld ontbreekt
    const u = beoordeelUitwerking(proj({ description: UITGEWERKT.description }), [taak(1)])
    expect(u.ontbreekt).toHaveLength(1)
    expect(u.vraagtErom).toBe(false)
  })

  it('telt een omschrijving van drie woorden niet als omschrijving', () => {
    const u = beoordeelUitwerking(proj({ description: 'stal verbouwen' }), [])
    expect(u.ontbreekt.some(x => x.includes('omschrijving'))).toBe(true)
  })

  it('ziet een afgevinkte taak niet aan voor een eerste stap', () => {
    const u = beoordeelUitwerking(proj(UITGEWERKT), [taak(1, { status: 'done' })])
    expect(u.ontbreekt).toEqual(['een eerste stap om mee te beginnen'])
  })

  it('negeert weggegooide taken', () => {
    const u = beoordeelUitwerking(proj(UITGEWERKT), [taak(1, { deleted_at: '2026-01-01' })])
    expect(u.ontbreekt).toEqual(['een eerste stap om mee te beginnen'])
  })

  it('telt taken van sub-projecten mee als eigen werk', () => {
    const sub = proj({ id: 'dak', name: 'Dak', parent_id: 'tuinproject' })
    const u = beoordeelUitwerking(proj(UITGEWERKT), [taak(1, { proj_id: 'dak' })], [proj(), sub])
    expect(u.ontbreekt).toEqual([])
  })

  it('stelt deelprojecten voor als er een berg losse taken onder hangt', () => {
    const taken = Array.from({ length: 9 }, (_, i) => taak(i + 1))
    const u = beoordeelUitwerking(proj(UITGEWERKT), taken)
    expect(u.ontbreekt).toEqual(['deelprojecten om het behapbaar te maken'])
  })
})

describe('projectenDieOmUitwerkingVragen', () => {
  it('kiest alleen de projecten waar het ergens over gaat', () => {
    const projecten = [
      proj({ id: 'leeg-prio' }),
      proj({ id: 'af', ...UITGEWERKT }),
      proj({ id: 'zijlijn', is_priority: false, status: 'lopend' }),
    ]
    expect(projectenDieOmUitwerkingVragen(projecten, [])).toHaveLength(1)
    expect(projectenDieOmUitwerkingVragen(projecten, [])[0].id).toBe('leeg-prio')
  })
})

describe('uitwerkPrompt', () => {
  const u = beoordeelUitwerking(proj(), [])

  it('noemt het project en wat er ontbreekt', () => {
    const p = uitwerkPrompt(proj(), u)
    expect(p).toContain('Schuur verbouwen')
    expect(p).toContain('een omschrijving')
  })

  // Jordan beslist zelf wat er in zijn app belandt — de AI mag eerst denken
  it('vraagt de AI eerst te vragen en niets aan te maken', () => {
    const p = uitwerkPrompt(proj(), u)
    expect(p).toMatch(/vraag alleen door/i)
    expect(p).toMatch(/Maak nog niets aan/i)
  })

  it('volgt Jordans RPM-stappen: result, why, chunken in sub-resultaten', () => {
    const p = uitwerkPrompt(proj(), u)
    expect(p).toMatch(/RPM-methode/i)
    expect(p).toMatch(/Result/)
    expect(p).toMatch(/Why/)
    expect(p).toMatch(/sub-resultaten/i)
    expect(p).toMatch(/RPM-blok/i)
  })

  it('neemt al vastgelegde context mee in plaats van opnieuw te vragen', () => {
    const project = proj({ description: 'Zelf een videoeditor bouwen die met AI knipt.', vision: 'Video maken zonder de rem van het monteren.' })
    const p = uitwerkPrompt(project, beoordeelUitwerking(project, []), [])
    expect(p).toContain('Zelf een videoeditor bouwen die met AI knipt.')
    expect(p).toContain('Video maken zonder de rem van het monteren.')
  })
})
