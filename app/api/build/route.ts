/**
 * /api/build — Jarvis self-builder endpoint
 * Allows Jarvis to read project files, list dirs, write new files, run tsc.
 * Write is blocked on critical core files.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import path from 'path'
import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
// turbopackIgnore: dit dev-only endpoint leest projectbestanden dynamisch;
// zonder ignore traceert Turbopack het hele project de serverbundle in
const PROJECT_ROOT = path.resolve(/*turbopackIgnore: true*/ process.cwd())
const MAX_READ_BYTES = 200 * 1024

const WRITE_BLOCKED = [
  'app/api/chat/route.ts',
  'app/api/build/route.ts',
  'lib/supabase.ts',
  'lib/supabase-server.ts',
  '.env.local',
  '.env',
]

function safePath(rel: string): string | null {
  const abs = path.resolve(/*turbopackIgnore: true*/ PROJECT_ROOT, rel)
  if (!abs.startsWith(PROJECT_ROOT + path.sep) && abs !== PROJECT_ROOT) return null
  return abs
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev only' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { action: string; path?: string; content?: string }

  if (body.action === 'read_file') {
    const abs = safePath(body.path ?? '')
    if (!abs) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    try {
      const stat = await fs.stat(abs)
      if (stat.size > MAX_READ_BYTES) return NextResponse.json({ error: 'File too large' }, { status: 400 })
      const content = await fs.readFile(abs, 'utf-8')
      return NextResponse.json({ content, lines: content.split('\n').length })
    } catch { return NextResponse.json({ error: 'File not found' }, { status: 404 }) }
  }

  if (body.action === 'list_files') {
    const abs = safePath(body.path ?? '')
    if (!abs) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    try {
      const entries = await fs.readdir(abs, { withFileTypes: true })
      const files = entries
        .filter(e => !['node_modules', '.next', '.git'].includes(e.name))
        .map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file', path: path.join(body.path ?? '', e.name).replace(/\\/g, '/') }))
      return NextResponse.json({ files })
    } catch { return NextResponse.json({ error: 'Directory not found' }, { status: 404 }) }
  }

  if (body.action === 'write_file') {
    const rel = body.path ?? ''
    if (WRITE_BLOCKED.some(b => rel === b)) return NextResponse.json({ error: `Blocked: ${rel}` }, { status: 403 })
    const abs = safePath(rel)
    if (!abs) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, body.content ?? '', 'utf-8')
    return NextResponse.json({ ok: true, path: rel, bytes: (body.content ?? '').length })
  }

  if (body.action === 'run_type_check') {
    try {
      const tsc = path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, 'node_modules', '.bin', 'tsc.cmd')
      const { stdout, stderr } = await execAsync(`"${tsc}" --noEmit --project "${path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, 'tsconfig.json')}"`, { cwd: PROJECT_ROOT, timeout: 30000 })
      const out = (stdout + stderr).trim()
      return NextResponse.json({ ok: true, output: out || '✓ No type errors' })
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string }
      const out = ((err.stdout ?? '') + (err.stderr ?? '')).trim()
      return NextResponse.json({ ok: false, output: out, errorCount: (out.match(/error TS/g) ?? []).length })
    }
  }

  return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
}
