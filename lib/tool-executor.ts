import { getGoogleToken, fetchGmailMessages } from '@/lib/google-api'
import { fetchWeatherData } from '@/lib/weather-fetcher'
import { XP_AMOUNTS, levelProgress, levelTitle, skillLevelForXp, categoryIcon, computeStreaks } from '@/lib/xp'
import path from 'path'
import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync    = promisify(exec)
// turbopackIgnore: de self-build tools lezen projectbestanden dynamisch;
// zonder ignore traceert Turbopack het hele project de serverbundle in
const PROJECT_ROOT = path.resolve(/*turbopackIgnore: true*/ process.cwd())

export const MAX_BUILD_BYTES = 200 * 1024
export const BUILD_BLOCKED   = [
  'app/api/chat/route.ts',
  'app/api/build/route.ts',
  'lib/supabase.ts',
  'lib/supabase-server.ts',
  '.env.local',
  '.env',
]

export function safeBuildPath(rel: string): string | null {
  const abs = path.resolve(/*turbopackIgnore: true*/ PROJECT_ROOT, rel)
  if (!abs.startsWith(PROJECT_ROOT + path.sep) && abs !== PROJECT_ROOT) return null
  return abs
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolSupabase = any

export type ToolCtx = {
  supabase: ToolSupabase
  userId: string
  projects: Array<{ id: string; emoji: string; name: string; status: string; description: string }> | null
  mutatedTabs: string[]
}

// Tools waarvan een geslaagde AI-mutatie in de XP-log wordt geregistreerd (per gebruiker)
const XP_LOGGED = new Set([
  'update_task', 'add_task', 'delete_task',
  'add_project', 'update_project',
  'add_week_item', 'update_week_item', 'delete_week_item',
  'add_recurring_task', 'delete_recurring_task',
  'add_achievement',
])

export function createToolExecutor(ctx: ToolCtx) {
  const { supabase, userId, projects, mutatedTabs } = ctx

  async function run(name: string, args: Record<string, unknown>): Promise<string> {

    // ── Tasks ────────────────────────────────────────────────────────────────────

    if (name === 'get_tasks') {
      let q = supabase.from('tasks').select('id, proj_id, name, status, urgent').eq('user_id', userId)
      if (args.status)  q = q.eq('status',  args.status  as string)
      if (args.proj_id) q = q.eq('proj_id', args.proj_id as string)
      const { data } = await q.order('created_at')
      if (!data?.length) return 'Geen taken gevonden.'
      return data.map((t: { id: number; proj_id: string; name: string; status: string; urgent: boolean }) =>
        `[${t.id}] ${t.name} — status: ${t.status}${t.urgent ? ' ⚡ urgent' : ''} (project: ${t.proj_id})`
      ).join('\n')
    }

    if (name === 'update_task') {
      const update: Record<string, unknown> = { status: args.status, updated_at: new Date().toISOString() }
      if (args.urgent !== undefined) update.urgent = args.urgent
      const { data, error } = await supabase
        .from('tasks').update(update)
        .eq('id', args.task_id as number).eq('user_id', userId)
        .select('name, status').single()
      if (error) return `Fout bij bijwerken: ${error.message}`
      mutatedTabs.push('tasks')
      return `✓ "${data.name}" is nu ${data.status}`
    }

    if (name === 'add_task') {
      const { data, error } = await supabase.from('tasks').insert({
        user_id: userId,
        proj_id: (args.proj_id as string) ?? null,
        name:    args.name   as string,
        status:  (args.status as string) ?? 'doing',
        urgent:  (args.urgent as boolean) ?? false,
      }).select('id, name, proj_id').single()
      if (error) return `Fout bij aanmaken: ${error.message}`
      mutatedTabs.push('tasks')
      return `✓ Taak toegevoegd: "${data.name}" → ${data.proj_id ? `project ${data.proj_id}` : '📥 inbox (geen project)'} (ID: ${data.id})`
    }

    if (name === 'delete_task') {
      const { data, error } = await supabase
        .from('tasks').delete()
        .eq('id', args.task_id as number).eq('user_id', userId)
        .select('name').single()
      if (error) return `Fout bij verwijderen: ${error.message}`
      mutatedTabs.push('tasks')
      return `✓ Taak "${data.name}" verwijderd.`
    }

    if (name === 'get_projects') {
      if (!projects?.length) return 'Geen projecten gevonden.'
      type P = typeof projects[number] & { parent_id?: string | null }
      const list = projects as P[]
      const ids   = new Set(list.map(p => p.id))
      const roots = list.filter(p => !p.parent_id || !ids.has(p.parent_id))
      const kids  = (id: string) => list.filter(p => p.parent_id === id)
      return roots.flatMap(p => [
        `${p.emoji} ${p.id} — ${p.name} (${p.status}): ${p.description ?? ''}`,
        ...kids(p.id).map(k => `  ↳ ${k.emoji} ${k.id} — ${k.name} (${k.status}): ${k.description ?? ''}`),
      ]).join('\n')
    }

    if (name === 'add_project') {
      const projName = args.name as string
      const parentId = (args.parent_id as string) || null
      const parent   = parentId ? (projects ?? []).find(p => p.id === parentId) : null
      if (parentId && !parent) return `Fout: hoofdproject '${parentId}' bestaat niet. Gebruik get_projects voor de juiste id's.`
      const catId = (args.cat_id as string) || (parent ? (parent as { cat_id?: string }).cat_id : null)
      if (!catId) {
        // cat zit niet in de context-select — haal hem op als er een parent is
        if (parent) {
          const { data: pRow } = await supabase.from('projects').select('cat_id').eq('id', parentId).single()
          if (pRow?.cat_id) return insertProject(pRow.cat_id)
        }
        return 'Fout: geef een cat_id op (of een parent_id waarvan de categorie geërfd kan worden).'
      }
      return insertProject(catId)

      async function insertProject(cat: string): Promise<string> {
        const base = projName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'project'
        let slug = base, n = 2
        while ((projects ?? []).some(p => p.id === slug)) slug = `${base}-${n++}`
        const { data, error } = await supabase.from('projects').insert({
          id: slug, user_id: userId, cat_id: cat,
          name: projName, emoji: (args.emoji as string) || '🗂',
          status: (args.status as string) ?? 'actief',
          proj_type: (args.proj_type as string) ?? 'project',
          parent_id: parentId,
          description: '', vision: '', notes: null,
          html_content: null, is_priority: false, sort_order: 999,
        }).select('id, name').single()
        if (error) return `Fout bij aanmaken: ${error.message}`
        mutatedTabs.push('projects')
        return `✓ Project aangemaakt: "${data.name}" (id: ${data.id})${parentId ? ` als sub-project van ${parentId}` : ''}`
      }
    }

    if (name === 'update_project') {
      const projId = args.project_id as string
      const update: Record<string, unknown> = {}
      if (args.parent_id !== undefined) {
        const newParent = (args.parent_id as string) || null
        if (newParent === projId) return 'Fout: een project kan niet onder zichzelf hangen.'
        if (newParent && !(projects ?? []).some(p => p.id === newParent)) return `Fout: hoofdproject '${newParent}' bestaat niet.`
        update.parent_id = newParent
      }
      if (args.status !== undefined)      update.status = args.status
      if (args.is_priority !== undefined) update.is_priority = args.is_priority
      if (args.proj_type !== undefined)   update.proj_type = args.proj_type
      if (!Object.keys(update).length) return 'Fout: geef minimaal één veld op (parent_id, status, is_priority of proj_type).'
      update.updated_at = new Date().toISOString()
      const { data, error } = await supabase.from('projects').update(update)
        .eq('id', projId).eq('user_id', userId).select('name, status, parent_id, is_priority, proj_type').single()
      if (error) return `Fout bij bijwerken: ${error.message}`
      mutatedTabs.push('projects')
      return `✓ Project "${data.name}" bijgewerkt — status: ${data.status}, type: ${data.proj_type}${data.parent_id ? `, ↳ onder ${data.parent_id}` : ''}${data.is_priority ? ', ⭐ prioriteit' : ''}`
    }

    // ── Week items ───────────────────────────────────────────────────────────────

    if (name === 'add_week_item') {
      const { data, error } = await supabase.from('week_items').insert({
        user_id:  userId,
        date:     args.date as string,
        text:     args.text as string,
        type:     (args.type    as string) ?? 'task',
        done:     false,
        proj_id:  (args.proj_id as string) ?? null,
        recur_id: null,
        time_block: (args.time_block as string) ?? null,
      }).select('id, date, text, type, time_block').single()
      if (error) return `Fout bij aanmaken: ${error.message}`
      mutatedTabs.push('week')
      return `✓ Gepland: "${data.text}" op ${data.date}${data.time_block ? ` om ${data.time_block}` : ''} (${data.type})`
    }

    if (name === 'update_week_item') {
      const update: Record<string, unknown> = {}
      if (args.done !== undefined) update.done = args.done
      if (args.date)  update.date = args.date
      if (args.text)  update.text = args.text
      if (args.time_block !== undefined) update.time_block = (args.time_block as string) || null
      if (args.starred !== undefined) update.starred = args.starred
      if (!Object.keys(update).length) return 'Fout: geef minimaal één veld op om bij te werken.'
      const { data, error } = await supabase
        .from('week_items').update(update)
        .eq('id', args.item_id as number).eq('user_id', userId)
        .select('text, date, done, time_block, starred').single()
      if (error) return `Fout bij bijwerken: ${error.message}`
      mutatedTabs.push('week')
      const status = data.done ? '✓ gedaan' : '○ open'
      return `✓ Week-item bijgewerkt: "${data.text}" op ${data.date}${data.time_block ? ` om ${data.time_block}` : ''}${data.starred ? ' ⭐' : ''} — ${status}`
    }

    if (name === 'delete_week_item') {
      const { data, error } = await supabase
        .from('week_items').delete()
        .eq('id', args.item_id as number).eq('user_id', userId)
        .select('text').single()
      if (error) return `Fout bij verwijderen: ${error.message}`
      mutatedTabs.push('week')
      return `✓ Week-item "${data.text}" verwijderd.`
    }

    if (name === 'get_week_items') {
      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date())
      const from  = (args.from as string) ?? today
      const toDate = new Date(from + 'T12:00:00')
      toDate.setDate(toDate.getDate() + 7)
      const to = (args.to as string) ?? toDate.toISOString().slice(0, 10)
      const { data } = await supabase
        .from('week_items').select('id, date, text, type, done, proj_id, time_block')
        .eq('user_id', userId).gte('date', from).lte('date', to).order('date').order('id')
      if (!data?.length) return `Geen items gepland van ${from} tot ${to}.`
      const byDate: Record<string, typeof data> = {}
      for (const item of data) { (byDate[item.date] ??= []).push(item) }
      return Object.entries(byDate).map(([date, items]) =>
        `${date}:\n${items.map((i: { id: number; type: string; done: boolean; text: string; proj_id: string | null; time_block: string | null }) =>
          `  ${i.done ? '✓' : '○'} [${i.id}] [${i.type}]${i.time_block ? ` ${i.time_block}` : ''} ${i.text}${i.proj_id ? ` (${i.proj_id})` : ''}`
        ).join('\n')}`
      ).join('\n\n')
    }

    // ── Recurring tasks ──────────────────────────────────────────────────────────

    if (name === 'add_recurring_task') {
      const days = (args.days as string[]) ?? []
      if (!days.length) return 'Fout: geef minimaal één dag op.'
      const { data, error } = await supabase.from('recurring_tasks').insert({
        user_id: userId,
        name:    args.name as string,
        days,
        type:    (args.type    as string) ?? 'task',
        proj_id: (args.proj_id as string) ?? null,
        active:  true,
      }).select('id, name, days, type').single()
      if (error) return `Fout bij aanmaken: ${error.message}`
      mutatedTabs.push('week')
      const dagNamen: Record<string, string> = { monday:'maandag', tuesday:'dinsdag', wednesday:'woensdag', thursday:'donderdag', friday:'vrijdag', saturday:'zaterdag', sunday:'zondag' }
      const dagenNl = data.days.map((d: string) => dagNamen[d] ?? d).join(', ')
      return `✓ Wekelijkse taak aangemaakt: "${data.name}" — elke ${dagenNl} (ID: ${data.id})`
    }

    if (name === 'list_recurring_tasks') {
      const { data } = await supabase.from('recurring_tasks').select('id, name, days, type, active').eq('user_id', userId).order('id')
      if (!data?.length) return 'Geen herhalende taken gevonden.'
      const dagNamen: Record<string, string> = { monday:'ma', tuesday:'di', wednesday:'wo', thursday:'do', friday:'vr', saturday:'za', sunday:'zo' }
      return data.map((rt: { id: number; name: string; days: string[]; type: string; active: boolean }) =>
        `[${rt.id}] ${rt.active ? '✓' : '✗'} "${rt.name}" — ${rt.days.map((d: string) => dagNamen[d] ?? d).join('/')} (${rt.type})`
      ).join('\n')
    }

    if (name === 'delete_recurring_task') {
      const { data, error } = await supabase
        .from('recurring_tasks').delete()
        .eq('id', args.recurring_task_id as number).eq('user_id', userId)
        .select('name').single()
      if (error) return `Fout bij verwijderen: ${error.message}`
      mutatedTabs.push('week')
      return `✓ Herhalende taak "${data.name}" verwijderd.`
    }

    // ── Achievements & goals ─────────────────────────────────────────────────────

    if (name === 'get_achievements') {
      const days = (args.days as number) ?? 30
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - days)
      const fromStr = fromDate.toISOString().slice(0, 10)
      const { data } = await supabase
        .from('achievements').select('date, text, emoji')
        .eq('user_id', userId).gte('date', fromStr)
        .order('date', { ascending: false }).limit(50)
      if (!data?.length) return `Geen prestaties gevonden in de afgelopen ${days} dagen.`
      return data.map((a: { date: string; text: string; emoji: string }) =>
        `${a.emoji || '🏆'} ${a.date}: ${a.text}`
      ).join('\n')
    }

    if (name === 'add_achievement') {
      const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date())
      const { data, error } = await supabase.from('achievements').insert({
        user_id: userId,
        text:    args.text as string,
        emoji:   (args.emoji as string) ?? '🏆',
        date:    (args.date as string) ?? todayStr,
        cat_id:  null,
      }).select('id, text, emoji, date').single()
      if (error) return `Fout bij opslaan: ${error.message}`
      mutatedTabs.push('achievements')
      return `✓ Prestatie opgeslagen: ${data.emoji} "${data.text}" (${data.date})`
    }

    if (name === 'get_goals') {
      // Weggegooide doelen bestaan niet meer — ook niet voor de AI
      let q = supabase.from('goals').select('text, horizon, done, deadline')
        .eq('user_id', userId).is('deleted_at', null)
      if (args.horizon) q = q.eq('horizon', args.horizon as string)
      const { data } = await q.order('created_at')
      if (!data?.length) return 'Geen doelen gevonden.'
      const horizonLabel: Record<string, string> = { nu: 'Nu', wk: 'Deze week', '6w': '6 weken', kwartaal: 'Kwartaal', jaar: 'Jaar' }
      const byHorizon: Record<string, typeof data> = {}
      for (const g of data) { (byHorizon[g.horizon] ??= []).push(g) }
      return Object.entries(byHorizon).map(([h, goals]) =>
        `[${horizonLabel[h] ?? h}]\n${goals.map((g: { done: boolean; text: string; deadline: string | null }) =>
          `  ${g.done ? '✓' : '○'} ${g.text}${g.deadline ? ` (deadline: ${g.deadline})` : ''}`
        ).join('\n')}`
      ).join('\n\n')
    }

    // ── Dagboek ────────────────────────────────────────────────────────────────────

    if (name === 'add_diary_entry') {
      const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date())
      const { data, error } = await supabase.from('diary_entries').insert({
        user_id: userId,
        text:    args.text as string,
        date:    (args.date as string) ?? todayStr,
      }).select('id, date').single()
      if (error) return `Fout bij opslaan dagboek: ${error.message}`
      mutatedTabs.push('dagboek')
      return `✓ Dagboek-entry opgeslagen (${data.date}).`
    }

    if (name === 'get_diary_entries') {
      const limit = (args.limit as number) ?? 15
      const { data } = await supabase
        .from('diary_entries').select('date, text')
        .eq('user_id', userId)
        .order('date', { ascending: false }).order('id', { ascending: false })
        .limit(limit)
      if (!data?.length) return 'Nog geen dagboek-entries.'
      return data.map((d: { date: string; text: string }) => `📔 ${d.date}\n${d.text}`).join('\n\n---\n\n')
    }

    // ── Mood tracker ──────────────────────────────────────────────────────────────

    if (name === 'log_mood') {
      const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date())
      const mood = Math.max(-10, Math.min(10, Math.round(Number(args.mood))))
      if (!Number.isFinite(mood)) return 'Fout: geef een stemming tussen -10 en +10 op.'
      const row: Record<string, unknown> = {
        user_id: userId, date: (args.date as string) ?? todayStr, mood,
      }
      if (args.energy !== undefined)      row.energy = Math.max(1, Math.min(5, Math.round(Number(args.energy))))
      if (args.sleep_hours !== undefined) row.sleep_hours = Math.max(0, Math.min(24, Number(args.sleep_hours)))
      if (args.note !== undefined)        row.note = args.note as string
      // één meting per dag: opnieuw invullen werkt de bestaande dag bij
      const { data, error } = await supabase.from('mood_entries')
        .upsert(row, { onConflict: 'user_id,date' }).select('date, mood, energy, sleep_hours').single()
      if (error) return `Fout bij opslaan: ${error.message}`
      mutatedTabs.push('dagboek')
      return `✓ Stemming opgeslagen (${data.date}): ${data.mood > 0 ? '+' : ''}${data.mood}` +
        `${data.energy ? `, energie ${data.energy}/5` : ''}${data.sleep_hours ? `, ${data.sleep_hours}u slaap` : ''}`
    }

    if (name === 'get_mood_history') {
      const days = (args.days as number) ?? 14
      const from = new Date()
      from.setDate(from.getDate() - days)
      const { data } = await supabase
        .from('mood_entries').select('date, mood, energy, sleep_hours, note')
        .eq('user_id', userId).gte('date', from.toISOString().slice(0, 10))
        .order('date', { ascending: false })
      if (!data?.length) return `Nog geen stemmings-registraties in de afgelopen ${days} dagen.`
      const lines = data.map((d: { date: string; mood: number; energy: number|null; sleep_hours: number|null; note: string|null }) =>
        `${d.date}: stemming ${d.mood > 0 ? '+' : ''}${d.mood}` +
        `${d.energy ? `, energie ${d.energy}/5` : ''}${d.sleep_hours ? `, ${d.sleep_hours}u slaap` : ''}` +
        `${d.note ? ` — ${d.note}` : ''}`
      )
      const moods = data.map((d: { mood: number }) => d.mood)
      const gem = (moods.reduce((a: number, b: number) => a + b, 0) / moods.length).toFixed(1)
      return `${lines.join('\n')}\n\nGemiddelde stemming: ${gem} over ${data.length} dag(en).`
    }

    // ── Boodschappenlijstje ──────────────────────────────────────────────────────

    if (name === 'add_shopping_item') {
      const text = String(args.text ?? '').trim()
      if (!text) return 'Fout: geef een omschrijving van het item op.'
      const { error } = await supabase.from('shopping_items').insert({ user_id: userId, text })
      if (error) return `Fout bij opslaan: ${error.message}`
      mutatedTabs.push('boodschappen')
      return `✓ "${text}" op het boodschappenlijstje gezet.`
    }

    if (name === 'get_shopping_list') {
      const { data } = await supabase.from('shopping_items').select('text, done')
        .eq('user_id', userId).order('created_at')
      if (!data?.length) return 'Het boodschappenlijstje is leeg.'
      const open = data.filter((i: { done: boolean }) => !i.done)
      const done = data.filter((i: { done: boolean }) => i.done)
      let out = open.length ? `Nog te halen: ${open.map((i: { text: string }) => i.text).join(', ')}` : 'Niets meer te halen.'
      if (done.length) out += `\nAl gehaald: ${done.map((i: { text: string }) => i.text).join(', ')}`
      return out
    }

    // ── Financiën ────────────────────────────────────────────────────────────────

    if (name === 'add_money_entry') {
      const person = String(args.person ?? '').trim()
      const bedrag = Math.abs(Number(args.amount))
      if (!person) return 'Fout: geef aan om wie het gaat.'
      if (!Number.isFinite(bedrag) || bedrag <= 0) return 'Fout: geef een geldig bedrag op.'
      const direction = args.direction === 'i_owe' ? 'i_owe' : 'owed_to_me'
      const amount = direction === 'i_owe' ? -bedrag : bedrag
      const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date())
      const { error } = await supabase.from('finance_entries').insert({
        user_id: userId, person, amount,
        description: (args.description as string) ?? '', date: (args.date as string) ?? todayStr,
      })
      if (error) return `Fout bij opslaan: ${error.message}`
      mutatedTabs.push('financien')
      return `✓ ${person} ${direction === 'i_owe' ? 'krijgt' : 'is'} €${bedrag.toFixed(2)} ${direction === 'i_owe' ? 'van jou tegoed' : 'schuldig aan jou'}.`
    }

    if (name === 'get_money_overview') {
      const { data } = await supabase.from('finance_entries').select('person, amount, settled')
        .eq('user_id', userId)
      if (!data?.length) return 'Nog niets bijgehouden.'
      const open = (data as { person: string; amount: number; settled: boolean }[]).filter(e => !e.settled)
      if (!open.length) return 'Alles is verrekend — niets meer openstaand.'
      const perPerson = new Map<string, number>()
      for (const e of open) perPerson.set(e.person, (perPerson.get(e.person) ?? 0) + e.amount)
      const lines = [...perPerson.entries()].map(([person, saldo]) =>
        saldo > 0 ? `${person} is €${saldo.toFixed(2)} schuldig aan jou` :
        saldo < 0 ? `Jij bent €${Math.abs(saldo).toFixed(2)} schuldig aan ${person}` :
        `${person}: quitte`
      )
      return lines.join('\n')
    }

    // ── Zakgeld (Sam & Robin) ────────────────────────────────────────────────────

    if (name === 'add_allowance_entry') {
      const child = String(args.child ?? '').trim()
      const amount = Number(args.amount)
      if (!child) return 'Fout: geef aan van welk kind dit is.'
      if (!Number.isFinite(amount) || amount === 0) return 'Fout: geef een geldig bedrag op (positief = erbij, negatief = uitgegeven).'
      const todayStr = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date())
      const { error } = await supabase.from('allowance_entries').insert({
        user_id: userId, child, amount,
        description: (args.description as string) ?? '', date: (args.date as string) ?? todayStr,
      })
      if (error) return `Fout bij opslaan: ${error.message}`
      mutatedTabs.push('zakgeld')
      return `✓ ${child}: ${amount >= 0 ? '+' : ''}€${amount.toFixed(2)}${args.description ? ` (${args.description})` : ''}.`
    }

    if (name === 'delete_allowance_entry') {
      const id = Number(args.id)
      if (!Number.isFinite(id)) return 'Fout: geef een geldig entry-id op.'
      const { error } = await supabase.from('allowance_entries').delete().eq('id', id).eq('user_id', userId)
      if (error) return `Fout bij verwijderen: ${error.message}`
      mutatedTabs.push('zakgeld')
      return '✓ Zakgeld-entry verwijderd.'
    }

    if (name === 'get_allowance_overview') {
      const [{ data: entries }, { data: goals }] = await Promise.all([
        supabase.from('allowance_entries').select('id, child, amount, description, date').eq('user_id', userId).order('date', { ascending: false }),
        supabase.from('allowance_goals').select('id, child, title, url, target_amount, achieved').eq('user_id', userId),
      ])
      if (!entries?.length && !goals?.length) return 'Nog geen zakgeld bijgehouden.'
      const perChild = new Map<string, number>()
      for (const e of (entries ?? []) as { child: string; amount: number }[]) perChild.set(e.child, (perChild.get(e.child) ?? 0) + e.amount)
      const lines = [...perChild.entries()].map(([child, saldo]) => `${child}: saldo €${saldo.toFixed(2)}`)
      const openGoals = (goals ?? []) as { id: number; child: string; title: string; target_amount: number | null; achieved: boolean }[]
      if (openGoals.length) {
        lines.push('', 'Spaardoelen:')
        for (const g of openGoals) {
          const target = g.target_amount != null ? ` (streef €${g.target_amount.toFixed(2)})` : ''
          lines.push(`- [${g.id}] ${g.child}: ${g.title}${target}${g.achieved ? ' ✓ gehaald' : ''}`)
        }
      }
      return lines.join('\n')
    }

    if (name === 'add_allowance_goal') {
      const child = String(args.child ?? '').trim()
      const title = String(args.title ?? '').trim()
      if (!child || !title) return 'Fout: geef zowel het kind als een titel voor het spaardoel op.'
      const targetAmount = args.target_amount != null ? Number(args.target_amount) : null
      const { error } = await supabase.from('allowance_goals').insert({
        user_id: userId, child, title,
        url: (args.url as string)?.trim() || null,
        target_amount: targetAmount != null && Number.isFinite(targetAmount) ? targetAmount : null,
      })
      if (error) return `Fout bij opslaan: ${error.message}`
      mutatedTabs.push('zakgeld')
      return `✓ Spaardoel voor ${child} toegevoegd: ${title}.`
    }

    if (name === 'update_allowance_goal') {
      const id = Number(args.id)
      if (!Number.isFinite(id)) return 'Fout: geef een geldig doel-id op (zie get_allowance_overview).'
      const patch: Record<string, unknown> = {}
      if (args.achieved !== undefined) patch.achieved = Boolean(args.achieved)
      if (args.title !== undefined) patch.title = String(args.title).trim()
      if (args.url !== undefined) patch.url = String(args.url).trim() || null
      if (args.target_amount !== undefined) {
        const t = Number(args.target_amount)
        patch.target_amount = Number.isFinite(t) ? t : null
      }
      if (!Object.keys(patch).length) return 'Fout: geef minstens één veld op om te wijzigen.'
      const { error } = await supabase.from('allowance_goals').update(patch).eq('id', id).eq('user_id', userId)
      if (error) return `Fout bij bijwerken: ${error.message}`
      mutatedTabs.push('zakgeld')
      return '✓ Spaardoel bijgewerkt.'
    }

    if (name === 'delete_allowance_goal') {
      const id = Number(args.id)
      if (!Number.isFinite(id)) return 'Fout: geef een geldig doel-id op.'
      const { error } = await supabase.from('allowance_goals').delete().eq('id', id).eq('user_id', userId)
      if (error) return `Fout bij verwijderen: ${error.message}`
      mutatedTabs.push('zakgeld')
      return '✓ Spaardoel verwijderd.'
    }

    // ── Vrije skills ──────────────────────────────────────────────────────────────

    if (name === 'get_skills') {
      const { data } = await supabase.from('xp_events').select('skill, amount')
        .eq('user_id', userId).not('skill', 'is', null)
      const { data: cats } = await supabase.from('categories').select('id, name').eq('user_id', userId)
      const catList = (cats ?? []).map((c: { id: string; name: string }) => `${c.id} (${c.name})`).join(', ')
      const catHint = catList ? `\n\nLevensgebieden om als cat_id te gebruiken: ${catList}` : ''
      if (!data?.length) return 'Nog geen vaardigheden. Ken XP toe met award_skill_xp; nieuwe namen mag je zelf verzinnen.' + catHint
      const totals = new Map<string, number>()
      for (const e of data as { skill: string; amount: number }[]) {
        const key = e.skill.trim().toLowerCase()
        totals.set(key, (totals.get(key) ?? 0) + e.amount)
      }
      return [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, xp]) => `${name} — ${xp} XP (level ${Math.floor(0.5 + Math.sqrt(0.25 + 0.02 * xp))})`)
        .join('\n') + catHint
    }

    if (name === 'award_skill_xp') {
      const list = (args.skills as { name: string; amount?: number }[]) ?? []
      if (!list.length) return 'Fout: geef minimaal één vaardigheid op.'
      const reason = (args.reason as string) ?? 'Vaardigheid geoefend'
      // cat_id koppelt de vaardigheid aan een levensgebied, zodat ze in het
      // overzicht bij elkaar staan. Alleen accepteren als het gebied bestaat.
      let catId: string | null = null
      if (args.cat_id) {
        const { data: cat } = await supabase.from('categories').select('id')
          .eq('user_id', userId).eq('id', (args.cat_id as string).trim().toLowerCase()).maybeSingle()
        catId = cat?.id ?? null
      }
      const done: string[] = []
      for (const s of list) {
        if (!s?.name?.trim()) continue
        const amount = Math.max(1, Math.min(50, Math.round(Number(s.amount) || 10)))
        const { error } = await supabase.from('xp_events').insert({
          user_id: userId, amount, reason, source: 'skill',
          skill: s.name.trim().toLowerCase(), cat_id: catId,
        })
        if (!error) done.push(`${s.name.trim().toLowerCase()} +${amount}`)
      }
      if (!done.length) return 'Fout: geen XP toegekend.'
      mutatedTabs.push('achievements')
      return `✓ Vaardigheids-XP: ${done.join(', ')}`
    }

    // ── XP / gamification ────────────────────────────────────────────────────────

    if (name === 'get_xp_status') {
      const [{ data: events }, { data: cats }] = await Promise.all([
        supabase.from('xp_events').select('amount, cat_id, source, created_at').eq('user_id', userId),
        supabase.from('categories').select('id, name').eq('user_id', userId),
      ])
      if (!events) return 'Het XP-systeem is nog niet actief (migratie niet gedraaid).'
      const rows  = events as { amount: number; cat_id: string | null; source: string; created_at: string }[]
      const total = rows.reduce((s, e) => s + e.amount, 0)
      const prog  = levelProgress(total)
      const streak = computeStreaks(rows.map(e => e.created_at))
      const catXp = new Map<string, number>()
      for (const e of rows) if (e.cat_id) catXp.set(e.cat_id, (catXp.get(e.cat_id) ?? 0) + e.amount)
      const skills = ((cats ?? []) as { id: string; name: string }[])
        .map(c => ({ name: c.name, icon: categoryIcon(c.name), xp: catXp.get(c.id) ?? 0, level: skillLevelForXp(catXp.get(c.id) ?? 0) }))
        .sort((a, b) => b.xp - a.xp)
      const skillLines = skills.filter(s => s.xp > 0)
        .map(s => `  ${s.icon} ${s.name}: Lvl ${s.level} (${s.xp} XP)`).join('\n')
      return `⭐ Level ${prog.level} — ${levelTitle(prog.level)}\n` +
        `${total} XP totaal · nog ${prog.toNext} XP tot Level ${prog.level + 1} (${prog.pct}% onderweg)\n` +
        `🔥 Streak: ${streak.current} dag(en) · langste: ${streak.best}\n` +
        (skillLines ? `\nSkills per levensgebied:\n${skillLines}` : '')
    }

    // ── External services ────────────────────────────────────────────────────────

    if (name === 'get_recent_emails') {
      const gmailToken = await getGoogleToken(supabase, userId)
      if (!gmailToken) return 'Google is niet verbonden. Vertel de gebruiker dat die opnieuw moet inloggen via de Google-knop op /login.'
      try {
        const msgs = await fetchGmailMessages(gmailToken, 20)
        if (!msgs.length) return 'Geen ongelezen mails gevonden.'
        return msgs.map(m =>
          `Van: ${m.from}\nOnderwerp: ${m.subject}\nDatum: ${m.date}\nPreview: ${m.snippet}`
        ).join('\n\n---\n\n')
      } catch (e) {
        const code = (e as Error).message
        if (code === 'GMAIL_SCOPE_MISSING')
          return 'Gmail-toegang geweigerd. De gebruiker moet uitloggen en opnieuw inloggen via /login.'
        if (code === 'GMAIL_TOKEN_INVALID')
          return 'Het Google-token is verlopen. De gebruiker moet opnieuw inloggen via /login.'
        return `Gmail niet bereikbaar (${code}).`
      }
    }

    if (name === 'get_weather') {
      try {
        const w = await fetchWeatherData()
        const rainParts = w.rainForecast.slice(0, 6).map((x: { time: string; mm: number }) => `${x.time}: ${x.mm.toFixed(1)} mm/u`).join(', ')
        const forecastText = w.forecast.map((d: { date: string; minTemp: number; maxTemp: number; rainChance: number; description: string }) =>
          `${d.date}: ${d.minTemp}–${d.maxTemp}°C, kans op regen ${d.rainChance}% (${d.description})`
        ).join('\n')
        return `Weer (station: ${w.station}, ${w.distance} km):\n` +
          `Huidig: ${w.current.temperature}°C, ${w.current.description}, wind ${w.current.windDirection} ${w.current.windSpeed} m/s\n` +
          `Regenradar 2u: ${rainParts || 'geen regen verwacht'}\n` +
          (forecastText ? `\nVoorspelling:\n${forecastText}` : '')
      } catch {
        return 'Weer ophalen mislukt. Buienradar niet bereikbaar.'
      }
    }

    // ── Self-builder tools ───────────────────────────────────────────────────────

    if (name === 'read_file') {
      const rel = args.path as string
      const abs = safeBuildPath(rel)
      if (!abs) return 'Fout: ongeldig pad (buiten projectroot).'
      try {
        const stat = await fs.stat(abs)
        if (stat.size > MAX_BUILD_BYTES) return `Bestand te groot (${Math.round(stat.size / 1024)}KB, max 200KB).`
        const content = await fs.readFile(abs, 'utf-8')
        const lines = content.split('\n').length
        return `[${rel}] — ${lines} regels\n\`\`\`\n${content}\n\`\`\``
      } catch {
        return `Bestand niet gevonden: ${rel}`
      }
    }

    if (name === 'list_files') {
      const rel = (args.path as string | undefined) ?? ''
      const abs = safeBuildPath(rel)
      if (!abs) return 'Fout: ongeldig pad.'
      try {
        const entries = await fs.readdir(abs, { withFileTypes: true })
        const lines = entries
          .filter(e => !['node_modules', '.next', '.git', '.turbo'].includes(e.name))
          .map(e => {
            const p = rel ? `${rel}/${e.name}` : e.name
            return `${e.isDirectory() ? '📁' : '📄'} ${p}`
          })
        return lines.length ? lines.join('\n') : 'Lege map.'
      } catch {
        return `Map niet gevonden: ${rel || 'root'}`
      }
    }

    if (name === 'write_file') {
      const rel = (args.path as string | undefined) ?? ''
      if (BUILD_BLOCKED.some(b => rel === b || rel.endsWith(b))) {
        return `Geblokkeerd: ${rel} mag niet worden overschreven (kernbestand).`
      }
      const abs = safeBuildPath(rel)
      if (!abs) return 'Fout: ongeldig pad (buiten projectroot).'
      await fs.mkdir(path.dirname(abs), { recursive: true })
      const content = (args.content as string) ?? ''
      await fs.writeFile(abs, content, 'utf-8')
      return `✓ Bestand geschreven: ${rel} (${content.split('\n').length} regels, ${content.length} tekens). Voer nu run_type_check uit.`
    }

    if (name === 'run_type_check') {
      try {
        const tscBin  = path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, 'node_modules', '.bin', 'tsc.cmd')
        const tscJson = path.join(/*turbopackIgnore: true*/ PROJECT_ROOT, 'tsconfig.json')
        const { stdout, stderr } = await execAsync(
          `"${tscBin}" --noEmit --project "${tscJson}"`,
          { cwd: PROJECT_ROOT, timeout: 30000 }
        )
        const out = (stdout + stderr).trim()
        return out || '✓ Geen TypeScript-fouten — alles klopt.'
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string }
        const out = ((err.stdout ?? '') + (err.stderr ?? '')).trim()
        const count = (out.match(/error TS/g) ?? []).length
        return `${count} TypeScript-fout(en) gevonden:\n${out.slice(0, 3000)}`
      }
    }

    if (name === 'git_commit') {
      const files   = (args.files as string[]) ?? []
      const message = ((args.message as string) ?? 'Horizon AI: auto-build').replace(/"/g, "'")
      if (!files.length) return 'Fout: geef bestanden op om te commiten.'
      const invalidPaths = files.filter(f => !safeBuildPath(f))
      if (invalidPaths.length) return `Fout: ongeldige paden: ${invalidPaths.join(', ')}`
      try {
        const quotedFiles = files.map(f => `"${f}"`).join(' ')
        await execAsync(`git add ${quotedFiles}`, { cwd: PROJECT_ROOT, timeout: 15000 })
        const { stdout } = await execAsync(
          `git commit -m "[Horizon AI] ${message}"`,
          { cwd: PROJECT_ROOT, timeout: 15000 }
        )
        const hash = stdout.match(/\[master ([a-f0-9]+)\]/)?.[1] ?? '?'
        return `✓ Git commit ${hash}: "[Horizon AI] ${message}"\nBestanden: ${files.join(', ')}\nOmkeerbaar met: git reset HEAD~1`
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string }
        const out = ((err.stdout ?? '') + (err.stderr ?? '')).trim()
        return `Git fout: ${out || String(e)}`
      }
    }

    return 'Onbekende tool'
  }

  return async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await run(name, args)
    // Registreer een geslaagde AI-mutatie in de XP-log. Tabel bestaat mogelijk
    // nog niet (migratie niet gedraaid) → fout stil negeren zodat de tool blijft werken.
    if (XP_LOGGED.has(name) && result.startsWith('✓')) {
      try {
        await supabase.from('xp_events').insert({
          user_id: userId,
          amount:  XP_AMOUNTS.ai,
          source:  'ai',
          reason:  `🤖 ${result.replace(/^✓\s*/, '').split('\n')[0].slice(0, 140)}`,
        })
      } catch { /* xp-systeem nog niet gemigreerd — negeren */ }
    }
    return result
  }
}
