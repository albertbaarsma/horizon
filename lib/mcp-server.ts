// De gehoste MCP-server: dezelfde 11 tools als de lokale horizon-mcp-stdio-
// server, maar hier direct in-process tegen lib/ai-tools.ts (geen eigen
// fetch-rondje naar onze eigen REST-API nodig, dat script proxyde alleen omdat
// het los van deze app draait). `buildMcpHandler` wordt per request opnieuw
// aangeroepen (stateless mode van mcp-handler) zodat de tool-callbacks sluiten
// over de al-opgeloste userId van die ene request.
import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import * as tools from './ai-tools'

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function fout(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  return { content: [{ type: 'text' as const, text: `Fout: ${msg}` }], isError: true }
}

export function buildMcpHandler(userId: string) {
  return createMcpHandler((server) => {
    // ── Taken ──────────────────────────────────────────────────────────────
    server.registerTool('get_tasks', {
      description: 'Haal alle taken op. Optioneel filter op status.',
      inputSchema: { status: z.enum(['backlog', 'doing', 'done']).optional().describe('Filter op status (optioneel)') },
    }, async ({ status }) => {
      try { return ok(await tools.listTasks(userId, status)) } catch (e) { return fout(e) }
    })

    server.registerTool('add_task', {
      description: 'Maak een nieuwe taak aan.',
      inputSchema: {
        proj_id: z.string().describe('Project-ID (bijv. "acme-co", "klussen")'),
        name: z.string().describe('Naam van de taak'),
        status: z.enum(['backlog', 'doing', 'done']).optional().describe('Standaard: backlog'),
        urgent: z.boolean().optional().describe('Markeer als urgent'),
      },
    }, async (args) => {
      try { return ok(await tools.createTask(userId, args)) } catch (e) { return fout(e) }
    })

    server.registerTool('update_task', {
      description: 'Werk een taak bij (status, naam, urgent).',
      inputSchema: {
        id: z.number().describe('Taak-ID'),
        name: z.string().optional(),
        status: z.enum(['backlog', 'doing', 'done']).optional(),
        urgent: z.boolean().optional(),
      },
    }, async ({ id, ...fields }) => {
      try { return ok(await tools.updateTask(userId, String(id), fields)) } catch (e) { return fout(e) }
    })

    server.registerTool('delete_task', {
      description: 'Verwijder een taak.',
      inputSchema: { id: z.number().describe('Taak-ID') },
    }, async ({ id }) => {
      try { return ok(await tools.deleteTask(userId, String(id))) } catch (e) { return fout(e) }
    })

    // ── Achievements ─────────────────────────────────────────────────────────
    server.registerTool('add_achievement', {
      description: 'Voeg een achievement toe aan het dashboard.',
      inputSchema: {
        text: z.string().describe('Omschrijving van het achievement'),
        emoji: z.string().optional().describe('Emoji (standaard ⭐)'),
        cat_id: z.string().optional().describe('Categorie-ID (optioneel)'),
        date: z.string().optional().describe('Datum YYYY-MM-DD (standaard: vandaag)'),
      },
    }, async (args) => {
      try { return ok(await tools.addAchievement(userId, args)) } catch (e) { return fout(e) }
    })

    server.registerTool('get_achievements', {
      description: 'Haal recente achievements op.',
      inputSchema: { limit: z.number().optional().describe('Max aantal (standaard 20)') },
    }, async ({ limit }) => {
      try { return ok(await tools.listAchievements(userId, limit ?? 20)) } catch (e) { return fout(e) }
    })

    // ── Weekplanning ─────────────────────────────────────────────────────────
    server.registerTool('get_week_items', {
      description: 'Haal weekplanning op voor een datumbereik.',
      inputSchema: {
        from: z.string().optional().describe('Startdatum YYYY-MM-DD (optioneel)'),
        to: z.string().optional().describe('Einddatum YYYY-MM-DD (optioneel)'),
      },
    }, async ({ from, to }) => {
      try { return ok(await tools.listWeekItems(userId, from, to)) } catch (e) { return fout(e) }
    })

    server.registerTool('add_week_item', {
      description: 'Voeg een item toe aan de weekplanning.',
      inputSchema: {
        date: z.string().describe('Datum YYYY-MM-DD'),
        text: z.string().describe('Omschrijving, bijv. "Tandarts" — zet een tijdstip in time_block'),
        type: z.enum(['task', 'event', 'note']).optional().describe('Standaard: task'),
        time_block: z.string().optional().describe('Begintijd HH:MM (optioneel), bijv. "09:30"'),
      },
    }, async (args) => {
      try { return ok(await tools.addWeekItem(userId, args)) } catch (e) { return fout(e) }
    })

    server.registerTool('update_week_item', {
      description: 'Pas een weekplanning-item aan (tekst, datum, tijd, afgevinkt).',
      inputSchema: {
        id: z.number().describe('Item-ID'),
        text: z.string().optional(),
        date: z.string().optional().describe('YYYY-MM-DD'),
        done: z.boolean().optional(),
        time_block: z.string().optional().describe('Begintijd HH:MM; een lege string haalt de tijd weg'),
      },
    }, async ({ id, ...fields }) => {
      try { return ok(await tools.updateWeekItem(userId, String(id), fields)) } catch (e) { return fout(e) }
    })

    server.registerTool('delete_week_item', {
      description: 'Verwijder een weekplanning-item.',
      inputSchema: { id: z.number().describe('Item-ID') },
    }, async ({ id }) => {
      try { return ok(await tools.deleteWeekItem(userId, String(id))) } catch (e) { return fout(e) }
    })

    // ── XP / gamification ────────────────────────────────────────────────────
    server.registerTool('get_xp', {
      description: 'Haal de huidige XP-status, level en skills (XP per levensgebied) op. ' +
        'Gebruik dit NA het afvinken van een taak, toevoegen van een prestatie of doel — die acties ' +
        'geven automatisch XP. Elke taak = +10 XP (+5 urgent), prestatie = +25, doel = +15.',
      inputSchema: {},
    }, async () => {
      try { return ok(await tools.getXpStatus(userId)) } catch (e) { return fout(e) }
    })
  }, { serverInfo: { name: 'horizon', version: '1.0.0' } })
}
