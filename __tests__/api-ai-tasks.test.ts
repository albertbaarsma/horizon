import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock Supabase ──────────────────────────────────────────────────────────
const mockSingle = vi.fn()
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()

// Chain builder — each method returns itself so calls can chain
function chainable(terminal: Record<string, unknown> = {}) {
  const obj: Record<string, unknown> = {
    select: vi.fn(() => obj),
    insert: vi.fn(() => obj),
    update: vi.fn(() => obj),
    eq:     vi.fn(() => obj),
    order:  vi.fn(() => obj),
    single: mockSingle,
    ...terminal,
  }
  // Reassign inner refs so spies are consistent
  mockSelect.mockReturnValue(obj)
  mockInsert.mockReturnValue(obj)
  mockUpdate.mockReturnValue(obj)
  mockEq.mockReturnValue(obj)
  mockOrder.mockReturnValue(obj)
  return obj
}

const mockFrom = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}))

// ── Import route handlers AFTER mock ──────────────────────────────────────
const { GET, POST, PATCH } = await import('../app/api/ai/tasks/route')

// ── Helpers ───────────────────────────────────────────────────────────────
const VALID_TOKEN = 'test-token-abc'
const USER_ID = 'user-uuid-123'

function makeReq(method: string, path: string, opts: {
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

// ── Token lookup mock ──────────────────────────────────────────────────────
function setupValidToken() {
  // First call to `from` is the token lookup (profiles)
  // Subsequent calls are data queries
  mockFrom.mockImplementation((table: string) => {
    const chain = chainable()
    if (table === 'profiles') {
      mockSingle.mockResolvedValueOnce({ data: { id: USER_ID }, error: null })
    }
    return chain
  })
}

function setupInvalidToken() {
  mockFrom.mockImplementation(() => {
    const chain = chainable()
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
    return chain
  })
}

// ══════════════════════════════════════════════════════════════════════════
describe('GET /api/ai/tasks', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when no Authorization header', async () => {
    const res = await GET(makeReq('GET', '/api/ai/tasks'))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Missing token')
  })

  it('returns 401 for invalid token', async () => {
    setupInvalidToken()
    const res = await GET(makeReq('GET', '/api/ai/tasks', { token: 'wrong' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Invalid token')
  })

  it('returns tasks for valid token', async () => {
    const tasks = [{ id: 1, name: 'Test taak', status: 'doing' }]
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: USER_ID }, error: null }) }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: tasks, error: null }),
      }
    })
    const res = await GET(makeReq('GET', '/api/ai/tasks', { token: VALID_TOKEN }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json)).toBe(true)
  })

  it('filters by status param', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: USER_ID }, error: null }) }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    })
    const res = await GET(makeReq('GET', '/api/ai/tasks', {
      token: VALID_TOKEN,
      searchParams: { status: 'done' },
    }))
    expect(res.status).toBe(200)
  })
})

// ══════════════════════════════════════════════════════════════════════════
describe('POST /api/ai/tasks', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 without token', async () => {
    const res = await POST(makeReq('POST', '/api/ai/tasks', { body: { proj_id: 'x', name: 'y' } }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when proj_id or name is missing', async () => {
    setupValidToken()
    const res = await POST(makeReq('POST', '/api/ai/tasks', {
      token: VALID_TOKEN,
      body: { name: 'Zonder proj_id' },
    }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/proj_id/)
  })

  it('creates a task and returns 201', async () => {
    const newTask = { id: 42, proj_id: 'sport', name: 'Sportschool', status: 'doing', urgent: false }
    mockFrom.mockImplementation((table: string) => {
      const chain = chainable()
      if (table === 'profiles') {
        mockSingle.mockResolvedValueOnce({ data: { id: USER_ID }, error: null })
      } else {
        mockSingle.mockResolvedValueOnce({ data: newTask, error: null })
      }
      return chain
    })
    const res = await POST(makeReq('POST', '/api/ai/tasks', {
      token: VALID_TOKEN,
      body: { proj_id: 'sport', name: 'Sportschool', status: 'doing' },
    }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.name).toBe('Sportschool')
  })
})

// ══════════════════════════════════════════════════════════════════════════
describe('PATCH /api/ai/tasks', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 without token', async () => {
    const res = await PATCH(makeReq('PATCH', '/api/ai/tasks', { searchParams: { id: '1' } }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when id param is missing', async () => {
    setupValidToken()
    const res = await PATCH(makeReq('PATCH', '/api/ai/tasks', {
      token: VALID_TOKEN,
      body: { status: 'done' },
    }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/id/)
  })

  it('updates status and returns the task', async () => {
    const updated = { id: 7, name: 'Bart bellen', status: 'done', urgent: false }
    mockFrom.mockImplementation((table: string) => {
      const chain = chainable()
      if (table === 'profiles') {
        mockSingle.mockResolvedValueOnce({ data: { id: USER_ID }, error: null })
      } else {
        mockSingle.mockResolvedValueOnce({ data: updated, error: null })
      }
      return chain
    })
    const res = await PATCH(makeReq('PATCH', '/api/ai/tasks', {
      token: VALID_TOKEN,
      body: { status: 'done' },
      searchParams: { id: '7' },
    }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('done')
  })

  it('ignores unknown fields in body', async () => {
    const updated = { id: 7, name: 'Bart bellen', status: 'doing', urgent: false }
    mockFrom.mockImplementation((table: string) => {
      const chain = chainable()
      if (table === 'profiles') {
        mockSingle.mockResolvedValueOnce({ data: { id: USER_ID }, error: null })
      } else {
        mockSingle.mockResolvedValueOnce({ data: updated, error: null })
      }
      return chain
    })
    const res = await PATCH(makeReq('PATCH', '/api/ai/tasks', {
      token: VALID_TOKEN,
      body: { status: 'doing', hacker_field: 'injected', user_id: 'evil' },
      searchParams: { id: '7' },
    }))
    expect(res.status).toBe(200)
  })

  it('allows moving a task to a different project (recategorizing)', async () => {
    let tasksChain: { update: ReturnType<typeof vi.fn> } | null = null
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const chain = chainable()
        mockSingle.mockResolvedValueOnce({ data: { id: USER_ID }, error: null })
        return chain
      }
      const chain = chainable()
      mockSingle.mockResolvedValueOnce({ data: { id: 7, proj_id: 'sport' }, error: null })
      tasksChain = chain as unknown as { update: ReturnType<typeof vi.fn> }
      return chain
    })
    const res = await PATCH(makeReq('PATCH', '/api/ai/tasks', {
      token: VALID_TOKEN,
      body: { proj_id: 'sport' },
      searchParams: { id: '7' },
    }))
    expect(res.status).toBe(200)
    expect(tasksChain!.update).toHaveBeenCalledWith(expect.objectContaining({ proj_id: 'sport' }))
  })

  it('clamps priority to 0-5 on update', async () => {
    let tasksChain: { update: ReturnType<typeof vi.fn> } | null = null
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const chain = chainable()
        mockSingle.mockResolvedValueOnce({ data: { id: USER_ID }, error: null })
        return chain
      }
      const chain = chainable()
      mockSingle.mockResolvedValueOnce({ data: { id: 7, priority: 5 }, error: null })
      tasksChain = chain as unknown as { update: ReturnType<typeof vi.fn> }
      return chain
    })
    const res = await PATCH(makeReq('PATCH', '/api/ai/tasks', {
      token: VALID_TOKEN,
      body: { priority: 99 },
      searchParams: { id: '7' },
    }))
    expect(res.status).toBe(200)
    expect(tasksChain!.update).toHaveBeenCalledWith(expect.objectContaining({ priority: 5 }))
  })
})

describe('POST /api/ai/tasks — priority', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('clamps an out-of-range priority on create', async () => {
    let tasksChain: { insert: ReturnType<typeof vi.fn> } | null = null
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        const chain = chainable()
        mockSingle.mockResolvedValueOnce({ data: { id: USER_ID }, error: null })
        return chain
      }
      const chain = chainable()
      mockSingle.mockResolvedValueOnce({ data: { id: 8, priority: 0 }, error: null })
      tasksChain = chain as unknown as { insert: ReturnType<typeof vi.fn> }
      return chain
    })
    const res = await POST(makeReq('POST', '/api/ai/tasks', {
      token: VALID_TOKEN,
      body: { proj_id: 'sport', name: 'Nieuwe taak', priority: -3 },
    }))
    expect(res.status).toBe(201)
    expect(tasksChain!.insert).toHaveBeenCalledWith(expect.objectContaining({ priority: 0 }))
  })
})
