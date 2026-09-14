import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Category, Goal } from '@/lib/types'

const catUpdate = vi.fn((_payload: unknown) => Promise.resolve({ error: null }))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'categories') {
        return { update: (payload: unknown) => ({ eq: () => ({ eq: () => catUpdate(payload) }) }) }
      }
      // goals: alleen nodig zodat de tab niet crasht als er ooit iets aangemaakt of getoggeld wordt
      return {
        update: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null }) }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }
    },
  }),
}))

const { default: VisiTab } = await import('@/app/dashboard/VisiTab')

beforeEach(() => { vi.clearAllMocks() })

function cat(over: Partial<Category> = {}): Category {
  return { id: 'muziek', user_id: 'u', name: 'Muzikant', ...over }
}

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: 1, user_id: 'u', horizon: 'kwartaal', text: 'Album afmaken', done: false,
    cat_id: 'muziek', deadline: null, created_at: '', ...over,
  }
}

function toon(over: Partial<Parameters<typeof VisiTab>[0]> = {}) {
  const onOpenGoal = vi.fn()
  const categories = over.categories ?? [cat()]
  render(
    // De Ultieme Visie is nu het startscherm; focusCatId opent meteen het levensgebied dat deze tests verwachten.
    <VisiTab categories={categories} goals={[]} userId="u" weekItems={[]} recurringTasks={[]} projects={[]}
      focusCatId={categories[0]?.id ?? null}
      onOpenGoal={onOpenGoal} {...over} />
  )
  return { onOpenGoal }
}

describe('VisiTab — notities per levensgebied', () => {
  it('toont een Notities-veld met placeholder', () => {
    toon()
    expect(screen.getByText(/Losse gedachten over dit levensgebied/)).toBeTruthy()
  })

  it('bewaart wat je erin schrijft', async () => {
    toon({ categories: [cat({ notes: null })] })
    fireEvent.click(screen.getByText(/Losse gedachten over dit levensgebied/))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Denk aan het festival in juni' } })
    fireEvent.blur(screen.getByRole('textbox'))
    await waitFor(() => expect(catUpdate).toHaveBeenCalledWith({ notes: 'Denk aan het festival in juni' }))
  })
})

describe('VisiTab — alle horizonnen per levensgebied', () => {
  it('toont week, 6 weken, kwartaal, jaar en de langetermijn-horizonnen — niet "90-dagen"', () => {
    toon()
    for (const label of ['Deze week doelen', '6 weken doelen', 'Kwartaal doelen', 'Dit jaar doelen', '2-4 jaar doelen', '5-9 jaar doelen', '10+ jaar doelen', 'Ooit / misschien doelen']) {
      expect(screen.getByText(label), label).toBeTruthy()
    }
    expect(screen.queryByText(/90-Dagen/)).toBeNull()
    expect(screen.queryByText(/90 dagen/)).toBeNull()
  })

  it('zet een doel in de sectie van zijn eigen horizon', () => {
    toon({ goals: [goal({ horizon: '6w', text: 'Setlist oefenen' })] })
    // De kop zit in zijn eigen span; de sectie (kop + doelen) is een niveau hoger.
    const sectie = screen.getByText('6 weken doelen').closest('div')!.parentElement!
    expect(sectie.textContent).toContain('Setlist oefenen')
  })

  it('geen "nu"-sectie — die hoort bij de dag, niet bij een levensgebied', () => {
    toon()
    expect(screen.queryByText(/^Nu doelen$/)).toBeNull()
  })
})

describe('VisiTab — een doel openen', () => {
  it('klik op een doel opent het, los van het vinkje', () => {
    const { onOpenGoal } = toon({ goals: [goal()] })
    fireEvent.click(screen.getByText('Album afmaken'))
    expect(onOpenGoal).toHaveBeenCalledWith(1)
  })

  it('klik op het vinkje opent het doel niet', () => {
    const { onOpenGoal } = toon({ goals: [goal()] })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onOpenGoal).not.toHaveBeenCalled()
  })
})
