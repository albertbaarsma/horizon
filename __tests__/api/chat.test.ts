import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _resetStore } from '@/lib/rate-limit'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn()
let mockFromImpl: (table: string) => unknown

vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => mockFromImpl(table),
  })),
}))
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }) }))
vi.mock('@/lib/google-api', () => ({
  getGoogleToken: vi.fn().mockResolvedValue(null),
  fetchGmailMessages: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/weather-fetcher', () => ({
  fetchWeatherData: vi.fn().mockResolvedValue({
    station: 'Twente', distance: 5,
    current: { temperature: 20, description: 'Zonnig', windDirection: 'N', windSpeed: 3, precipitation: 0, humidity: 60, icon: '' },
    rainForecast: [], isRaining: false, forecast: [],
  }),
}))

const { POST } = await import('@/app/api/chat/route')

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(body: object) {
  return { json: () => Promise.resolve(body) } as Parameters<typeof POST>[0]
}

/** Chainable Supabase query mock. */
function makeChain(result: { data: unknown; error?: unknown }) {
  const q: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'order', 'update', 'insert', 'upsert', 'delete']
  methods.forEach(m => { q[m] = () => q })
  q['single'] = () => Promise.resolve(result)
  q['then']   = (res: (v: typeof result) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej)
  q['catch']  = (rej: (e: unknown) => unknown) => Promise.resolve(result).catch(rej)
  return q
}

function defaultFromImpl(table: string) {
  if (table === 'profiles') return makeChain({ data: { ai_token: 'bearer-uuid-token', ai_api_key: 'sk-ant-test' } })
  if (table === 'projects') return makeChain({ data: [] })
  if (table === 'tasks')    return makeChain({ data: [] })
  return makeChain({ data: null })
}

/** Anthropic non-streaming response (text only, no tool calls). */
function anthropicTextResponse(text = 'Hallo!') {
  return {
    ok: true,
    json: () => Promise.resolve({
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
    }),
  }
}

/** Anthropic SSE stream emitting a single text chunk then message_stop. */
function anthropicStream(text = 'Hallo!') {
  const encoder = new TextEncoder()
  const sseChunk =
    `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })}\n\n` +
    `event: message_stop\ndata: {"type":"message_stop"}\n\n`
  return {
    ok: true,
    body: new ReadableStream({
      start(ctrl) { ctrl.enqueue(encoder.encode(sseChunk)); ctrl.close() },
    }),
  }
}

/** Anthropic tool_use response. */
function anthropicToolResponse(toolName: string, toolInput: object) {
  return {
    ok: true,
    json: () => Promise.resolve({
      content: [
        { type: 'tool_use', id: 'toolu_01', name: toolName, input: toolInput },
      ],
      stop_reason: 'tool_use',
    }),
  }
}

/** Stubs fetch: round 1 = text (no tools) → round 2 = stream. */
function stubAnthropicStream(text = 'Hallo!') {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(anthropicTextResponse(text))
    .mockResolvedValueOnce(anthropicStream(text))
  )
}

/** Stubs fetch to fail on the first call. */
function stubAnthropicError() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    text: () => Promise.resolve('API error'),
  }))
}

/** Stubs fetch: round 1 = tool call → round 2 = text → round 3 = stream. */
function stubAnthropicWithToolCall(toolName: string, toolInput: object, finalText = 'Klaar!') {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(anthropicToolResponse(toolName, toolInput))
    .mockResolvedValueOnce(anthropicTextResponse(finalText))
    .mockResolvedValueOnce(anthropicStream(finalText))
  )
}

const baseMessages = [{ role: 'user', content: 'Wat moet ik doen?' }]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetStore()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid1' } } })
    mockFromImpl = defaultFromImpl
  })

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('returns 401 when no user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeReq({ messages: baseMessages }))
    expect(res.status).toBe(401)
  })

  // ── Rate limiting ─────────────────────────────────────────────────────────

  it('returns 429 after 30 requests in a minute', async () => {
    for (let i = 0; i < 30; i++) {
      stubAnthropicStream()
      await POST(makeReq({ messages: baseMessages }))
    }
    const res = await POST(makeReq({ messages: baseMessages }))
    expect(res.status).toBe(429)
    const j = await res.json()
    expect(j.error).toBeTruthy()
  })

  it('different users have independent rate limit buckets', async () => {
    for (let i = 0; i < 30; i++) {
      stubAnthropicStream()
      await POST(makeReq({ messages: baseMessages }))
    }
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid2' } } })
    stubAnthropicStream()
    const res = await POST(makeReq({ messages: baseMessages }))
    expect(res.status).not.toBe(429)
  })

  // ── Anthropic errors ──────────────────────────────────────────────────────

  it('returns 500 when Anthropic API fails', async () => {
    stubAnthropicError()
    const res = await POST(makeReq({ messages: baseMessages }))
    expect(res.status).toBe(500)
    const j = await res.json()
    expect(j.error).toBeTruthy()
  })

  // ── Streaming ─────────────────────────────────────────────────────────────

  it('returns text/event-stream when Anthropic answers without tool calls', async () => {
    stubAnthropicStream('Hallo Jordan!')
    const res = await POST(makeReq({ messages: baseMessages }))
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('falls back to JSON when stream body is null', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(anthropicTextResponse('Fallback'))
      .mockResolvedValueOnce({ ok: false, body: null })
    )
    const res = await POST(makeReq({ messages: baseMessages }))
    expect(res.headers.get('content-type')).toContain('application/json')
    const j = await res.json()
    expect(j.content).toBe('Fallback')
  })

  // ── Tool calling ──────────────────────────────────────────────────────────

  it('executes get_tasks tool and streams final answer', async () => {
    mockFromImpl = (table) => {
      if (table === 'profiles') return makeChain({ data: { ai_token: 'bearer-uuid-token', ai_api_key: 'sk-ant-test' } })
      if (table === 'projects') return makeChain({ data: [] })
      if (table === 'tasks')    return makeChain({ data: [{ id: 1, proj_id: 'test', name: 'Test taak', status: 'doing', urgent: false }] })
      return makeChain({ data: null })
    }
    stubAnthropicWithToolCall('get_tasks', { status: 'doing' }, 'Je hebt 1 taak.')
    const res = await POST(makeReq({ messages: baseMessages }))
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('uses profile ai_api_key as Anthropic key', async () => {
    const customKey = 'sk-ant-custom'
    mockFromImpl = (table) => {
      if (table === 'profiles') return makeChain({ data: { ai_token: 'bearer-uuid-token', ai_api_key: customKey } })
      return defaultFromImpl(table)
    }
    stubAnthropicStream()
    await POST(makeReq({ messages: baseMessages }))
    const fetchMock = vi.mocked(globalThis.fetch)
    const firstCall = fetchMock.mock.calls[0]
    const headers = (firstCall[1] as RequestInit).headers as Record<string, string>
    expect(headers['x-api-key']).toBe(customKey)
  })

  // ── Message history ───────────────────────────────────────────────────────

  it('passes conversation history to Anthropic', async () => {
    stubAnthropicStream()
    const history = [
      { role: 'user',      content: 'Eerder bericht' },
      { role: 'assistant', content: 'Eerder antwoord' },
      { role: 'user',      content: 'Nieuw bericht'  },
    ]
    await POST(makeReq({ messages: history }))
    const fetchMock = vi.mocked(globalThis.fetch)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.messages.length).toBeGreaterThanOrEqual(history.length - 1) // history minus last (patched separately)
    expect(body.system).toContain('Horizon AI')
  })

  // ── OpenAI-compatible providers (Ollama/LM Studio/OpenAI/Gemini) ───────────

  function openAiCompatResponse(text = 'Hoi!') {
    return { ok: true, json: () => Promise.resolve({ choices: [{ message: { content: text } }] }) }
  }

  it('defaults to <base>/v1/chat/completions for a bare-domain base URL', async () => {
    mockFromImpl = (table) => table === 'profiles'
      ? makeChain({ data: { ai_token: 'bearer-uuid-token', ai_api_key: 'sk-test' } })
      : defaultFromImpl(table)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openAiCompatResponse()))
    await POST(makeReq({ messages: baseMessages, providerOverride: { provider: 'openai', model: 'gpt-4o-mini' } }))
    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('uses a full custom base URL as-is when it already ends in /chat/completions (Gemini-style)', async () => {
    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    mockFromImpl = (table) => table === 'profiles'
      ? makeChain({ data: { ai_token: 'bearer-uuid-token', ai_api_key: 'sk-gemini', ai_base_url: geminiUrl } })
      : defaultFromImpl(table)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openAiCompatResponse()))
    await POST(makeReq({ messages: baseMessages, providerOverride: { provider: 'openai', model: 'gemini-2.0-flash' } }))
    const fetchMock = vi.mocked(globalThis.fetch)
    // Geen dubbele of extra /v1 erachter geplakt — het volledige pad blijft precies zoals ingesteld.
    expect(fetchMock.mock.calls[0][0]).toBe(geminiUrl)
  })
})
