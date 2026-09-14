/**
 * Uitgebreide tests voor /api/ai/week-items (GET / POST / PATCH / DELETE)
 * Dekt: happy path, edge cases, security, foutpaden.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { GET, POST, PATCH, DELETE } = await import('../../app/api/ai/week-items/route')

// ── helpers ────────────────────────────────────────────────────────────────
const TOKEN   = 'mcp-test-token'
const USER_ID = 'uid-test-001'

function req(method: string, path: string, opts: {
  token?: string; body?: unknown; searchParams?: Record<string, string>
} = {}) {
  const url = new URL('http://localhost' + path)
  if (opts.searchParams)
    for (const [k, v] of Object.entries(opts.searchParams)) url.searchParams.set(k, v)
  return new NextRequest(url, {
    method,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
}

const profileOk = () => ({
  select: vi.fn().mockReturnThis(),
  eq:     vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { id: USER_ID }, error: null }),
})

const profileFail = () => ({
  select: vi.fn().mockReturnThis(),
  eq:     vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
})

// Bouwt een chain die eindigt met een array-resultaat (voor GET)
// Ondersteunt: geen filter, from-only, from+to (alle drie worden direct ge-awaited)
function listChain(items: unknown[]) {
  const terminal = { data: items, error: null }
  // lte() → Promise (voor from+to)
  const lte = vi.fn().mockResolvedValue(terminal)
  // gteResult is een thenable (voor from-only) én heeft .lte (voor from+to)
  const gteResult = Object.assign(Promise.resolve(terminal), { lte })
  const gte = vi.fn().mockReturnValue(gteResult)
  // order2Result is een thenable (voor geen filter) én heeft .gte/.lte
  const order2Result = Object.assign(Promise.resolve(terminal), { gte, lte })
  const order2 = vi.fn().mockReturnValue(order2Result)
  return {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnValue({ order: order2 }),
  }
}

// Bouwt een chain die eindigt met .single()
function singleChain(data: unknown, err: null | { message: string } = null) {
  const single = vi.fn().mockResolvedValue({ data, error: err })
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    single,
  }
}

// ══════════════════════════════════════════════════════════════════════════
describe('GET /api/ai/week-items', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 zonder token', async () => {
    const res = await GET(req('GET', '/api/ai/week-items'))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Missing token')
  })

  it('401 bij ongeldig token', async () => {
    mockFrom.mockReturnValue(profileFail())
    const res = await GET(req('GET', '/api/ai/week-items', { token: 'bad' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid token')
  })

  it('200 en array bij geldig token + datumbereik', async () => {
    const items = [
      { id: 118, date: '2026-07-13', text: '🪨 Stenen leggen', type: 'task', done: false },
      { id: 119, date: '2026-07-19', text: '♻️ Gft', type: 'task', done: false },
    ]
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : listChain(items))
    const res = await GET(req('GET', '/api/ai/week-items', {
      token: TOKEN, searchParams: { from: '2026-07-13', to: '2026-07-31' },
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toHaveLength(2)
    expect(json[0].text).toBe('🪨 Stenen leggen')
    expect(json[1].date).toBe('2026-07-19')
  })

  it('200 zonder datumfilter (alle items)', async () => {
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : listChain([{ id: 1 }]))
    const res = await GET(req('GET', '/api/ai/week-items', { token: TOKEN }))
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(1)
  })

  it('200 met alleen from (geen to)', async () => {
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : listChain([]))
    const res = await GET(req('GET', '/api/ai/week-items', {
      token: TOKEN, searchParams: { from: '2026-07-01' },
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('200 met lege array als er geen items zijn in de periode', async () => {
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : listChain([]))
    const res = await GET(req('GET', '/api/ai/week-items', {
      token: TOKEN, searchParams: { from: '2030-01-01', to: '2030-01-07' },
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════
describe('POST /api/ai/week-items', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 zonder token', async () => {
    const res = await POST(req('POST', '/api/ai/week-items', { body: { date: '2026-07-13', text: 'x' } }))
    expect(res.status).toBe(401)
  })

  it('400 als date ontbreekt', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await POST(req('POST', '/api/ai/week-items', { token: TOKEN, body: { text: 'Geen datum' } }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/date/)
  })

  it('400 als text ontbreekt', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await POST(req('POST', '/api/ai/week-items', { token: TOKEN, body: { date: '2026-07-13' } }))
    expect(res.status).toBe(400)
  })

  it('201 met correct item', async () => {
    const item = { id: 118, date: '2026-07-13', text: '🪨 Stenen', type: 'task', done: false }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(item))
    const res = await POST(req('POST', '/api/ai/week-items', {
      token: TOKEN, body: { date: '2026-07-13', text: '🪨 Stenen', type: 'task' },
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe(118)
    expect(json.done).toBe(false)
    expect(json.type).toBe('task')
  })

  it('standaard type is "task" als niet opgegeven', async () => {
    const item = { id: 119, date: '2026-07-14', text: 'Notitie', type: 'task', done: false }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(item))
    const res = await POST(req('POST', '/api/ai/week-items', {
      token: TOKEN, body: { date: '2026-07-14', text: 'Notitie' },
    }))
    expect((await res.json()).type).toBe('task')
  })

  it('type "event" wordt doorgegeven', async () => {
    const item = { id: 120, date: '2026-07-14', text: '14:00 Tandarts', type: 'event', done: false }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(item))
    const res = await POST(req('POST', '/api/ai/week-items', {
      token: TOKEN, body: { date: '2026-07-14', text: '14:00 Tandarts', type: 'event' },
    }))
    expect((await res.json()).type).toBe('event')
  })

  it('type "note" wordt doorgegeven', async () => {
    const item = { id: 121, date: '2026-07-14', text: 'Bellen', type: 'note', done: false }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(item))
    const res = await POST(req('POST', '/api/ai/week-items', {
      token: TOKEN, body: { date: '2026-07-14', text: 'Bellen', type: 'note' },
    }))
    expect((await res.json()).type).toBe('note')
  })

  it('geeft time_block en task_id door aan de database', async () => {
    const chain = singleChain({ id: 122, date: '2026-09-15', text: 'Financiële sessie', type: 'task', done: false, time_block: '09:30', task_id: '175' })
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : chain)
    const res = await POST(req('POST', '/api/ai/week-items', {
      token: TOKEN, body: { date: '2026-09-15', text: 'Financiële sessie', time_block: '09:30', task_id: 175 },
    }))
    expect(res.status).toBe(201)
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ time_block: '09:30', task_id: '175' }))
  })

  it('400 bij een ongeldig tijdblok', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await POST(req('POST', '/api/ai/week-items', {
      token: TOKEN, body: { date: '2026-09-15', text: 'x', time_block: '9 uur' },
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/time_block/)
  })

  it('500 bij databasefout', async () => {
    mockFrom.mockImplementation((t: string) =>
      t === 'profiles' ? profileOk() : singleChain(null, { message: 'constraint violation' })
    )
    const res = await POST(req('POST', '/api/ai/week-items', {
      token: TOKEN, body: { date: '2026-07-13', text: 'Test' },
    }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('constraint violation')
  })
})

// ══════════════════════════════════════════════════════════════════════════
describe('PATCH /api/ai/week-items', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 zonder token', async () => {
    const res = await PATCH(req('PATCH', '/api/ai/week-items', { searchParams: { id: '1' } }))
    expect(res.status).toBe(401)
  })

  it('400 als id ontbreekt', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await PATCH(req('PATCH', '/api/ai/week-items', { token: TOKEN, body: { done: true } }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/id/)
  })

  it('400 als body geen geldige velden bevat (leeg of alleen onbekende keys)', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN, body: {}, searchParams: { id: '1' },
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/No fields/)
  })

  it('400 als body alleen niet-toegestane velden bevat', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN,
      body: { user_id: 'evil', proj_id: 'hack' },
      searchParams: { id: '1' },
    }))
    expect(res.status).toBe(400)
  })

  it('200 done=true (item afvinken)', async () => {
    const updated = { id: 118, done: true, text: '🪨 Stenen', date: '2026-07-13' }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(updated))
    const res = await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN, body: { done: true }, searchParams: { id: '118' },
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).done).toBe(true)
  })

  it('200 verplaatst item naar andere datum', async () => {
    const updated = { id: 116, done: false, text: 'Tandarts', date: '2026-07-15' }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(updated))
    const res = await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN, body: { date: '2026-07-15' }, searchParams: { id: '116' },
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).date).toBe('2026-07-15')
  })

  it('200 update meerdere velden tegelijk', async () => {
    const updated = { id: 116, done: true, text: '10:00 Tandarts verzet', date: '2026-07-15' }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(updated))
    const res = await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN,
      body: { text: '10:00 Tandarts verzet', date: '2026-07-15', done: true },
      searchParams: { id: '116' },
    }))
    const json = await res.json()
    expect(json.text).toBe('10:00 Tandarts verzet')
    expect(json.done).toBe(true)
    expect(json.date).toBe('2026-07-15')
  })

  it('200 zet een tijdblok', async () => {
    const chain = singleChain({ id: 116, time_block: '09:30' })
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : chain)
    const res = await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN, body: { time_block: '09:30' }, searchParams: { id: '116' },
    }))
    expect(res.status).toBe(200)
    expect(chain.update).toHaveBeenCalledWith({ time_block: '09:30' })
  })

  it('200 een lege string haalt het tijdblok weg', async () => {
    const chain = singleChain({ id: 116, time_block: null })
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : chain)
    await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN, body: { time_block: '' }, searchParams: { id: '116' },
    }))
    expect(chain.update).toHaveBeenCalledWith({ time_block: null })
  })

  it('400 bij een ongeldig tijdblok', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN, body: { time_block: '25:00' }, searchParams: { id: '116' },
    }))
    expect(res.status).toBe(400)
  })

  it('security: user_id in body wordt genegeerd (niet in allowed velden)', async () => {
    // done is geldig → 200, maar user_id mag niet in de DB-update belanden
    const updated = { id: 1, done: false, user_id: USER_ID }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(updated))
    const res = await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN,
      body: { done: false, user_id: 'evil-uid', hacker_field: 'injected' },
      searchParams: { id: '1' },
    }))
    expect(res.status).toBe(200)
  })

  it('500 bij databasefout', async () => {
    mockFrom.mockImplementation((t: string) =>
      t === 'profiles' ? profileOk() : singleChain(null, { message: 'row not found' })
    )
    const res = await PATCH(req('PATCH', '/api/ai/week-items', {
      token: TOKEN, body: { done: true }, searchParams: { id: '9999' },
    }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('row not found')
  })
})

// ══════════════════════════════════════════════════════════════════════════
describe('DELETE /api/ai/week-items', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 zonder token', async () => {
    const res = await DELETE(req('DELETE', '/api/ai/week-items', { searchParams: { id: '1' } }))
    expect(res.status).toBe(401)
  })

  it('400 als id ontbreekt', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await DELETE(req('DELETE', '/api/ai/week-items', { token: TOKEN }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/id/)
  })

  it('200 en deleted:true + tekst bij succesvol verwijderen', async () => {
    mockFrom.mockImplementation((t: string) => {
      if (t === 'profiles') return profileOk()
      return {
        delete: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { text: 'European Ecovillage' }, error: null }),
      }
    })
    const res = await DELETE(req('DELETE', '/api/ai/week-items', {
      token: TOKEN, searchParams: { id: '90' },
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.deleted).toBe(true)
    expect(json.text).toBe('European Ecovillage')
  })

  it('security: eq wordt aangeroepen met zowel id als user_id', async () => {
    const eqSpy = vi.fn().mockReturnThis()
    mockFrom.mockImplementation((t: string) => {
      if (t === 'profiles') return profileOk()
      return {
        delete: vi.fn().mockReturnThis(),
        eq:     eqSpy,
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { text: 'x' }, error: null }),
      }
    })
    await DELETE(req('DELETE', '/api/ai/week-items', {
      token: TOKEN, searchParams: { id: '42' },
    }))
    const calledKeys = eqSpy.mock.calls.map((c: unknown[]) => c[0])
    expect(calledKeys).toContain('id')
    expect(calledKeys).toContain('user_id')
  })

  it('500 als item niet bestaat (databasefout)', async () => {
    mockFrom.mockImplementation((t: string) => {
      if (t === 'profiles') return profileOk()
      return {
        delete: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'no rows' } }),
      }
    })
    const res = await DELETE(req('DELETE', '/api/ai/week-items', {
      token: TOKEN, searchParams: { id: '9999' },
    }))
    expect(res.status).toBe(500)
  })
})
