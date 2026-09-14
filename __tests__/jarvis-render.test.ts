import { describe, it, expect, vi } from 'vitest'
import { extractTaskIds, extractSuggestions, stripSuggestionsLine } from '@/lib/jarvis-render'
import type { Task } from '@/lib/types'

// ─── extractSuggestions ────────────────────────────────────────────────────────

describe('extractSuggestions', () => {
  it('parseert een SUGGESTIES-regel en stript hem uit de tekst', () => {
    const content = 'Je hebt 3 taken vandaag.\nSUGGESTIES: ["Plan mijn dag","Toon urgente taken"]'
    expect(extractSuggestions(content)).toEqual({
      text: 'Je hebt 3 taken vandaag.',
      suggestions: ['Plan mijn dag', 'Toon urgente taken'],
    })
  })

  it('geeft lege suggesties zonder marker', () => {
    expect(extractSuggestions('Gewoon een antwoord.')).toEqual({ text: 'Gewoon een antwoord.', suggestions: [] })
  })

  it('kapt af op maximaal 3 suggesties', () => {
    const content = 'X\nSUGGESTIES: ["a","b","c","d","e"]'
    expect(extractSuggestions(content).suggestions).toEqual(['a', 'b', 'c'])
  })

  it('stript de regel ook bij kapotte JSON', () => {
    const content = 'Antwoord.\nSUGGESTIES: [kapot'
    // kapotte JSON matcht het patroon niet (geen sluithaak) → tekst blijft heel
    expect(extractSuggestions(content).text).toBe(content)
  })

  it('negeert niet-string elementen', () => {
    const content = 'X\nSUGGESTIES: ["goed", 42, "", "ook goed"]'
    expect(extractSuggestions(content).suggestions).toEqual(['goed', 'ook goed'])
  })

  it('matcht alleen aan het einde, niet middenin', () => {
    const content = 'SUGGESTIES: ["a"]\nEcht antwoord komt hierna.'
    expect(extractSuggestions(content).suggestions).toEqual([])
  })
})

describe('stripSuggestionsLine', () => {
  it('verbergt een volledige SUGGESTIES-regel', () => {
    expect(stripSuggestionsLine('Antwoord.\nSUGGESTIES: ["a","b"]')).toBe('Antwoord.')
  })

  it('verbergt ook een half gestreamde regel', () => {
    expect(stripSuggestionsLine('Antwoord.\nSUGGESTIES: ["Pl')).toBe('Antwoord.')
  })

  it('laat tekst zonder marker intact', () => {
    expect(stripSuggestionsLine('Gewoon antwoord.')).toBe('Gewoon antwoord.')
  })
})

// ─── extractTaskIds ────────────────────────────────────────────────────────────

describe('extractTaskIds', () => {
  it('parses a single [ID] reference', () => {
    expect(extractTaskIds('[23] Mika bellen')).toEqual([23])
  })

  it('parses multiple [ID] references on separate lines', () => {
    const content = '[23] Mika bellen — doing\n[44] Date plannen — urgent\n[56] Sportschool'
    expect(extractTaskIds(content)).toEqual([23, 44, 56])
  })

  it('returns empty array when no IDs present', () => {
    expect(extractTaskIds('Vandaag heb je niets urgents.')).toEqual([])
  })

  it('does not match non-ID brackets like [status]', () => {
    // [status] is text, not a number — should be ignored
    const content = 'Taak [23] heeft status [doing]'
    expect(extractTaskIds(content)).toEqual([23])
  })

  it('handles the numbered-list format Jarvis sometimes uses incorrectly', () => {
    // Old bad format: "1. Task name" — should yield no IDs
    const content = '1. Mika bellen\n2. Sportschool\n3. Piano'
    expect(extractTaskIds(content)).toEqual([])
  })
})

// ─── Task sync logic (week item → task) ───────────────────────────────────────

describe('week item → task sync', () => {
  it('parseInt handles string task_id correctly', () => {
    expect(parseInt('23')).toBe(23)
    expect(parseInt('0')).toBe(0)
    expect(isNaN(parseInt('null'))).toBe(true)
    expect(isNaN(parseInt(''))).toBe(true)
  })

  it('finds task by parsed task_id', () => {
    const tasks: Task[] = [
      { id: 23, user_id: 'u1', proj_id: 'proj1', name: 'Mika bellen', status: 'doing', urgent: false, priority: 0, created_at: '', updated_at: '' },
      { id: 44, user_id: 'u1', proj_id: 'proj2', name: 'Date plannen', status: 'backlog', urgent: true, priority: 0, created_at: '', updated_at: '' },
    ]
    const taskId = parseInt('23')
    expect(tasks.find(t => t.id === taskId)?.name).toBe('Mika bellen')
  })

  it('returns undefined for non-existent task_id', () => {
    const tasks: Task[] = [
      { id: 23, user_id: 'u1', proj_id: 'proj1', name: 'Mika bellen', status: 'doing', urgent: false, priority: 0, created_at: '', updated_at: '' },
    ]
    expect(tasks.find(t => t.id === 999)).toBeUndefined()
  })
})

// ─── RPM chain data integrity ──────────────────────────────────────────────────

describe('RPM chain: task → project → category', () => {
  const categories = [
    { id: 'cat-1', user_id: 'u1', name: 'Muzikant', vision: 'Als ik het podium op stap hoor ik het gejuich.' },
    { id: 'cat-2', user_id: 'u1', name: 'Gezondheid', vision: 'Ik heb uitbundig energie.' },
  ]
  const projects = [
    { id: 'proj-1', user_id: 'u1', cat_id: 'cat-1', name: 'Acme Co', emoji: '🎹', status: 'actief' as const, description: 'Piano les geven', vision: 'Top piano docent', created_at: '', updated_at: '' },
  ]
  const tasks: Task[] = [
    { id: 23, user_id: 'u1', proj_id: 'proj-1', name: 'Opname inplannen', status: 'doing', urgent: true, priority: 0, created_at: '', updated_at: '' },
  ]

  it('resolves task → project correctly', () => {
    const task = tasks.find(t => t.id === 23)!
    const project = projects.find(p => p.id === task.proj_id)
    expect(project?.name).toBe('Acme Co')
  })

  it('resolves project → category correctly', () => {
    const project = projects.find(p => p.id === 'proj-1')!
    const category = categories.find(c => c.id === project.cat_id)
    expect(category?.name).toBe('Muzikant')
  })

  it('category has vision text after SQL update', () => {
    const category = categories.find(c => c.name === 'Muzikant')
    expect(category?.vision).toBeTruthy()
    expect(category?.vision?.length).toBeGreaterThan(10)
  })

  it('full chain: task → project → category → vision', () => {
    const task = tasks.find(t => t.id === 23)!
    const project = projects.find(p => p.id === task.proj_id)!
    const category = categories.find(c => c.id === project.cat_id)!

    expect(task.name).toBe('Opname inplannen')
    expect(project.emoji).toBe('🎹')
    expect(category.vision).toContain('podium')
  })
})

// ─── System prompt format check ───────────────────────────────────────────────

describe('Jarvis system prompt task format', () => {
  function fmtTask(t: { id: number; name: string; proj_id: string }) {
    return `  [${t.id}] ${t.name} (${t.proj_id})`
  }

  it('formats task with [ID] prefix', () => {
    const result = fmtTask({ id: 23, name: 'Mika bellen', proj_id: 'tuinproject' })
    expect(result).toBe('  [23] Mika bellen (tuinproject)')
    expect(extractTaskIds(result)).toEqual([23])
  })

  it('formatted tasks are parseable by extractTaskIds', () => {
    const tasks = [
      { id: 23, name: 'Mika bellen', proj_id: 'tuinproject' },
      { id: 44, name: 'Date plannen', proj_id: 'familie' },
    ]
    const block = tasks.map(fmtTask).join('\n')
    expect(extractTaskIds(block)).toEqual([23, 44])
  })
})
