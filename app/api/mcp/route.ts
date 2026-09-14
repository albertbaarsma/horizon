import { getUserIdFromToken } from '@/lib/ai-api-auth'
import { buildMcpHandler } from '@/lib/mcp-server'

// Voor clients die een custom header kunnen zetten (Claude Code, eigen
// scripts): `claude mcp add --transport http albert-os <url> --header
// "Authorization: Bearer <token>"`. Zie app/api/mcp/[token] voor Claude
// Desktop/claude.ai, waar de custom-connector-UI geen headerveld heeft.
function getAuthHeader(req: Request): string | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

async function handle(req: Request) {
  const token = getAuthHeader(req)
  if (!token) return Response.json({ error: 'Missing token' }, { status: 401 })

  const userId = await getUserIdFromToken(token)
  if (!userId) return Response.json({ error: 'Invalid token' }, { status: 401 })

  return buildMcpHandler(userId)(req)
}

export { handle as GET, handle as POST, handle as DELETE }
