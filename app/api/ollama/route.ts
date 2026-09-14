import { NextResponse } from 'next/server'
import { spawn } from 'child_process'

const OLLAMA_BASE = 'http://localhost:11434'

async function checkRunning(): Promise<{ running: boolean; models: string[] }> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 2000)
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) return { running: false, models: [] }
    const data = await res.json() as { models?: { name: string }[] }
    return { running: true, models: (data.models ?? []).map(m => m.name) }
  } catch {
    return { running: false, models: [] }
  }
}

/** GET /api/ollama — check status */
export async function GET() {
  const status = await checkRunning()
  return NextResponse.json(status)
}

/** POST /api/ollama — start Ollama if not running */
export async function POST() {
  const already = await checkRunning()
  if (already.running) {
    return NextResponse.json({ started: false, message: 'Ollama draait al', models: already.models })
  }

  try {
    const child = spawn('ollama', ['serve'], {
      detached: true,
      stdio:    'ignore',
      shell:    true,
      windowsHide: true,
    })
    child.unref()
  } catch (e) {
    return NextResponse.json({ error: `Kon Ollama niet starten: ${(e as Error).message}` }, { status: 500 })
  }

  // Poll up to 6s for Ollama to come up
  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 1000))
    const status = await checkRunning()
    if (status.running) {
      return NextResponse.json({ started: true, message: 'Ollama gestart', models: status.models })
    }
  }

  return NextResponse.json({ started: true, message: 'Ollama wordt gestart (even geduld)…', models: [] })
}
