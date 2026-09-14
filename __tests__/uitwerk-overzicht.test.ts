import { describe, it, expect } from 'vitest'
import { verzamelNietSmart, combinedUitwerkPrompt } from '@/lib/uitwerk-overzicht'
import type { Goal, Project, Task } from '@/lib/types'

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 1, user_id: 'u', horizon: 'kwartaal', text: 'Album afmaken', done: false,
    cat_id: 'muziek', deadline: null, created_at: '', ...over,
  }
}

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'tuinproject', user_id: 'u', cat_id: 'thuis', name: 'Schuur verbouwen', emoji: '🏚️',
    status: 'actief', description: '', vision: '', proj_type: 'project', notes: null,
    html_content: null, is_priority: true, sort_order: 0, created_at: '', updated_at: '', ...over,
  }
}

describe('verzamelNietSmart', () => {
  it('combineert doelen en projecten die nog niet SMART zijn', () => {
    const items = verzamelNietSmart([goal()], [project()], [])
    expect(items.map(i => i.id)).toEqual(['g-1', 'p-tuinproject'])
    expect(items[0].kind).toBe('goal')
    expect(items[1].kind).toBe('project')
  })

  it('laat een SMART doel en een uitgewerkt project weg', () => {
    const smartGoal = goal({ result: 'Tien nummers klaar' })
    const smartProject = project({ description: 'De stal ombouwen tot woonruimte, met isolatie.', vision: 'Warme ruimte om zo binnen te lopen.' })
    expect(verzamelNietSmart([smartGoal], [smartProject], [])).toEqual([])
  })

  it('geeft elk item zijn ontbrekende stukken mee', () => {
    const items = verzamelNietSmart([goal()], [], [])
    expect(items[0].ontbreekt).toContain('een duidelijk result')
  })

  it('is leeg zonder doelen en projecten', () => {
    expect(verzamelNietSmart([], [], [])).toEqual([])
  })
})

describe('combinedUitwerkPrompt', () => {
  const g = goal({ result: 'Al een result' })
  const p = project()
  const items = verzamelNietSmart([goal()], [p], [])   // alleen het lege doel + project komen erin

  it('legt de RPM-stappen één keer uit, niet per item', () => {
    const prompt = combinedUitwerkPrompt(items, [])
    expect(prompt.match(/Loop de RPM-methode/gi)?.length).toBe(1)
  })

  it('heeft een eigen sectie per item, met naam en wat ontbreekt', () => {
    const prompt = combinedUitwerkPrompt(items, [])
    expect(prompt).toContain('Album afmaken')
    expect(prompt).toContain('Schuur verbouwen')
    expect(prompt).toMatch(/1\. Doel: "Album afmaken"/)
    expect(prompt).toMatch(/2\. Project: "Schuur verbouwen"/)
  })

  it('is leeg-vriendelijk: geen items geeft geen crash', () => {
    expect(() => combinedUitwerkPrompt([], [])).not.toThrow()
    expect(combinedUitwerkPrompt([], [])).toContain('0')
  })

  it('vraagt om per item apart te werken, niet alles door elkaar', () => {
    const prompt = combinedUitwerkPrompt(items, [])
    expect(prompt).toMatch(/per item apart/i)
  })

  it('herhaalt de instructie om niets aan te maken zonder te laten zien', () => {
    const prompt = combinedUitwerkPrompt(items, [])
    expect(prompt).toMatch(/Maak nog niets aan/i)
  })

  it('neemt alleen de geselecteerde items mee, niet alles', () => {
    const alles = verzamelNietSmart([goal({ id: 1 }), goal({ id: 2, text: 'Ander doel' })], [], [])
    const prompt = combinedUitwerkPrompt(alles.slice(0, 1), [])
    expect(prompt).toContain('Album afmaken')
    expect(prompt).not.toContain('Ander doel')
  })
})
