/**
 * Auth-grens van de gehoste MCP-endpoints (app/api/mcp en app/api/mcp/[token]).
 * De MCP-protocollogica zelf (tools/list, tools/call) komt van mcp-handler en
 * wordt hier niet opnieuw getest — alleen: wie komt er wel/niet doorheen, en
 * via welk kanaal (header vs. pad-parameter).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUserIdFromToken = vi.fn()
vi.mock('@/lib/ai-api-auth', () => ({ getUserIdFromToken: (t: string) => getUserIdFromToken(t) }))

const mockToolHandler = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
const buildMcpHandler = vi.fn((_userId: string) => mockToolHandler)
vi.mock('@/lib/mcp-server', () => ({ buildMcpHandler: (userId: string) => buildMcpHandler(userId) }))

const { GET: headerGET, POST: headerPOST } = await import('@/app/api/mcp/route')
const { POST: pathPOST } = await import('@/app/api/mcp/[token]/route')

beforeEach(() => { vi.clearAllMocks() })

describe('POST /api/mcp — header-based auth (Claude Code, scripts)', () => {
  it('401 zonder Authorization-header', async () => {
    const res = await headerPOST(new Request('http://localhost/api/mcp', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Missing token')
    expect(getUserIdFromToken).not.toHaveBeenCalled()
  })

  it('401 bij een ongeldig token', async () => {
    getUserIdFromToken.mockResolvedValue(null)
    const res = await headerPOST(new Request('http://localhost/api/mcp', {
      method: 'POST', body: '{}', headers: { authorization: 'Bearer wrong' },
    }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid token')
    expect(buildMcpHandler).not.toHaveBeenCalled()
  })

  it('geeft door aan de MCP-handler met de opgeloste userId bij een geldig token', async () => {
    getUserIdFromToken.mockResolvedValue('user-123')
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST', body: '{}', headers: { authorization: 'Bearer good-token' },
    })
    const res = await headerPOST(req)
    expect(res.status).toBe(200)
    expect(getUserIdFromToken).toHaveBeenCalledWith('good-token')
    expect(buildMcpHandler).toHaveBeenCalledWith('user-123')
    expect(mockToolHandler).toHaveBeenCalledWith(req)
  })

  it('GET volgt hetzelfde auth-pad als POST', async () => {
    const res = await headerGET(new Request('http://localhost/api/mcp', { method: 'GET' }))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/mcp/[token] — pad-gebaseerde auth (Claude Desktop/claude.ai custom connector)', () => {
  it('401 bij een ongeldig token, zonder dat een Authorization-header nodig is', async () => {
    getUserIdFromToken.mockResolvedValue(null)
    const res = await pathPOST(
      new Request('http://localhost/api/mcp/wrong-token', { method: 'POST', body: '{}' }),
      { params: Promise.resolve({ token: 'wrong-token' }) },
    )
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid token')
  })

  it('geeft door aan de MCP-handler zonder Authorization-header nodig te hebben', async () => {
    getUserIdFromToken.mockResolvedValue('user-456')
    const req = new Request('http://localhost/api/mcp/good-token', { method: 'POST', body: '{}' })
    const res = await pathPOST(req, { params: Promise.resolve({ token: 'good-token' }) })
    expect(res.status).toBe(200)
    expect(getUserIdFromToken).toHaveBeenCalledWith('good-token')
    expect(buildMcpHandler).toHaveBeenCalledWith('user-456')
  })
})
