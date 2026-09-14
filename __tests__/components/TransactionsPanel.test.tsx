import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { FinanceTransaction } from '@/lib/types'

const insertMock = vi.fn()
const deleteMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'finance_transactions') throw new Error(`unexpected table ${table}`)
      return {
        insert: (payload: unknown) => {
          insertMock(payload)
          const rows = (payload as Record<string, unknown>[]).map((r, i) => ({ id: 100 + i, user_id: 'u', created_at: '', source: null, ...r }))
          return { select: () => Promise.resolve({ data: rows, error: null }) }
        },
        delete: () => { deleteMock(); return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) } },
      }
    },
  }),
}))

const { default: TransactionsPanel } = await import('@/app/finance/TransactionsPanel')

beforeEach(() => { vi.clearAllMocks() })

function tx(overrides: Partial<FinanceTransaction> = {}): FinanceTransaction {
  return { id: 1, user_id: 'u', date: '2026-08-03', description: 'Albert Heijn', amount: -23.45, category: 'Boodschappen', source: null, created_at: '', ...overrides }
}

function uploadFile() {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  const file = new File(['%PDF-1.4'], 'afschrift.pdf', { type: 'application/pdf' })
  fireEvent.change(input, { target: { files: [file] } })
}

describe('TransactionsPanel — maandoverzicht', () => {
  it('toont een lege staat zonder transacties', () => {
    render(<TransactionsPanel userId="u" transactions={[]} setTransactions={vi.fn()} />)
    expect(screen.getByText(/Nog geen transacties voor deze maand/)).toBeInTheDocument()
  })

  it('telt inkomsten en uitgaven van de huidige maand apart op', () => {
    const now = new Date().toISOString().slice(0, 7)
    render(<TransactionsPanel userId="u" transactions={[
      tx({ id: 1, date: `${now}-03`, amount: -23.45, category: 'Boodschappen' }),
      tx({ id: 2, date: `${now}-05`, amount: 2000, category: 'Inkomen' }),
    ]} setTransactions={vi.fn()} />)
    expect(screen.getAllByText(/€\s?2\.000,00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/€\s?23,45/).length).toBeGreaterThan(0)
  })

  it('negeert transacties buiten de geselecteerde maand', () => {
    render(<TransactionsPanel userId="u" transactions={[tx({ date: '2020-01-15' })]} setTransactions={vi.fn()} />)
    expect(screen.getByText(/Nog geen transacties voor deze maand/)).toBeInTheDocument()
  })
})

describe('TransactionsPanel — afschrift uploaden', () => {
  it('stuurt het PDF-bestand naar de parse-endpoint en toont een reviewlijst', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ transactions: [{ date: '2026-08-03', description: 'Albert Heijn', amount: -23.45, category: 'Boodschappen' }] }),
    }))
    render(<TransactionsPanel userId="u" transactions={[]} setTransactions={vi.fn()} />)
    uploadFile()
    await waitFor(() => expect(screen.getByText('Albert Heijn')).toBeInTheDocument())
    expect(screen.getByText(/Importeren \(1\)/)).toBeInTheDocument()
  })

  it('vinkt een al aanwezige transactie standaard uit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ transactions: [{ date: '2026-08-03', description: 'Albert Heijn', amount: -23.45, category: 'Boodschappen' }] }),
    }))
    render(<TransactionsPanel userId="u" transactions={[tx()]} setTransactions={vi.fn()} />)
    uploadFile()
    await waitFor(() => expect(screen.getByText(/al aanwezig/)).toBeInTheDocument())
    expect(screen.getByText(/Importeren \(0\)/)).toBeInTheDocument()
  })

  it('toont een foutmelding als de endpoint een error teruggeeft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'Kon het afschrift niet lezen' }) }))
    render(<TransactionsPanel userId="u" transactions={[]} setTransactions={vi.fn()} />)
    uploadFile()
    await waitFor(() => expect(screen.getByText('Kon het afschrift niet lezen')).toBeInTheDocument())
  })

  it('importeert alleen de aangevinkte rijen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ transactions: [{ date: '2026-08-03', description: 'Albert Heijn', amount: -23.45, category: 'Boodschappen' }] }),
    }))
    const setTransactions = vi.fn()
    render(<TransactionsPanel userId="u" transactions={[]} setTransactions={setTransactions} />)
    uploadFile()
    await waitFor(() => expect(screen.getByText(/Importeren \(1\)/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Importeren \(1\)/))
    await waitFor(() => expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({ user_id: 'u', date: '2026-08-03', description: 'Albert Heijn', amount: -23.45, category: 'Boodschappen' }),
    ]))
    await waitFor(() => expect(setTransactions).toHaveBeenCalled())
  })
})

describe('TransactionsPanel — transactie verwijderen', () => {
  it('verwijdert een transactie van de huidige maand', () => {
    const now = new Date().toISOString().slice(0, 7)
    render(<TransactionsPanel userId="u" transactions={[tx({ date: `${now}-03` })]} setTransactions={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Verwijderen'))
    expect(deleteMock).toHaveBeenCalled()
  })
})
