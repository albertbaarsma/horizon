import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockGetGoogleToken = vi.fn()
const mockFetchGmailMessages = vi.fn()
const mockProfileSingle = vi.fn()
const mockProjectsOrder = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'projects') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: mockProjectsOrder }
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mockProfileSingle }
    }),
  }),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }) }))
vi.mock('@/lib/google-api', () => ({
  getGoogleToken: mockGetGoogleToken,
  fetchGmailMessages: mockFetchGmailMessages,
}))

const { GET, _resetCache } = await import('@/app/api/gmail/summarize/route')

// ── Helpers ─────────────────────────────────────────────────────────────────

const SAMPLE_MSG = {
  id: 'm1', subject: 'Offerte gevraagd', from: 'klant@bar.nl',
  date: 'Mon, 30 Jun 2026 09:00:00 +0200',
  snippet: 'Hallo Jordan, graag een offerte voor...', labelIds: ['UNREAD'],
}

const GROQ_AI_RESP = [{
  idx: 1, priority: 'high', actionRequired: true,
  category: 'werk', oneLiner: 'Offerte aanvragen van klant', suggestedTask: 'Stuur offerte naar klant@bar.nl',
}]

function stubAI(ok: boolean, content?: string) {
  const respBody = ok ? {
    content: [{ type: 'text', text: content ?? JSON.stringify(GROQ_AI_RESP) }],
    stop_reason: 'end_turn',
  } : {}
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 503,
    json: () => Promise.resolve(respBody),
  }))
}

function setupAuth() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
  mockGetGoogleToken.mockResolvedValue('tok')
  mockProfileSingle.mockResolvedValue({ data: { ai_api_key: 'sk-ant-test' } })
  mockProjectsOrder.mockResolvedValue({ data: [], error: null })
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/gmail/summarize', () => {
  beforeEach(() => { vi.clearAllMocks(); _resetCache() })

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
  })

  it('returns 401 when GMAIL_TOKEN_INVALID', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid' } } })
    mockGetGoogleToken.mockResolvedValue('tok')
    mockFetchGmailMessages.mockRejectedValue(new Error('GMAIL_TOKEN_INVALID'))
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty messages when inbox is empty', async () => {
    setupAuth()
    mockFetchGmailMessages.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.messages).toEqual([])
    expect(j.connected).toBe(true)
  })

  it('returns summaries with AI data on success', async () => {
    setupAuth()
    mockFetchGmailMessages.mockResolvedValue([SAMPLE_MSG])
    stubAI(true)
    const res = await GET()
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.messages).toHaveLength(1)
    expect(j.messages[0].priority).toBe('high')
    expect(j.messages[0].actionRequired).toBe(true)
    expect(j.messages[0].oneLiner).toBe('Offerte aanvragen van klant')
    expect(j.messages[0].suggestedTask).toBe('Stuur offerte naar klant@bar.nl')
  })

  it('returns aiError when AI fails', async () => {
    setupAuth()
    mockFetchGmailMessages.mockResolvedValue([SAMPLE_MSG])
    stubAI(false)
    const res = await GET()
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.aiError).toBeTruthy()
    // Messages still returned, just without AI classification
    expect(j.messages).toHaveLength(1)
    expect(j.messages[0].priority).toBe('low')
  })

  it('returns aiError when AI returns unparseable content', async () => {
    setupAuth()
    mockFetchGmailMessages.mockResolvedValue([SAMPLE_MSG])
    stubAI(true, 'Dit is geen JSON array')
    const res = await GET()
    expect(res.status).toBe(200)
    const j = await res.json()
    expect(j.aiError).toBeTruthy()
  })

  it('sorts messages: high before medium before low', async () => {
    setupAuth()
    const msgs = [
      { ...SAMPLE_MSG, id: 'm1', subject: 'Low email' },
      { ...SAMPLE_MSG, id: 'm2', subject: 'High email' },
      { ...SAMPLE_MSG, id: 'm3', subject: 'Medium email' },
    ]
    mockFetchGmailMessages.mockResolvedValue(msgs)
    const aiResp = [
      { idx: 1, priority: 'low',    actionRequired: false, category: 'info',  oneLiner: 'low',    suggestedTask: null },
      { idx: 2, priority: 'high',   actionRequired: true,  category: 'actie', oneLiner: 'high',   suggestedTask: 'doe iets' },
      { idx: 3, priority: 'medium', actionRequired: false, category: 'info',  oneLiner: 'medium', suggestedTask: null },
    ]
    stubAI(true, JSON.stringify(aiResp))
    const res = await GET()
    const j = await res.json()
    expect(j.messages[0].priority).toBe('high')
    expect(j.messages[1].priority).toBe('medium')
    expect(j.messages[2].priority).toBe('low')
  })
})
