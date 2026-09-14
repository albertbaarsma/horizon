import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetBearerToken     = vi.fn()
const mockGetUserIdFromToken = vi.fn()
const mockCategories = vi.fn()
const mockProjects   = vi.fn()

vi.mock('@/lib/ai-api-auth', () => ({
  getBearerToken:     (...a: unknown[]) => mockGetBearerToken(...a),
  getUserIdFromToken: (...a: unknown[]) => mockGetUserIdFromToken(...a),
  adminClient: () => ({
    from: (table: string) => {
      if (table === 'categories') return { select: () => ({ eq: () => ({ order: () => mockCategories() }) }) }
      if (table === 'projects')   return { select: () => ({ eq: () => ({ order: () => mockProjects() }) }) }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

const { GET } = await import('../app/api/ai/projects/route')

function makeReq(token?: string) {
  return new NextRequest(new URL('http://localhost/api/ai/projects'), {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetBearerToken.mockReturnValue('tok')
  mockGetUserIdFromToken.mockResolvedValue('uid1')
  mockCategories.mockResolvedValue({ data: [{ id: 'gezondheid', name: 'Gezondheid' }], error: null })
  mockProjects.mockResolvedValue({ data: [{ id: 'sport', name: 'Sport 4x/week', cat_id: 'gezondheid', status: 'actief' }], error: null })
})

describe('GET /api/ai/projects', () => {
  it('returns 401 without a token', async () => {
    mockGetBearerToken.mockReturnValue(null)
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('returns 401 for an invalid token', async () => {
    mockGetUserIdFromToken.mockResolvedValue(null)
    const res = await GET(makeReq('wrong'))
    expect(res.status).toBe(401)
  })

  it('returns categories and projects together', async () => {
    const res = await GET(makeReq('tok'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.categories).toEqual([{ id: 'gezondheid', name: 'Gezondheid' }])
    expect(json.projects).toEqual([{ id: 'sport', name: 'Sport 4x/week', cat_id: 'gezondheid', status: 'actief' }])
  })
})
