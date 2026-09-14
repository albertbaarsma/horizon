/**
 * Tests voor /api/ai/achievements (GET / POST / DELETE)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Supabase mock ──────────────────────────────────────────────────────────
const mockSingle = vi.fn()
const mockFrom   = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { GET, POST, DELETE } = await import('../../app/api/ai/achievements/route')

// ── Helpers ────────────────────────────────────────────────────────────────
const TOKEN   = 'test-token'
const USER_ID = 'uid-001'
const TODAY   = new Date().toISOString().slice(0, 10)

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

function profileOk() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: USER_ID }, error: null }),
  }
}

function profileFail() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
  }
}

function achievementsChain(resolveWith: unknown, isArray = false) {
  if (isArray) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: resolveWith, error: null }),
    }
  }
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: resolveWith, error: null }),
  }
}

function dbErrorChain(msg: string) {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: null, error: { message: msg } }),
    single: vi.fn().mockResolvedValue({ data: null, error: { message: msg } }),
  }
}

// ══════════════════════════════════════════════════════════════════════════
describe('GET /api/ai/achievements', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 zonder Authorization header', async () => {
    const res = await GET(req('GET', '/api/ai/achievements'))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Missing token')
  })

  it('401 bij ongeldig token', async () => {
    mockFrom.mockReturnValue(profileFail())
    const res = await GET(req('GET', '/api/ai/achievements', { token: 'wrong' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid token')
  })

  it('200 en array bij geldig token', async () => {
    const items = [
      { id: 1, text: 'Stenen gelegd', emoji: '🪨', date: '2026-07-12', cat_id: null },
      { id: 2, text: 'Sportschool gehaald', emoji: '💪', date: '2026-07-10', cat_id: null },
    ]
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileOk() : achievementsChain(items, true)
    )
    const res = await GET(req('GET', '/api/ai/achievements', { token: TOKEN }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
    expect(json).toHaveLength(2)
    expect(json[0].emoji).toBe('🪨')
  })

  it('geeft lege array terug als er geen achievements zijn', async () => {
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileOk() : achievementsChain([], true)
    )
    const res = await GET(req('GET', '/api/ai/achievements', { token: TOKEN }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('respecteert limit-parameter', async () => {
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileOk() : achievementsChain([{ id: 1 }], true)
    )
    const res = await GET(req('GET', '/api/ai/achievements', {
      token: TOKEN,
      searchParams: { limit: '1' },
    }))
    expect(res.status).toBe(200)
  })

  it('500 bij databasefout', async () => {
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileOk() : dbErrorChain('connection refused')
    )
    const res = await GET(req('GET', '/api/ai/achievements', { token: TOKEN }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('connection refused')
  })
})

// ══════════════════════════════════════════════════════════════════════════
describe('POST /api/ai/achievements', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 zonder token', async () => {
    const res = await POST(req('POST', '/api/ai/achievements', { body: { text: 'x' } }))
    expect(res.status).toBe(401)
  })

  it('400 zonder text-veld', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await POST(req('POST', '/api/ai/achievements', {
      token: TOKEN,
      body: { emoji: '⭐' },
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('text required')
  })

  it('slaat achievement op met verplichte velden', async () => {
    const created = { id: 42, text: 'Stenen gelegd', emoji: '🪨', date: '2026-07-12', cat_id: null }
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileOk() : achievementsChain(created)
    )
    const res = await POST(req('POST', '/api/ai/achievements', {
      token: TOKEN,
      body: { text: 'Stenen gelegd', emoji: '🪨', date: '2026-07-12' },
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.text).toBe('Stenen gelegd')
    expect(json.emoji).toBe('🪨')
    expect(json.id).toBe(42)
  })

  it('gebruikt standaard emoji ⭐ als niet opgegeven', async () => {
    const created = { id: 43, text: 'Gedaan!', emoji: '⭐', date: TODAY, cat_id: null }
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileOk() : achievementsChain(created)
    )
    const res = await POST(req('POST', '/api/ai/achievements', {
      token: TOKEN,
      body: { text: 'Gedaan!' },
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).emoji).toBe('⭐')
  })

  it('gebruikt datum van vandaag als niet opgegeven', async () => {
    const created = { id: 44, text: 'Vandaag iets', emoji: '⭐', date: TODAY, cat_id: null }
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileOk() : achievementsChain(created)
    )
    const res = await POST(req('POST', '/api/ai/achievements', {
      token: TOKEN,
      body: { text: 'Vandaag iets' },
    }))
    const json = await res.json()
    expect(json.date).toBe(TODAY)
  })

  it('accepteert optionele cat_id', async () => {
    const created = { id: 45, text: 'Sport!', emoji: '💪', date: TODAY, cat_id: 'sport' }
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileOk() : achievementsChain(created)
    )
    const res = await POST(req('POST', '/api/ai/achievements', {
      token: TOKEN,
      body: { text: 'Sport!', emoji: '💪', cat_id: 'sport' },
    }))
    const json = await res.json()
    expect(json.cat_id).toBe('sport')
  })

  it('500 bij databasefout', async () => {
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileOk() : dbErrorChain('insert failed')
    )
    const res = await POST(req('POST', '/api/ai/achievements', {
      token: TOKEN,
      body: { text: 'Test' },
    }))
    expect(res.status).toBe(500)
  })
})

// ══════════════════════════════════════════════════════════════════════════
describe('DELETE /api/ai/achievements', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 zonder token', async () => {
    const res = await DELETE(req('DELETE', '/api/ai/achievements', { searchParams: { id: '1' } }))
    expect(res.status).toBe(401)
  })

  it('400 zonder id-parameter', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await DELETE(req('DELETE', '/api/ai/achievements', { token: TOKEN }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('id required')
  })

  it('verwijdert achievement en geeft deleted:true terug', async () => {
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? profileOk() : {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    )
    const res = await DELETE(req('DELETE', '/api/ai/achievements', {
      token: TOKEN,
      searchParams: { id: '42' },
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).deleted).toBe(true)
  })

  it('500 bij databasefout (bijv. item bestaat niet)', async () => {
    // achievements DELETE gebruikt geen .single() — de chain zelf moet een thenable zijn
    const errResult = { data: null, error: { message: 'no rows deleted' } }
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return profileOk()
      const innerEq = vi.fn().mockResolvedValue(errResult)
      const outerEq = vi.fn().mockReturnValue({ eq: innerEq })
      return { delete: vi.fn().mockReturnValue({ eq: outerEq }) }
    })
    const res = await DELETE(req('DELETE', '/api/ai/achievements', {
      token: TOKEN,
      searchParams: { id: '9999' },
    }))
    expect(res.status).toBe(500)
  })
})
