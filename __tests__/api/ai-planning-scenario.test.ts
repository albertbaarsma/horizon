/**
 * Scenario test: simuleert reëel gebruik van de AI planning API.
 *
 * Test flow (gebaseerd op echte gebruikerssessie):
 * 1. Verwijder een fout weekitem (European Ecovillage)
 * 2. Voeg een taak toe voor morgen (stenen leggen)
 * 3. Voeg afvalbak-herinneringen toe op juiste data
 * 4. Haal weekplanning op voor datumbereik en verifieer items
 * 5. Markeer een item als afgevinkt (done)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase mock ──────────────────────────────────────────────────────────
const mockSingle = vi.fn()
let mockQueryResult: { data: unknown; error: null | { message: string } } = { data: [], error: null }

const makeChain = () => {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'gte', 'lte', 'order', 'limit']
  for (const m of methods) chain[m] = vi.fn(() => chain)
  chain['single'] = mockSingle
  // terminal methods that resolve the query
  ;(chain['order'] as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const ordered = { ...chain }
    ordered['order'] = vi.fn(() => ordered)
    ordered['gte'] = vi.fn(() => ordered)
    ordered['lte'] = vi.fn(() => ({
      then: (resolve: (v: unknown) => void) => resolve(mockQueryResult),
      ...mockQueryResult,
    }))
    // If no gte/lte, resolve directly
    Object.defineProperty(ordered, 'then', {
      get: () => (resolve: (v: unknown) => void) => resolve(mockQueryResult),
    })
    return ordered
  })
  return chain
}

const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { GET, POST, PATCH, DELETE } = await import('../../app/api/ai/week-items/route')

// ── Helpers ────────────────────────────────────────────────────────────────
const TOKEN = 'test-mcp-token'
const USER_ID = 'user-abc-123'

function req(method: string, path: string, opts: {
  token?: string
  body?: unknown
  searchParams?: Record<string, string>
} = {}) {
  const url = new URL('http://localhost' + path)
  if (opts.searchParams) {
    for (const [k, v] of Object.entries(opts.searchParams)) url.searchParams.set(k, v)
  }
  return new NextRequest(url, {
    method,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
}

function profileChain(resolveWith: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: resolveWith, error: null }),
  }
}

function dataChain(resolveWith: unknown, terminal: 'single' | 'array' = 'single') {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }
  if (terminal === 'single') {
    chain['single'] = vi.fn().mockResolvedValue({ data: resolveWith, error: null })
    chain['order'] = vi.fn().mockReturnThis()
  } else {
    // array result: order().gte().lte() or just order() terminates
    const resolved = { data: resolveWith, error: null }
    chain['order'] = vi.fn().mockResolvedValue(resolved)
  }
  return chain
}

// ══════════════════════════════════════════════════════════════════════════
describe('Planningsscenario: weekitems beheren via AI API', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // ── Stap 1: verwijder fout item ──────────────────────────────────────
  it('verwijdert een fout weekitem (bijv. European Ecovillage)', async () => {
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles'
        ? profileChain({ id: USER_ID })
        : dataChain({ text: 'European Ecovillage Gathering' })
    )

    const res = await DELETE(req('DELETE', '/api/ai/week-items', {
      token: TOKEN,
      searchParams: { id: '90' },
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.deleted).toBe(true)
    expect(json.text).toBe('European Ecovillage Gathering')
  })

  // ── Stap 2: taak toevoegen voor morgen ──────────────────────────────
  it('voegt een taak toe voor morgen (stenen leggen)', async () => {
    const newItem = { id: 118, date: '2026-07-13', text: '🪨 Rest vd stenen leggen', type: 'task', done: false }
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles'
        ? profileChain({ id: USER_ID })
        : dataChain(newItem)
    )

    const res = await POST(req('POST', '/api/ai/week-items', {
      token: TOKEN,
      body: { date: '2026-07-13', text: '🪨 Rest vd stenen leggen', type: 'task' },
    }))

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.text).toBe('🪨 Rest vd stenen leggen')
    expect(json.date).toBe('2026-07-13')
  })

  // ── Stap 3: afvalbak-herinneringen op correcte data ─────────────────
  it('voegt afvalbak-herinneringen toe op de dag vóór ophaling', async () => {
    const reminders = [
      { date: '2026-07-19', text: '♻️ Gft container buiten zetten' },
      { date: '2026-07-27', text: '🗑️ Restafval container buiten zetten' },
      { date: '2026-08-02', text: '♻️ Gft container buiten zetten' },
      { date: '2026-08-06', text: '📦 PMD container buiten zetten' },
      { date: '2026-08-16', text: '♻️ Gft container buiten zetten' },
    ]

    for (const [i, reminder] of reminders.entries()) {
      vi.clearAllMocks()
      mockFrom.mockImplementation((table: string) =>
        table === 'profiles'
          ? profileChain({ id: USER_ID })
          : dataChain({ id: 119 + i, ...reminder, type: 'task', done: false })
      )

      const res = await POST(req('POST', '/api/ai/week-items', {
        token: TOKEN,
        body: { ...reminder, type: 'task' },
      }))

      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.date).toBe(reminder.date)
      expect(json.text).toBe(reminder.text)
    }
  })

  // ── Stap 4: weekplanning ophalen en verifiëren ───────────────────────
  it('haalt weekplanning op voor een datumbereik en geeft de juiste items terug', async () => {
    const items = [
      { id: 118, date: '2026-07-13', text: '🪨 Rest vd stenen leggen', type: 'task', done: false },
      { id: 119, date: '2026-07-19', text: '♻️ Gft container buiten zetten', type: 'task', done: false },
      { id: 120, date: '2026-07-27', text: '🗑️ Restafval container buiten zetten', type: 'task', done: false },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileChain({ id: USER_ID })
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: items, error: null }),
      }
    })

    const res = await GET(req('GET', '/api/ai/week-items', {
      token: TOKEN,
      searchParams: { from: '2026-07-13', to: '2026-07-31' },
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json).toHaveLength(3)
    expect(json[0].text).toBe('🪨 Rest vd stenen leggen')
    expect(json[1].date).toBe('2026-07-19')
  })

  // ── Stap 5: item afvinken ────────────────────────────────────────────
  it('markeert een weekitem als done na het uitvoeren', async () => {
    const updated = { id: 118, date: '2026-07-13', text: '🪨 Rest vd stenen leggen', type: 'task', done: true }
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles'
        ? profileChain({ id: USER_ID })
        : dataChain(updated)
    )

    const res = await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN,
      body: { done: true },
      searchParams: { id: '118' },
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.done).toBe(true)
  })

  // ── Auth-guards ──────────────────────────────────────────────────────
  it('weigert verzoeken zonder token (401)', async () => {
    const [r1, r2, r3, r4] = await Promise.all([
      GET(req('GET', '/api/ai/week-items')),
      POST(req('POST', '/api/ai/week-items', { body: { date: '2026-07-13', text: 'x' } })),
      PATCH(req('PATCH', '/api/ai/week-items', { searchParams: { id: '1' } })),
      DELETE(req('DELETE', '/api/ai/week-items', { searchParams: { id: '1' } })),
    ])
    expect(r1.status).toBe(401)
    expect(r2.status).toBe(401)
    expect(r3.status).toBe(401)
    expect(r4.status).toBe(401)
  })

  it('weigert POST zonder date of text (400)', async () => {
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileChain({ id: USER_ID }) : dataChain(null)
    )
    const res = await POST(req('POST', '/api/ai/week-items', {
      token: TOKEN,
      body: { text: 'Geen datum' },
    }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/date/)
  })

  it('weigert PATCH zonder velden om bij te werken (400)', async () => {
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileChain({ id: USER_ID }) : dataChain(null)
    )
    const res = await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN,
      body: {},
      searchParams: { id: '1' },
    }))
    expect(res.status).toBe(400)
  })
})
