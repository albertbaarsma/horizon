import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetBearerToken     = vi.fn()
const mockGetUserIdFromToken = vi.fn()
const mockInsert = vi.fn()
const mockListResult = vi.fn()

vi.mock('@/lib/ai-api-auth', () => ({
  getBearerToken:     (...a: unknown[]) => mockGetBearerToken(...a),
  getUserIdFromToken: (...a: unknown[]) => mockGetUserIdFromToken(...a),
  adminClient: () => ({
    from: (table: string) => {
      if (table !== 'diary_entries') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit: () => mockListResult() }) }) }) }),
        insert: (row: unknown) => { mockInsert(row); return { select: () => ({ single: () => Promise.resolve({ data: { id: 1, ...(row as object) }, error: null }) }) } },
      }
    },
  }),
}))

const { GET, POST } = await import('../app/api/ai/diary/route')

function makeReq(method: string, opts: { token?: string; body?: unknown; searchParams?: Record<string, string> } = {}) {
  const url = new URL('http://localhost/api/ai/diary')
  if (opts.searchParams) for (const [k, v] of Object.entries(opts.searchParams)) url.searchParams.set(k, v)
  return new NextRequest(url, {
    method,
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetBearerToken.mockReturnValue('tok')
  mockGetUserIdFromToken.mockResolvedValue('uid1')
})

describe('GET /api/ai/diary', () => {
  it('returns 401 without a token', async () => {
    mockGetBearerToken.mockReturnValue(null)
    const res = await GET(makeReq('GET'))
    expect(res.status).toBe(401)
  })

  it('returns recent diary entries', async () => {
    mockListResult.mockResolvedValue({ data: [{ id: 1, date: '2026-08-30', text: 'Goede dag gehad' }], error: null })
    const res = await GET(makeReq('GET', { token: 'tok' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 1, date: '2026-08-30', text: 'Goede dag gehad' }])
  })
})

describe('POST /api/ai/diary', () => {
  it('returns 400 without text', async () => {
    const res = await POST(makeReq('POST', { token: 'tok', body: { date: '2026-08-30' } }))
    expect(res.status).toBe(400)
  })

  it('creates a diary entry', async () => {
    const res = await POST(makeReq('POST', { token: 'tok', body: { text: 'Fijn gesprek met Mika gehad.' } }))
    expect(res.status).toBe(201)
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'uid1', text: 'Fijn gesprek met Mika gehad.' }))
  })

  it('defaults to today when no date is given', async () => {
    await POST(makeReq('POST', { token: 'tok', body: { text: 'Tekst' } }))
    const payload = mockInsert.mock.calls[0][0] as { date: string }
    expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
