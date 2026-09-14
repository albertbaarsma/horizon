import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetBearerToken     = vi.fn()
const mockGetUserIdFromToken = vi.fn()
const mockUpsert = vi.fn()
const mockSelectResult = vi.fn()

vi.mock('@/lib/ai-api-auth', () => ({
  getBearerToken:     (...a: unknown[]) => mockGetBearerToken(...a),
  getUserIdFromToken: (...a: unknown[]) => mockGetUserIdFromToken(...a),
  adminClient: () => ({
    from: (table: string) => {
      if (table !== 'mood_entries') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({ eq: () => ({ gte: () => ({ order: () => mockSelectResult() }) }) }),
        upsert: (row: unknown) => { mockUpsert(row); return { select: () => ({ single: () => Promise.resolve({ data: { ...(row as object) }, error: null }) }) } },
      }
    },
  }),
}))

const { GET, POST } = await import('../app/api/ai/mood/route')

function makeReq(method: string, opts: { token?: string; body?: unknown; searchParams?: Record<string, string> } = {}) {
  const url = new URL('http://localhost/api/ai/mood')
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

describe('GET /api/ai/mood', () => {
  it('returns 401 without a token', async () => {
    mockGetBearerToken.mockReturnValue(null)
    const res = await GET(makeReq('GET'))
    expect(res.status).toBe(401)
  })

  it('returns 401 for an invalid token', async () => {
    mockGetUserIdFromToken.mockResolvedValue(null)
    const res = await GET(makeReq('GET', { token: 'wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns recent mood entries', async () => {
    mockSelectResult.mockResolvedValue({ data: [{ date: '2026-08-30', mood: 3 }], error: null })
    const res = await GET(makeReq('GET', { token: 'tok' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ date: '2026-08-30', mood: 3 }])
  })
})

describe('POST /api/ai/mood', () => {
  it('returns 400 for an out-of-range mood', async () => {
    const res = await POST(makeReq('POST', { token: 'tok', body: { mood: 25 } }))
    expect(res.status).toBe(400)
  })

  it('upserts on (user_id, date) so re-logging the same day overwrites', async () => {
    const res = await POST(makeReq('POST', { token: 'tok', body: { mood: -4, date: '2026-08-30', energy: 2, note: 'moe' } }))
    expect(res.status).toBe(201)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'uid1', mood: -4, date: '2026-08-30', energy: 2, note: 'moe' }),
    )
  })

  it('clamps energy and sleep_hours to their valid range', async () => {
    await POST(makeReq('POST', { token: 'tok', body: { mood: 1, energy: 99, sleep_hours: -3 } }))
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ energy: 5, sleep_hours: 0 }))
  })

  it('defaults to today when no date is given', async () => {
    await POST(makeReq('POST', { token: 'tok', body: { mood: 0 } }))
    const payload = mockUpsert.mock.calls[0][0] as { date: string }
    expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
