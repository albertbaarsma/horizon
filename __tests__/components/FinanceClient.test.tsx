import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { FinanceEntry } from '@/lib/types'

const insertMock = vi.fn()
const updateMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'finance_entries') throw new Error(`unexpected table ${table}`)
      return {
        insert: (payload: unknown) => {
          insertMock(payload)
          return { select: () => ({ single: () => Promise.resolve({ data: { id: 99, user_id: 'u', ...(payload as object) } }) }) }
        },
        update: (payload: unknown) => { updateMock(payload); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) } },
        delete: () => { deleteMock(); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) } },
      }
    },
  }),
}))

const { default: FinanceClient } = await import('@/app/finance/FinanceClient')

beforeEach(() => { vi.clearAllMocks() })

function entry(overrides: Partial<FinanceEntry> = {}): FinanceEntry {
  return { id: 1, user_id: 'u', person: 'Broer', amount: 125, description: 'Video edit', date: '2026-08-20', settled: false, created_at: '', ...overrides }
}

describe('FinanceClient — leeg', () => {
  it('toont een uitnodiging zonder bedragen', () => {
    render(<FinanceClient userId="u" initialEntries={[]} />)
    expect(screen.getByText(/Nog niets bijgehouden/)).toBeInTheDocument()
  })

  it('toont €0,00 in het overzicht zonder entries', () => {
    render(<FinanceClient userId="u" initialEntries={[]} />)
    expect(screen.getAllByText(/€\s?0,00/).length).toBeGreaterThan(0)
  })
})

describe('FinanceClient — per persoon groeperen en optellen', () => {
  it('telt meerdere entries voor dezelfde persoon bij elkaar op', () => {
    render(<FinanceClient userId="u" initialEntries={[
      entry({ id: 1, person: 'Broer', amount: 125 }),
      entry({ id: 2, person: 'Broer', amount: -25, description: 'Voorschot' }),
    ]} />)
    expect(screen.getByText('+€ 100,00')).toBeInTheDocument()
  })

  it('houdt verschillende personen apart', () => {
    render(<FinanceClient userId="u" initialEntries={[
      entry({ id: 1, person: 'Broer', amount: 125 }),
      entry({ id: 2, person: 'Buurman', amount: -20 }),
    ]} />)
    expect(screen.getByText('Broer')).toBeInTheDocument()
    expect(screen.getByText('Buurman')).toBeInTheDocument()
  })

  it('sluit verrekende entries uit van de nettostand', () => {
    render(<FinanceClient userId="u" initialEntries={[
      entry({ id: 1, person: 'Broer', amount: 125, settled: false }),
      entry({ id: 2, person: 'Broer', amount: 900, settled: true }),
    ]} />)
    // De groepskop (naast de naam "Broer") toont alleen de open 125, niet 125+900.
    // toLocaleString zet een non-breaking space tussen € en het bedrag — daarom een regex.
    const header = screen.getByText('Broer').parentElement!
    expect(header.textContent).toMatch(/\+€\s?125,00/)
    expect(header.textContent).not.toContain('900')
    expect(screen.getByText(/Verrekend \(1\)/)).toBeInTheDocument()
  })
})

describe('FinanceClient — nieuw bedrag toevoegen', () => {
  it('slaat een positief bedrag op bij "is mij schuldig"', async () => {
    render(<FinanceClient userId="u" initialEntries={[]} />)
    fireEvent.change(screen.getByPlaceholderText(/Broer, Buurman/), { target: { value: 'Broer' } })
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '125' } })
    fireEvent.click(screen.getByText('+ Toevoegen'))
    await waitFor(() => expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ person: 'Broer', amount: 125 })))
  })

  it('slaat een negatief bedrag op bij "ik ben schuldig"', async () => {
    render(<FinanceClient userId="u" initialEntries={[]} />)
    fireEvent.change(screen.getByPlaceholderText(/Broer, Buurman/), { target: { value: 'Buurman' } })
    fireEvent.change(screen.getByPlaceholderText('0,00'), { target: { value: '20' } })
    fireEvent.click(screen.getByText('← ik ben schuldig'))
    fireEvent.click(screen.getByText('+ Toevoegen'))
    await waitFor(() => expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ person: 'Buurman', amount: -20 })))
  })

  it('de toevoegknop is uitgeschakeld zonder persoon of bedrag', () => {
    render(<FinanceClient userId="u" initialEntries={[]} />)
    expect(screen.getByText('+ Toevoegen')).toBeDisabled()
  })
})

describe('FinanceClient — tabs', () => {
  it('toont de schulden-tab standaard en wisselt naar transacties', () => {
    render(<FinanceClient userId="u" initialEntries={[entry()]} />)
    expect(screen.getByText('Nieuw bedrag')).toBeInTheDocument()
    expect(screen.queryByText('Afschrift uploaden')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Uitgaven & inkomsten'))
    expect(screen.getByText('Afschrift uploaden')).toBeInTheDocument()
    expect(screen.queryByText('Nieuw bedrag')).not.toBeInTheDocument()
  })

  it('wisselt naar de zakgeld-tab', () => {
    render(<FinanceClient userId="u" initialEntries={[]} />)
    fireEvent.click(screen.getByText('Zakgeld'))
    expect(screen.getByText('Robin')).toBeInTheDocument()
    expect(screen.getByText('Sam')).toBeInTheDocument()
    expect(screen.queryByText('Nieuw bedrag')).not.toBeInTheDocument()
  })
})

describe('FinanceClient — entry beheren', () => {
  it('markeert een entry als verrekend', async () => {
    render(<FinanceClient userId="u" initialEntries={[entry()]} />)
    fireEvent.click(screen.getByTitle('Markeer als verrekend'))
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ settled: true }))
  })

  it('verwijdert een entry', async () => {
    render(<FinanceClient userId="u" initialEntries={[entry()]} />)
    fireEvent.click(screen.getByTitle('Verwijderen'))
    await waitFor(() => expect(deleteMock).toHaveBeenCalled())
  })
})

describe('FinanceClient — embedded (zonder server-load, zelf ophalen)', () => {
  it('haalt zelf zijn data op via /api/finance/data als initialEntries ontbreekt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ entries: [entry({ id: 5, person: 'Zelfopgehaald', amount: 50 })], transactions: [], allowanceEntries: [], allowanceGoals: [] }),
    }))
    render(<FinanceClient userId="u" embedded />)
    expect(screen.getByText(/Financiën laden/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Zelfopgehaald')).toBeInTheDocument())
    expect(fetch).toHaveBeenCalledWith('/api/finance/data')
    vi.unstubAllGlobals()
  })

  it('haalt niets op als initialEntries is meegegeven (server-load, zoals /finance)', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<FinanceClient userId="u" initialEntries={[]} />)
    expect(fetchMock).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('embedded: geen "← Dashboard"-koppeling of volle-pagina-titel', () => {
    render(<FinanceClient userId="u" initialEntries={[]} embedded />)
    expect(screen.queryByText('← Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('💰 Financiën')).not.toBeInTheDocument()
  })

  it('niet-embedded: wel de "← Dashboard"-koppeling', () => {
    render(<FinanceClient userId="u" initialEntries={[]} />)
    expect(screen.getByText('← Dashboard')).toBeInTheDocument()
  })
})
