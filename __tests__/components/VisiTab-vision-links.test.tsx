import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Category, Goal, Achievement } from '@/lib/types'

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: () => ({
      update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null }) }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
}))

const { default: VisiTab } = await import('@/app/dashboard/VisiTab')

beforeEach(() => { vi.clearAllMocks() })

function cat(over: Partial<Category> = {}): Category {
  return { id: 'kinderen', user_id: 'u', name: 'Kinderen', ...over }
}

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 60, user_id: 'u', horizon: 'ooit', text: 'Fysiek voel ik me topfit', done: false,
    cat_id: 'gezondheid', deadline: null, created_at: '', ...over,
  }
}

function achievement(over: Partial<Achievement> = {}): Achievement {
  return { id: 163, user_id: 'u', date: '2026-08-20', text: 'Zonnepanelen op het dak', cat_id: 'thuis', emoji: '☀️', created_at: '2026-08-20', ...over }
}

function toon(over: Partial<Parameters<typeof VisiTab>[0]> = {}) {
  const onOpenGoal = vi.fn()
  const onOpenAchievements = vi.fn()
  render(
    <VisiTab categories={[cat()]} goals={[goal()]} achievements={[achievement()]} userId="u" weekItems={[]} recurringTasks={[]} projects={[]}
      onOpenGoal={onOpenGoal} onOpenAchievements={onOpenAchievements} {...over} />
  )
  // De Ultieme Visie is nu het startscherm van de tab — meteen zichtbaar.
  return { onOpenGoal, onOpenAchievements }
}

describe('VisiTab — ultieme visie, woordelijk', () => {
  it('toont de volledige tekst, inclusief de exacte zinnen uit het document', () => {
    toon()
    expect(screen.getByText(/Als ik mijn domijn binnenkom voel ik me meteen thuis/)).toBeTruthy()
    expect(screen.getByText(/Een echte professionele studio\./)).toBeTruthy()
    expect(screen.getByText(/We hebben een gemeenschap\.\./)).toBeTruthy()
    expect(screen.getByText(/En ik weet en voel dat ik een positieve impact maak/)).toBeTruthy()
  })
})

describe('VisiTab — klikbare woorden in de visie', () => {
  it('"kinderen" verwijst naar het levensgebied, als dat bestaat', () => {
    toon()
    const link = screen.getByTitle('Naar levensgebied "Kinderen"')
    expect(link.textContent).toBe('kinderen')
    fireEvent.click(link)
    // Klikken schakelt de sidebar naar dat levensgebied — de detailkop verschijnt.
    expect(screen.getByText('Levensgebied')).toBeTruthy()
  })

  it('"Fysiek voel ik me topfit" verwijst naar het meerjarendoel, als dat bestaat', () => {
    const { onOpenGoal } = toon()
    const link = screen.getByTitle('Naar dit meerjarendoel')
    fireEvent.click(link)
    expect(onOpenGoal).toHaveBeenCalledWith(60)
  })

  it('"zonnepanelen" verwijst naar de achievement, als die bestaat', () => {
    const { onOpenAchievements } = toon()
    const link = screen.getByTitle('Al gehaald — zie je prestaties')
    expect(link.textContent).toBe('zonnepanelen')
    fireEvent.click(link)
    expect(onOpenAchievements).toHaveBeenCalledTimes(1)
  })

  it('laat een woord gewoon platte tekst als er niets voor bestaat om naartoe te linken', () => {
    toon({ categories: [], goals: [], achievements: [] })
    expect(screen.queryByTitle(/Naar levensgebied/)).toBeNull()
    expect(screen.queryByTitle('Naar dit meerjarendoel')).toBeNull()
    expect(screen.queryByTitle('Al gehaald — zie je prestaties')).toBeNull()
    // De tekst zelf staat er nog gewoon, alleen niet klikbaar
    expect(screen.getByText(/Fysiek voel ik me topfit/)).toBeTruthy()
  })
})
