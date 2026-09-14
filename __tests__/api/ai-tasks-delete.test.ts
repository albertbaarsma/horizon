/**
 * Tests voor DELETE /api/ai/tasks en uitgebreide edge cases
 * voor GET (status filter), POST (urgent flag) en PATCH (multi-field).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

const { GET, POST, PATCH, DELETE } = await import('../../app/api/ai/tasks/route')

// ── helpers ────────────────────────────────────────────────────────────────
const TOKEN   = 'mcp-test-token'
const USER_ID = 'uid-001'

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

function listChain(tasks: unknown[]) {
  return {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockResolvedValue({ data: tasks, error: null }),
  }
}

function singleChain(data: unknown, err: null | { message: string } = null) {
  return {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: err }),
  }
}

// ══════════════════════════════════════════════════════════════════════════
describe('DELETE /api/ai/tasks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('401 zonder token', async () => {
    const res = await DELETE(req('DELETE', '/api/ai/tasks', { searchParams: { id: '70' } }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Missing token')
  })

  it('401 bij ongeldig token', async () => {
    mockFrom.mockReturnValue(profileFail())
    const res = await DELETE(req('DELETE', '/api/ai/tasks', { token: 'wrong', searchParams: { id: '70' } }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid token')
  })

  it('400 als id ontbreekt', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await DELETE(req('DELETE', '/api/ai/tasks', { token: TOKEN }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/id/)
  })

  it('200 en deleted:true + name bij succesvol verwijderen', async () => {
    mockFrom.mockImplementation((t: string) => {
      if (t === 'profiles') return profileOk()
      return {
        delete: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { name: 'MCP test taak' }, error: null }),
      }
    })
    const res = await DELETE(req('DELETE', '/api/ai/tasks', {
      token: TOKEN, searchParams: { id: '70' },
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.deleted).toBe(true)
    expect(json.name).toBe('MCP test taak')
  })

  it('security: eq wordt aangeroepen met id én user_id', async () => {
    const eqSpy = vi.fn().mockReturnThis()
    mockFrom.mockImplementation((t: string) => {
      if (t === 'profiles') return profileOk()
      return {
        delete: vi.fn().mockReturnThis(),
        eq:     eqSpy,
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { name: 'x' }, error: null }),
      }
    })
    await DELETE(req('DELETE', '/api/ai/tasks', {
      token: TOKEN, searchParams: { id: '42' },
    }))
    const calledKeys = eqSpy.mock.calls.map((c: unknown[]) => c[0])
    expect(calledKeys).toContain('id')
    expect(calledKeys).toContain('user_id')
  })

  it('500 bij databasefout', async () => {
    mockFrom.mockImplementation((t: string) => {
      if (t === 'profiles') return profileOk()
      return {
        delete: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'no rows deleted' } }),
      }
    })
    const res = await DELETE(req('DELETE', '/api/ai/tasks', {
      token: TOKEN, searchParams: { id: '9999' },
    }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('no rows deleted')
  })
})

// ══════════════════════════════════════════════════════════════════════════
describe('GET /api/ai/tasks — statusfilter edge cases', () => {
  beforeEach(() => vi.clearAllMocks())

  it('geeft alle statussen terug zonder filter', async () => {
    const tasks = [
      { id: 1, status: 'backlog' }, { id: 2, status: 'doing' }, { id: 3, status: 'done' },
    ]
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : listChain(tasks))
    const res = await GET(req('GET', '/api/ai/tasks', { token: TOKEN }))
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveLength(3)
  })

  it('filtert correct op status=backlog', async () => {
    const backlog = [{ id: 1, status: 'backlog' }, { id: 2, status: 'backlog' }]
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : listChain(backlog))
    const res = await GET(req('GET', '/api/ai/tasks', {
      token: TOKEN, searchParams: { status: 'backlog' },
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.every((t: { status: string }) => t.status === 'backlog')).toBe(true)
  })

  it('filtert correct op status=doing', async () => {
    const doing = [{ id: 7, status: 'doing', urgent: true }]
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : listChain(doing))
    const res = await GET(req('GET', '/api/ai/tasks', {
      token: TOKEN, searchParams: { status: 'doing' },
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json[0].urgent).toBe(true)
  })

  it('filtert correct op status=done', async () => {
    const done = [{ id: 70, status: 'done', name: 'MCP test taak' }]
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : listChain(done))
    const res = await GET(req('GET', '/api/ai/tasks', {
      token: TOKEN, searchParams: { status: 'done' },
    }))
    const json = await res.json()
    expect(json[0].name).toBe('MCP test taak')
  })

  it('geeft lege array als er geen taken zijn', async () => {
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : listChain([]))
    const res = await GET(req('GET', '/api/ai/tasks', { token: TOKEN }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════
describe('POST /api/ai/tasks — urgent en status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maakt urgent doing-taak aan', async () => {
    const task = { id: 71, proj_id: 'acme-co', name: 'Urgent test', status: 'doing', urgent: true }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(task))
    const res = await POST(req('POST', '/api/ai/tasks', {
      token: TOKEN,
      body: { proj_id: 'acme-co', name: 'Urgent test', status: 'doing', urgent: true },
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.urgent).toBe(true)
    expect(json.status).toBe('doing')
  })

  it('standaard status is "backlog"', async () => {
    const task = { id: 72, proj_id: 'sport', name: 'Sportschool', status: 'backlog', urgent: false }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(task))
    const res = await POST(req('POST', '/api/ai/tasks', {
      token: TOKEN, body: { proj_id: 'sport', name: 'Sportschool' },
    }))
    expect((await res.json()).status).toBe('backlog')
  })

  it('standaard urgent is false', async () => {
    const task = { id: 73, proj_id: 'boerderij', name: 'Schuur opruimen', status: 'backlog', urgent: false }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(task))
    const res = await POST(req('POST', '/api/ai/tasks', {
      token: TOKEN, body: { proj_id: 'boerderij', name: 'Schuur opruimen' },
    }))
    expect((await res.json()).urgent).toBe(false)
  })

  it('400 als proj_id ontbreekt', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await POST(req('POST', '/api/ai/tasks', {
      token: TOKEN, body: { name: 'Zonder project' },
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/proj_id/)
  })

  it('400 als name ontbreekt', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await POST(req('POST', '/api/ai/tasks', {
      token: TOKEN, body: { proj_id: 'sport' },
    }))
    expect(res.status).toBe(400)
  })
})

// ══════════════════════════════════════════════════════════════════════════
describe('PATCH /api/ai/tasks — multi-field updates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('update naam + status + urgent tegelijk', async () => {
    const updated = { id: 71, name: 'Afgerond ✓', status: 'done', urgent: false }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(updated))
    const res = await PATCH(req('PATCH', '/api/ai/tasks', {
      token: TOKEN,
      body: { name: 'Afgerond ✓', status: 'done', urgent: false },
      searchParams: { id: '71' },
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe('Afgerond ✓')
    expect(json.status).toBe('done')
    expect(json.urgent).toBe(false)
  })

  it('markeer als urgent zonder andere velden', async () => {
    const updated = { id: 38, name: 'Afspraak Yoshi', status: 'backlog', urgent: true }
    mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(updated))
    const res = await PATCH(req('PATCH', '/api/ai/tasks', {
      token: TOKEN,
      body: { urgent: true },
      searchParams: { id: '38' },
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).urgent).toBe(true)
  })

  it('statusovergang backlog → doing → done', async () => {
    for (const status of ['doing', 'done'] as const) {
      vi.clearAllMocks()
      const updated = { id: 1, status }
      mockFrom.mockImplementation((t: string) => t === 'profiles' ? profileOk() : singleChain(updated))
      const res = await PATCH(req('PATCH', '/api/ai/tasks', {
        token: TOKEN, body: { status }, searchParams: { id: '1' },
      }))
      expect(res.status).toBe(200)
      expect((await res.json()).status).toBe(status)
    }
  })

  it('400 als id ontbreekt', async () => {
    mockFrom.mockReturnValue(profileOk())
    const res = await PATCH(req('PATCH', '/api/ai/tasks', {
      token: TOKEN, body: { status: 'done' },
    }))
    expect(res.status).toBe(400)
  })
})
