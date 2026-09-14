// Gedeelde datalaag voor de externe AI-toegang: dezelfde functies worden
// aangeroepen door de REST-routes (app/api/ai/*) en door de MCP-tools
// (app/api/mcp) — geen logica dubbel, één plek die weet hoe een taak/week-item/
// achievement/xp-status eruitziet. Elke functie gooit een Error bij een
// Supabase-fout; de aanroeper (route of MCP-tool) zet dat om naar de juiste
// foutrespons voor dat protocol.
import { adminClient } from './ai-api-auth'
import {
  levelProgress, levelTitle, skillLevelForXp, skillProgress,
  categoryIcon, computeStreaks,
} from './xp'

// ── Taken ────────────────────────────────────────────────────────────────────

export async function listTasks(userId: string, status?: string) {
  let query = adminClient().from('tasks').select('*').eq('user_id', userId)
  if (status) query = query.eq('status', status)
  const { data, error } = await query.order('created_at')
  if (error) throw new Error(error.message)
  return data
}

export async function createTask(userId: string, input: {
  proj_id: string; name: string; status?: string; urgent?: boolean
  priority?: number; subtasks?: unknown[]
}) {
  const { proj_id, name, status = 'backlog', urgent = false, priority, subtasks } = input
  if (!proj_id || !name) throw new Error('proj_id and name required')

  const row: Record<string, unknown> = { user_id: userId, proj_id, name, status, urgent }
  if (priority !== undefined) row.priority = Math.max(0, Math.min(5, Math.round(Number(priority))))
  if (Array.isArray(subtasks)) row.subtasks = subtasks

  const { data, error } = await adminClient().from('tasks').insert(row).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTask(userId: string, id: string, input: Record<string, unknown>) {
  const allowed = ['name', 'status', 'urgent', 'proj_id', 'priority', 'subtasks']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) if (key in input) updates[key] = input[key]
  if ('priority' in updates) updates.priority = Math.max(0, Math.min(5, Math.round(Number(updates.priority))))

  const { data, error } = await adminClient().from('tasks').update(updates).eq('id', id).eq('user_id', userId).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteTask(userId: string, id: string) {
  const { data, error } = await adminClient().from('tasks').delete().eq('id', id).eq('user_id', userId).select('name').single()
  if (error) throw new Error(error.message)
  return { deleted: true, name: data?.name }
}

// ── Weekplanning ─────────────────────────────────────────────────────────────

export async function listWeekItems(userId: string, from?: string, to?: string) {
  let query = adminClient().from('week_items').select('*').eq('user_id', userId).order('date').order('id')
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

/** Een tijdblok is HH:MM (bv. "09:30"); null of een lege string haalt het weg. */
function parseTimeBlock(value: unknown): string | null {
  if (value === null || value === '') return null
  if (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return value
  throw new Error('time_block must be HH:MM')
}

export async function addWeekItem(userId: string, input: { date: string; text: string; type?: string; time_block?: string | null; task_id?: string | number | null }) {
  const { date, text, type = 'task' } = input
  if (!date || !text) throw new Error('date and text required')

  const row: Record<string, unknown> = { user_id: userId, date, text, type, done: false }
  if (input.time_block !== undefined) row.time_block = parseTimeBlock(input.time_block)
  if (input.task_id !== undefined && input.task_id !== null) row.task_id = String(input.task_id)

  const { data, error } = await adminClient().from('week_items')
    .insert(row).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateWeekItem(userId: string, id: string, input: Record<string, unknown>) {
  const allowed = ['text', 'done', 'date', 'type', 'task_id', 'time_block']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) if (key in input) updates[key] = input[key]
  if (Object.keys(updates).length === 0) throw new Error('No fields to update')
  if ('time_block' in updates) updates.time_block = parseTimeBlock(updates.time_block)

  const { data, error } = await adminClient().from('week_items').update(updates).eq('id', id).eq('user_id', userId).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteWeekItem(userId: string, id: string) {
  const { data, error } = await adminClient().from('week_items').delete().eq('id', id).eq('user_id', userId).select('text').single()
  if (error) throw new Error(error.message)
  return { deleted: true, text: data?.text }
}

// ── Achievements ─────────────────────────────────────────────────────────────

export async function listAchievements(userId: string, limit = 50) {
  const { data, error } = await adminClient().from('achievements')
    .select('*').eq('user_id', userId).order('date', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return data
}

export async function addAchievement(userId: string, input: { text: string; emoji?: string; cat_id?: string | null; date?: string }) {
  if (!input.text) throw new Error('text required')
  const { data, error } = await adminClient().from('achievements').insert({
    user_id: userId,
    text: input.text,
    emoji: input.emoji ?? '⭐',
    cat_id: input.cat_id ?? null,
    date: input.date ?? new Date().toISOString().slice(0, 10),
  }).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteAchievement(userId: string, id: string) {
  const { error } = await adminClient().from('achievements').delete().eq('id', id).eq('user_id', userId)
  if (error) throw new Error(error.message)
  return { deleted: true }
}

// ── XP / gamification ────────────────────────────────────────────────────────

type XpRow = { amount: number; reason: string; cat_id: string | null; source: string; created_at: string }

export async function getXpStatus(userId: string) {
  const supabase = adminClient()
  const [{ data: events }, { data: categories }] = await Promise.all([
    supabase.from('xp_events').select('amount, reason, cat_id, source, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('categories').select('id, name').eq('user_id', userId),
  ])

  const rows = (events ?? []) as XpRow[]
  const total = rows.reduce((s, e) => s + e.amount, 0)
  const prog = levelProgress(total)
  const streak = computeStreaks(rows.map(e => e.created_at))

  const catXp = new Map<string, number>()
  for (const e of rows) if (e.cat_id) catXp.set(e.cat_id, (catXp.get(e.cat_id) ?? 0) + e.amount)
  const skills = (categories ?? []).map((c: { id: string; name: string }) => {
    const xp = catXp.get(c.id) ?? 0
    const sp = skillProgress(xp)
    return { id: c.id, name: c.name, icon: categoryIcon(c.name), xp, level: skillLevelForXp(xp), toNext: sp.toNext, pct: sp.pct }
  }).sort((a, b) => b.xp - a.xp)

  const bySource: Record<string, number> = {}
  for (const e of rows) bySource[e.source] = (bySource[e.source] ?? 0) + 1

  const weekAgo = Date.now() - 7 * 86400000
  const xpThisWeek = rows.filter(e => new Date(e.created_at).getTime() >= weekAgo).reduce((s, e) => s + e.amount, 0)

  return {
    level: prog.level,
    title: levelTitle(prog.level),
    totalXp: total,
    xpIntoLevel: prog.into,
    xpForLevel: prog.span,
    xpToNext: prog.toNext,
    progressPct: prog.pct,
    xpThisWeek,
    streak,
    skills,
    bySource,
    recent: rows.slice(0, 8).map(e => ({ reason: e.reason, amount: e.amount, source: e.source, at: e.created_at })),
    summary: `Level ${prog.level} (${levelTitle(prog.level)}) · ${total} XP · nog ${prog.toNext} XP tot level ${prog.level + 1}. Huidige streak: ${streak.current} dag(en).`,
  }
}
