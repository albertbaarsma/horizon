import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockGetGoogleToken = vi.fn()
const mockFetchGmailMessages = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }) }))
vi.mock('@/lib/google-api', () => ({
  getGoogleToken: mockGetGoogleToken,
  fetchGmailMessages: mockFetchGmailMessages,
}))

const { GET } = await import('@/app/api/gmail/route')

describe('GET /api/gmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 400 when Google not connected', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
    mockGetGoogleToken.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(400)
    const j = await res.json()
    expect(j.connected).toBe(false)
  })

  it('returns 403 when GMAIL_SCOPE_MISSING', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
    mockGetGoogleToken.mockResolvedValue('tok')
    mockFetchGmailMessages.mockRejectedValue(new Error('GMAIL_SCOPE_MISSING'))
    const res = await GET()
    expect(res.status).toBe(403)
    const j = await res.json()
    expect(j.connected).toBe(false)
    expect(j.error).toMatch(/scope/i)
  })

  it('returns 401 when GMAIL_TOKEN_INVALID', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
    mockGetGoogleToken.mockResolvedValue('tok')
    mockFetchGmailMessages.mockRejectedValue(new Error('GMAIL_TOKEN_INVALID'))
    const res = await GET()
    expect(res.status).toBe(401)
    const j = await res.json()
    expect(j.connected).toBe(false)
  })

  it('returns 500 on unexpected error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
    mockGetGoogleToken.mockResolvedValue('tok')
    mockFetchGmailMessages.mockRejectedValue(new Error('GMAIL_API_500'))
    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns messages on success', async () => {
    const msgs = [{ id: '1', subject: 'Test', from: 'x@x.com', date: '', snippet: 'hi', labelIds: [] }]
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
    mockGetGoogleToken.mockResolvedValue('tok')
    mockFetchGmailMessages.mockResolvedValue(msgs)
    const res = await GET()
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.messages).toHaveLength(1)
    expect(j.connected).toBe(true)
  })
})
