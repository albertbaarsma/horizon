import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { AllowanceEntry, AllowanceGoal } from '@/lib/types'

const insertEntryMock = vi.fn()
const deleteEntryMock = vi.fn()
const insertGoalMock  = vi.fn()
const updateGoalMock  = vi.fn()
const deleteGoalMock  = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'allowance_entries') {
        return {
          insert: (payload: unknown) => {
            insertEntryMock(payload)
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 200, user_id: 'u', created_at: '', ...(payload as object) } }) }) }
          },
          delete: () => { deleteEntryMock(); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) } },
        }
      }
      if (table === 'allowance_goals') {
        return {
          insert: (payload: unknown) => {
            insertGoalMock(payload)
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 300, user_id: 'u', achieved: false, created_at: '', ...(payload as object) } }) }) }
          },
          update: (payload: unknown) => { updateGoalMock(payload); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) } },
          delete: () => { deleteGoalMock(); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) } },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

const { default: AllowancePanel } = await import('@/app/finance/AllowancePanel')

beforeEach(() => { vi.clearAllMocks() })

function entry(overrides: Partial<AllowanceEntry> = {}): AllowanceEntry {
  return { id: 1, user_id: 'u', child: 'Robin', amount: 1, description: 'weekgeld', date: '2026-08-20', created_at: '', ...overrides }
}
function goal(overrides: Partial<AllowanceGoal> = {}): AllowanceGoal {
  return { id: 1, user_id: 'u', child: 'Robin', title: 'LEGO-set', url: null, target_amount: 30, achieved: false, created_at: '', ...overrides }
}

describe('AllowancePanel — basis', () => {
  it('toont altijd Robin en Sam, ook zonder data', () => {
    render(<AllowancePanel userId="u" entries={[]} setEntries={vi.fn()} goals={[]} setGoals={vi.fn()} />)
    expect(screen.getByText('Robin')).toBeInTheDocument()
    expect(screen.getByText('Sam')).toBeInTheDocument()
  })

  it('telt de entries van een kind op tot een saldo', () => {
    render(<AllowancePanel userId="u" entries={[
      entry({ id: 1, child: 'Robin', amount: 1 }),
      entry({ id: 2, child: 'Robin', amount: 1 }),
      entry({ id: 3, child: 'Robin', amount: -0.5 }),
    ]} setEntries={vi.fn()} goals={[]} setGoals={vi.fn()} />)
    expect(screen.getByText('€ 1,50')).toBeInTheDocument()
  })

  it('houdt Robin en Sam gescheiden', () => {
    render(<AllowancePanel userId="u" entries={[
      entry({ id: 1, child: 'Robin', amount: 5 }),
      entry({ id: 2, child: 'Sam', amount: 3 }),
    ]} setEntries={vi.fn()} goals={[]} setGoals={vi.fn()} />)
    expect(screen.getByText('€ 5,00')).toBeInTheDocument()
    expect(screen.getByText('€ 3,00')).toBeInTheDocument()
  })
})

describe('AllowancePanel — mutatie toevoegen', () => {
  it('voegt een positief bedrag toe bij "+ erbij"', async () => {
    render(<AllowancePanel userId="u" entries={[]} setEntries={vi.fn()} goals={[]} setGoals={vi.fn()} />)
    const amountInputs = screen.getAllByPlaceholderText('0,00')
    fireEvent.change(amountInputs[0], { target: { value: '1' } })
    const descInputs = screen.getAllByPlaceholderText('Waarvoor? (optioneel)')
    fireEvent.change(descInputs[0], { target: { value: 'weekgeld' } })
    const addButtons = screen.getAllByText('+').filter(b => b.tagName === 'BUTTON')
    fireEvent.click(addButtons[0])
    await waitFor(() => expect(insertEntryMock).toHaveBeenCalledWith(expect.objectContaining({ child: 'Robin', amount: 1, description: 'weekgeld' })))
  })

  it('voegt een negatief bedrag toe bij "− uitgegeven"', async () => {
    render(<AllowancePanel userId="u" entries={[]} setEntries={vi.fn()} goals={[]} setGoals={vi.fn()} />)
    fireEvent.click(screen.getAllByText('− uitgegeven')[0])
    fireEvent.change(screen.getAllByPlaceholderText('0,00')[0], { target: { value: '2,50' } })
    const addButtons = screen.getAllByText('+').filter(b => b.tagName === 'BUTTON')
    fireEvent.click(addButtons[0])
    await waitFor(() => expect(insertEntryMock).toHaveBeenCalledWith(expect.objectContaining({ child: 'Robin', amount: -2.5 })))
  })

  it('verwijdert een entry', () => {
    render(<AllowancePanel userId="u" entries={[entry()]} setEntries={vi.fn()} goals={[]} setGoals={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Verwijderen'))
    expect(deleteEntryMock).toHaveBeenCalled()
  })
})

describe('AllowancePanel — spaardoelen', () => {
  it('toont een spaardoel met streefbedrag en voortgang', () => {
    render(<AllowancePanel userId="u" entries={[entry({ child: 'Robin', amount: 15 })]} setEntries={vi.fn()}
      goals={[goal({ child: 'Robin', title: 'LEGO-set', target_amount: 30 })]} setGoals={vi.fn()} />)
    expect(screen.getByText('LEGO-set')).toBeInTheDocument()
    expect(screen.getByText('€ 30,00')).toBeInTheDocument()
  })

  it('toont een spaardoel als link als er een url is', () => {
    render(<AllowancePanel userId="u" entries={[]} setEntries={vi.fn()}
      goals={[goal({ url: 'https://example.com/lego' })]} setGoals={vi.fn()} />)
    const link = screen.getByText('LEGO-set') as HTMLAnchorElement
    expect(link.tagName).toBe('A')
    expect(link.href).toBe('https://example.com/lego')
  })

  it('voegt een nieuw spaardoel toe', async () => {
    render(<AllowancePanel userId="u" entries={[]} setEntries={vi.fn()} goals={[]} setGoals={vi.fn()} />)
    fireEvent.change(screen.getAllByPlaceholderText('Nieuw spaardoel…')[0], { target: { value: 'Nieuwe fiets' } })
    fireEvent.change(screen.getAllByPlaceholderText('€')[0], { target: { value: '150' } })
    const addButtons = screen.getAllByText('+').filter(b => b.tagName === 'BUTTON')
    // Laatste "+"-knop per kaart hoort bij het spaardoel-formulier (na de mutatie-knop).
    fireEvent.click(addButtons[1])
    await waitFor(() => expect(insertGoalMock).toHaveBeenCalledWith(expect.objectContaining({ child: 'Robin', title: 'Nieuwe fiets', target_amount: 150 })))
  })

  it('markeert een spaardoel als gehaald', async () => {
    render(<AllowancePanel userId="u" entries={[]} setEntries={vi.fn()} goals={[goal()]} setGoals={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Markeer als gehaald'))
    await waitFor(() => expect(updateGoalMock).toHaveBeenCalledWith({ achieved: true }))
  })

  it('verwijdert een spaardoel', () => {
    render(<AllowancePanel userId="u" entries={[]} setEntries={vi.fn()} goals={[goal()]} setGoals={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Verwijderen'))
    expect(deleteGoalMock).toHaveBeenCalled()
  })
})
