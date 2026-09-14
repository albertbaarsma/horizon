import { describe, it, expect } from 'vitest'
import { projectSlug } from '@/lib/project-slug'

describe('projectSlug', () => {
  it('maakt een leesbare slug van de naam', () => {
    expect(projectSlug('Financieel overzicht', [])).toBe('financieel-overzicht')
  })

  it('haalt accenten en losse tekens weg', () => {
    expect(projectSlug('Café Deluxe — nieuw!', [])).toBe('cafe-deluxe-nieuw')
  })

  it('valt terug op "project" als er niets overblijft', () => {
    expect(projectSlug('💰', [])).toBe('project')
  })

  it('maakt de slug uniek als hij al bestaat', () => {
    expect(projectSlug('Moestuin', ['moestuin', 'moestuin-2'])).toBe('moestuin-3')
  })
})
