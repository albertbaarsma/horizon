import { getUserIdFromToken } from '@/lib/ai-api-auth'
import { buildMcpHandler } from '@/lib/mcp-server'

// Voor Claude Desktop / claude.ai's "Add custom connector": die UI vraagt
// alleen een URL, geen custom header — dus het token zit in het pad zelf.
// Zelfde patroon als andere MCP-integraties gebruiken voor dezelfde
// UI-beperking. Zo veilig als het token normaal al is: wie de URL heeft,
// heeft toegang — precies het dreigingsmodel van een bearer-token.
async function handle(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const userId = await getUserIdFromToken(token)
  if (!userId) return Response.json({ error: 'Invalid token' }, { status: 401 })

  return buildMcpHandler(userId)(req)
}

export { handle as GET, handle as POST, handle as DELETE }
