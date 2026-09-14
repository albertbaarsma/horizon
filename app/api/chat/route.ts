import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { checkRateLimit } from '@/lib/rate-limit'
import { createToolExecutor } from '@/lib/tool-executor'

const ANTHROPIC_URL     = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL             = 'claude-haiku-4-5-20251001'

export type ChatAttachment =
  | { type: 'image'; mimeType: string; base64: string; name: string }
  | { type: 'text';  content: string;  name: string }

// ─── Anthropic message types ──────────────────────────────────────────────────

type ATextBlock   = { type: 'text';        text: string }
type AImageBlock  = { type: 'image';       source: { type: 'base64'; media_type: string; data: string } }
type AToolUse     = { type: 'tool_use';    id: string; name: string; input: Record<string, unknown> }
type AToolResult  = { type: 'tool_result'; tool_use_id: string; content: string }
type ABlock = ATextBlock | AImageBlock | AToolUse | AToolResult
type AMsg   = { role: 'user' | 'assistant'; content: string | ABlock[] }

// ─── Tool definitions (Anthropic format) ─────────────────────────────────────

const TOOLS = [
  {
    name: 'get_tasks',
    description: 'Haal taken op uit de planningsapp, optioneel gefilterd op status of project',
    input_schema: {
      type: 'object',
      properties: {
        status:  { type: 'string', enum: ['backlog','doing','waiting','done'] },
        proj_id: { type: 'string', description: 'Project ID om op te filteren' },
      },
    },
  },
  {
    name: 'update_task',
    description: 'Verander de status of urgentie van een taak (bijv. markeer als done, of zet op doing)',
    input_schema: {
      type: 'object',
      required: ['task_id','status'],
      properties: {
        task_id: { type: 'number', description: 'Het numerieke ID van de taak' },
        status:  { type: 'string', enum: ['backlog','doing','waiting','done'] },
        urgent:  { type: 'boolean' },
      },
    },
  },
  {
    name: 'add_task',
    description: 'Voeg een nieuwe taak toe. Zonder proj_id komt de taak in de 📥 inbox (nog geen project).',
    input_schema: {
      type: 'object',
      required: ['name'],
      properties: {
        proj_id: { type: 'string', description: 'Optioneel project ID (bijv. "acme-co", "tuinproject"). Weglaten = inbox.' },
        name:    { type: 'string', description: 'Naam van de taak' },
        status:  { type: 'string', enum: ['backlog','doing','waiting'] },
        urgent:  { type: 'boolean' },
      },
    },
  },
  {
    name: 'get_projects',
    description: 'Haal alle projecten op met hun status, beschrijving en hiërarchie (sub-projecten hangen onder een hoofdproject)',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_project',
    description: 'Maak een nieuw project aan, optioneel als sub-project onder een hoofdproject. Gebruik bij "maak een (sub)project X (onder Y)".',
    input_schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name:      { type: 'string', description: 'Naam van het project' },
        emoji:     { type: 'string', description: 'Eén passende emoji (standaard 🗂)' },
        cat_id:    { type: 'string', description: 'Categorie-id (bijv. "werk", "thuis"). Niet nodig als parent_id is gezet — dan erft het de categorie.' },
        parent_id: { type: 'string', description: 'Optioneel: id van het hoofdproject waar dit onder hangt' },
        status:    { type: 'string', enum: ['actief','lopend','urgent','soon','visie','slapend','onzeker','love'], description: 'Standaard: actief' },
        proj_type: { type: 'string', enum: ['project','routine'] },
      },
    },
  },
  {
    name: 'update_project',
    description: 'Wijzig de STRUCTUUR van een project: status, prioriteit, type, of onder welk hoofdproject het hangt. Kan bewust GEEN beschrijving/visie/notities wijzigen — inhoud past de gebruiker zelf aan.',
    input_schema: {
      type: 'object',
      required: ['project_id'],
      properties: {
        project_id:  { type: 'string', description: 'Het project-id (bijv. "tuinproject")' },
        parent_id:   { type: 'string', description: 'Id van het hoofdproject, of lege string "" om het project los te maken' },
        status:      { type: 'string', enum: ['actief','lopend','urgent','soon','visie','slapend','onzeker','love','archief'] },
        is_priority: { type: 'boolean', description: 'true = in de ⭐ prioriteiten-sectie' },
        proj_type:   { type: 'string', enum: ['project','routine'] },
      },
    },
  },
  {
    name: 'get_recent_emails',
    description: 'Haal de laatste ongelezen Gmail-berichten op van de gebruiker. Gebruik dit als die vraagt naar nieuwe of interessante mails.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_weather',
    description: 'Haal het actuele weer op voor de standaardlocatie van de gebruiker (in te stellen), inclusief regenradar voor de komende 2 uur.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'delete_task',
    description: 'Verwijder een taak permanent. Gebruik alleen als de taak niet meer relevant is.',
    input_schema: {
      type: 'object',
      required: ['task_id'],
      properties: {
        task_id: { type: 'number', description: 'Het numerieke ID van de taak' },
      },
    },
  },
  {
    name: 'add_week_item',
    description: 'Plan een item op een specifieke datum in de weekplanning van de gebruiker',
    input_schema: {
      type: 'object',
      required: ['date','text'],
      properties: {
        date:       { type: 'string', description: 'Datum YYYY-MM-DD, bijv. "2026-07-08"' },
        text:       { type: 'string', description: 'Beschrijving van het item' },
        type:       { type: 'string', enum: ['task','cal','sport','kids','urgent'] },
        proj_id:    { type: 'string', description: 'Optioneel project ID' },
        time_block: { type: 'string', description: 'Optioneel tijdblok HH:MM (30-min raster, bijv. "09:30")' },
      },
    },
  },
  {
    name: 'update_week_item',
    description: 'Pas een bestaand week-item aan: markeer als gedaan/ongedaan, verplaats naar andere datum, wijzig de tekst, of geef het een ster (belangrijk).',
    input_schema: {
      type: 'object',
      required: ['item_id'],
      properties: {
        item_id:    { type: 'number', description: 'Het numerieke ID van het week-item' },
        done:       { type: 'boolean', description: 'true = afgevinkt, false = ongedaan' },
        date:       { type: 'string', description: 'Nieuwe datum YYYY-MM-DD om het item naar te verplaatsen' },
        text:       { type: 'string', description: 'Nieuwe tekst voor het item' },
        time_block: { type: 'string', description: 'Tijdblok HH:MM (30-min raster, bijv. "14:00"); lege string verwijdert het tijdblok' },
        starred:    { type: 'boolean', description: 'true = ster geven (markeer als belangrijk), false = ster weghalen' },
      },
    },
  },
  {
    name: 'delete_week_item',
    description: 'Verwijder een item uit de weekplanning permanent',
    input_schema: {
      type: 'object',
      required: ['item_id'],
      properties: {
        item_id: { type: 'number', description: 'Het numerieke ID van het week-item' },
      },
    },
  },
  {
    name: 'get_week_items',
    description: 'Haal geplande items op voor een datum of periode (standaard: de komende 7 dagen)',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Startdatum YYYY-MM-DD (standaard: vandaag)' },
        to:   { type: 'string', description: 'Einddatum YYYY-MM-DD (standaard: 7 dagen na from)' },
      },
    },
  },
  {
    name: 'add_recurring_task',
    description: 'Maak een wekelijks herhalende taak/activiteit aan die op vaste dagen terugkomt in de weekplanning. Gebruik dit wanneer iemand zegt "elke dinsdag", "wekelijks", "iedere maandag en vrijdag", etc.',
    input_schema: {
      type: 'object',
      required: ['name', 'days'],
      properties: {
        name:    { type: 'string', description: 'Naam van de herhalende activiteit, bijv. "Mam helpen in de tuin"' },
        days:    { type: 'array',  items: { type: 'string', enum: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] }, description: 'Dagen van de week waarop dit herhaalt, bijv. ["tuesday"] of ["monday","friday"]' },
        type:    { type: 'string', enum: ['task','cal','sport','kids','urgent'], description: 'Type activiteit (standaard: task)' },
        proj_id: { type: 'string', description: 'Optioneel project ID' },
      },
    },
  },
  {
    name: 'list_recurring_tasks',
    description: 'Toon alle wekelijks herhalende taken/activiteiten van de gebruiker',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'delete_recurring_task',
    description: 'Verwijder een herhalende taak permanent zodat hij niet meer in de weekplanning verschijnt',
    input_schema: {
      type: 'object',
      required: ['recurring_task_id'],
      properties: {
        recurring_task_id: { type: 'number', description: 'Het ID van de herhalende taak' },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Lees een projectbestand (max 200KB). Gebruik dit vóór write_file om de context te begrijpen voordat je schrijft.',
    input_schema: {
      type: 'object',
      required: ['path'],
      properties: {
        path: { type: 'string', description: 'Relatief pad vanuit projectroot, bijv. "app/dashboard/VisiTab.tsx" of "CODEBASE.md"' },
      },
    },
  },
  {
    name: 'list_files',
    description: 'Toon bestanden en mappen in een directory. Gebruik om de projectstructuur te verkennen.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relatief pad, bijv. "app/dashboard" of "" voor projectroot' },
      },
    },
  },
  {
    name: 'write_file',
    description: 'Schrijf of overschrijf een projectbestand. Gebruik ná read_file + planning. Kritieke bestanden zijn geblokkeerd. Voer daarna altijd run_type_check uit.',
    input_schema: {
      type: 'object',
      required: ['path', 'content'],
      properties: {
        path:    { type: 'string', description: 'Relatief pad vanuit projectroot, bijv. "app/api/mijnfeature/route.ts"' },
        content: { type: 'string', description: 'Volledige bestandsinhoud (TypeScript/TSX/etc.)' },
      },
    },
  },
  {
    name: 'run_type_check',
    description: 'Voer tsc --noEmit uit om TypeScript-fouten te controleren. Gebruik ALTIJD na write_file om te verifiëren dat er geen fouten zijn.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'git_commit',
    description: 'Maak een git commit checkpoint na een succesvolle build. Gebruik ALLEEN als run_type_check geen fouten heeft gemeld. De commit is omkeerbaar met git reset HEAD~1.',
    input_schema: {
      type: 'object',
      required: ['files', 'message'],
      properties: {
        files:   { type: 'array', items: { type: 'string' }, description: 'Bestanden om te stagen, bijv. ["app/api/nieuw/route.ts", "CODEBASE.md"]' },
        message: { type: 'string', description: 'Commit message die kort beschrijft wat er gebouwd is' },
      },
    },
  },
  {
    name: 'get_achievements',
    description: 'Haal recente prestaties/successen op van de gebruiker. Gebruik als die vraagt "wat heb ik bereikt", "wat waren mijn successen deze week" of "geef me een overzicht van de afgelopen maand".',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Aantal dagen terug (standaard: 30)' },
      },
    },
  },
  {
    name: 'add_achievement',
    description: 'Sla een prestatie of succes op. Gebruik als de gebruiker iets positiefs meldt: "ik heb X afgerond", "het is gelukt", "vandaag deed ik Y". Kies een passende emoji: 🏆 groot succes, ✨ magisch moment, 🎵 muziek, 💪 sport/gezondheid, 📝 leermoment.',
    input_schema: {
      type: 'object',
      required: ['text'],
      properties: {
        text:  { type: 'string', description: 'Beschrijving van de prestatie' },
        emoji: { type: 'string', description: 'Passende emoji voor deze prestatie' },
        date:  { type: 'string', description: 'Datum YYYY-MM-DD (standaard: vandaag)' },
      },
    },
  },
  {
    name: 'get_goals',
    description: 'Haal doelen op per tijdshorizon. Gebruik als de gebruiker vraagt naar diens doelen, plannen of ambities voor dit jaar/kwartaal.',
    input_schema: {
      type: 'object',
      properties: {
        horizon: { type: 'string', enum: ['nu','wk','6w','kwartaal','jaar'], description: 'Filter op horizon (laat leeg voor alle doelen)' },
      },
    },
  },
  {
    name: 'add_diary_entry',
    description: 'Sla een dagboek-entry op. Gebruik dit als de gebruiker een verhaal, gevoel, gedachte of gebeurtenis vertelt dat GEEN concrete prestatie of verbeterpunt is, maar meer een persoonlijk relaas — iets dat die later wil kunnen teruglezen. Sla de woorden van de gebruiker zo trouw mogelijk op (in de ik-vorm). Vraag niet om toestemming als de gebruiker duidelijk iets aan het vertellen is; noem daarna kort dat je het in het dagboek hebt gezet.',
    input_schema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string', description: 'De dagboek-entry, in de eigen woorden van de gebruiker (ik-vorm)' },
        date: { type: 'string', description: 'Datum YYYY-MM-DD (standaard: vandaag)' },
      },
    },
  },
  {
    name: 'log_mood',
    description: 'Leg de stemming van de gebruiker voor een dag vast (sommige gebruikers houden dit bij om patronen in hun gemoedstoestand te volgen). Gebruik dit als de gebruiker vertelt hoe die zich voelt, hoe die geslapen heeft of hoeveel energie die heeft. Vraag rustig na wat je nog niet weet (slaap en energie zijn waardevol), maar dring niet aan. Registreer alleen wat de gebruiker zelf zegt — jij bepaalt niet hoe die zich voelt.',
    input_schema: {
      type: 'object',
      required: ['mood'],
      properties: {
        mood:        { type: 'number', description: 'Stemming van -10 (zwaar omlaag) via 0 (neutraal) tot +10 (heel hoog/opgejaagd)' },
        energy:      { type: 'number', description: 'Energie 1 (uitgeput) t/m 5 (veel energie)' },
        sleep_hours: { type: 'number', description: 'Aantal uren geslapen die nacht' },
        note:        { type: 'string', description: 'Korte toelichting in zijn eigen woorden' },
        date:        { type: 'string', description: 'Datum YYYY-MM-DD (standaard: vandaag)' },
      },
    },
  },
  {
    name: 'get_mood_history',
    description: 'Haal de stemmings-registraties van de gebruiker op (stemming, energie, slaap). Gebruik dit als de gebruiker vraagt hoe het gaat/ging, of om patronen te zien vóór je iets over de week zegt. BELANGRIJK: beschrijf alleen wat er staat ("vijf dagen op rij laag ingevuld", "je sliep korter dan normaal") — stel geen diagnose, gebruik geen klinische termen als manisch of depressief, en geef geen medisch of medicatie-advies. Als een patroon je zorgen baart, benoem dat je het ziet en stel voorzichtig voor om het met een behandelaar of iemand die de gebruiker vertrouwt te delen.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Aantal dagen terug (standaard 14)' },
      },
    },
  },
  {
    name: 'add_shopping_item',
    description: 'Zet een item op het boodschappenlijstje van de gebruiker.',
    input_schema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string', description: 'Wat er op het lijstje moet, bijv. "plakband houder"' },
      },
    },
  },
  {
    name: 'get_shopping_list',
    description: 'Haal het boodschappenlijstje op — wat nog gehaald moet worden en wat al gehaald is.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_money_entry',
    description: 'Leg een bedrag vast dat iemand de gebruiker schuldig is, of dat de gebruiker iemand schuldig is (bijv. les gegeven, boodschappen gekregen, geld geleend). Gebruik dit als de gebruiker vertelt over geld dat die nog moet krijgen of nog moet betalen aan een specifiek persoon.',
    input_schema: {
      type: 'object',
      required: ['person', 'amount', 'direction'],
      properties: {
        person:      { type: 'string', description: 'Naam van de persoon, bijv. "Broer" of "Buurman"' },
        amount:      { type: 'number', description: 'Bedrag in euro\'s, altijd positief — de richting bepaalt of het + of - wordt' },
        direction:   { type: 'string', enum: ['owed_to_me', 'i_owe'], description: 'owed_to_me = deze persoon is de gebruiker dit schuldig; i_owe = de gebruiker is deze persoon dit schuldig' },
        description: { type: 'string', description: 'Korte omschrijving, bijv. "Bijles 15 augustus"' },
        date:        { type: 'string', description: 'Datum YYYY-MM-DD (standaard: vandaag)' },
      },
    },
  },
  {
    name: 'get_money_overview',
    description: 'Haal op wie de gebruiker nog geld schuldig is en aan wie de gebruiker nog geld schuldig is, met de nettostand per persoon.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_allowance_entry',
    description: 'Boek een zakgeld-mutatie voor een kind (wekelijks zakgeld, cadeaugeld, of iets dat het kind heeft uitgegeven). Gebruik dit als de gebruiker vertelt over zakgeld erbij of eraf.',
    input_schema: {
      type: 'object',
      required: ['child', 'amount'],
      properties: {
        child:       { type: 'string', description: 'Naam van het kind' },
        amount:      { type: 'number', description: 'Bedrag in euro\'s, signed: positief = geld erbij (zakgeld, cadeau), negatief = uitgegeven' },
        description: { type: 'string', description: 'Waaraan/waarvoor, bijv. "weekgeld" of "ijsje"' },
        date:        { type: 'string', description: 'Datum YYYY-MM-DD (standaard: vandaag)' },
      },
    },
  },
  {
    name: 'delete_allowance_entry',
    description: 'Verwijder een zakgeld-mutatie (bijv. om een fout te corrigeren). Het id komt uit get_allowance_overview.',
    input_schema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'number', description: 'Id van de zakgeld-entry' } },
    },
  },
  {
    name: 'get_allowance_overview',
    description: 'Haal het zakgeld-saldo per kind op, plus hun spaardoelen (met id, zodat je die kan bijwerken of verwijderen).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_allowance_goal',
    description: 'Voeg een spaardoel toe voor een kind (iets waar het voor spaart).',
    input_schema: {
      type: 'object',
      required: ['child', 'title'],
      properties: {
        child:         { type: 'string', description: 'Naam van het kind' },
        title:         { type: 'string', description: 'Wat ze willen, bijv. "LEGO-set" of "Nieuwe fiets"' },
        url:           { type: 'string', description: 'Link naar het product (optioneel)' },
        target_amount: { type: 'number', description: 'Streefbedrag in euro\'s (optioneel)' },
      },
    },
  },
  {
    name: 'update_allowance_goal',
    description: 'Wijzig een bestaand spaardoel, of markeer het als gehaald/gekocht. Het id komt uit get_allowance_overview.',
    input_schema: {
      type: 'object',
      required: ['id'],
      properties: {
        id:            { type: 'number', description: 'Id van het spaardoel' },
        achieved:      { type: 'boolean', description: 'true = gehaald/gekocht, false = terugzetten naar openstaand' },
        title:         { type: 'string', description: 'Nieuwe titel (optioneel)' },
        url:           { type: 'string', description: 'Nieuwe link (optioneel)' },
        target_amount: { type: 'number', description: 'Nieuw streefbedrag (optioneel)' },
      },
    },
  },
  {
    name: 'delete_allowance_goal',
    description: 'Verwijder een spaardoel. Het id komt uit get_allowance_overview.',
    input_schema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'number', description: 'Id van het spaardoel' } },
    },
  },
  {
    name: 'get_skills',
    description: 'Haal de vaardigheden van de gebruiker op met hun XP en level (vrije skill-tree: sociaal, IT, marketing, muziek…). Roep dit ALTIJD aan vóór award_skill_xp, zodat je bestaande namen hergebruikt in plaats van varianten aan te maken.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'award_skill_xp',
    description: 'Ken XP toe aan één of meer vaardigheden. Gebruik dit direct nadat je een prestatie hebt opgeslagen (add_achievement) of een taak hebt afgevinkt: bepaal welke 1–3 vaardigheden de gebruiker daarmee geoefend heeft. Bestaat de vaardigheid nog niet? Verzin dan zelf een passende, herbruikbare naam (kort, algemeen: "sociaal", "muziek", "ondernemen", "discipline"). Meld daarna kort welke vaardigheden XP kregen.',
    input_schema: {
      type: 'object',
      required: ['skills'],
      properties: {
        skills: {
          type: 'array',
          description: '1–3 vaardigheden met hun XP',
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name:   { type: 'string', description: 'Vaardigheidsnaam, kort en herbruikbaar' },
              amount: { type: 'number', description: 'XP (10–20 gebruikelijk, max 50)' },
            },
          },
        },
        reason: { type: 'string', description: 'Waarvoor deze XP is (wordt in de log opgeslagen)' },
        cat_id: { type: 'string', description: 'Levensgebied waar dit bij hoort (bv. "muzikant", "thuis"). Vaardigheden worden in het overzicht ONDER hun levensgebied getoond, dus vul dit in als je weet waar het thuishoort — get_skills geeft de geldige waarden.' },
      },
    },
  },
  {
    name: 'get_diary_entries',
    description: 'Lees recente dagboek-entries terug. Gebruik als de gebruiker vraagt wat die eerder heeft verteld/geschreven, of om context op te halen over hoe het ervoor stond.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Aantal entries (standaard 15)' },
      },
    },
  },
  {
    name: 'get_xp_status',
    description: 'Haal de huidige XP, level, streak en skills (XP per levensgebied) van de gebruiker op. Roep dit aan NA het afvinken van een taak, of het toevoegen van een prestatie of doel — die acties geven automatisch XP — zodat je kunt melden hoeveel XP het opleverde en of de gebruiker een level omhoog ging. Ook bruikbaar als de gebruiker vraagt "hoeveel XP heb ik" of "welk level ben ik".',
    input_schema: { type: 'object', properties: {} },
  },
]

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!checkRateLimit(user.id)) return NextResponse.json({ error: 'Te veel verzoeken. Even wachten.' }, { status: 429 })

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const provider  = (profile?.ai_provider  ?? 'anthropic') as string
  const aiModel   = (profile?.ai_model     ?? '') as string
  const aiBaseUrl = (profile?.ai_base_url  ?? '') as string
  const aiApiKey  = (profile?.ai_api_key || process.env.ANTHROPIC_API_KEY) as string | undefined

  const body = await req.json() as {
    messages: { role: string; content: string | unknown[] }[]
    attachments?: ChatAttachment[]
    providerOverride?: { provider: string; model: string }
  }
  const { messages, attachments = [], providerOverride } = body

  // providerOverride (from widget quick-switcher) takes precedence over profile settings
  const effectiveProvider = providerOverride?.provider || provider
  const effectiveModel    = providerOverride?.model    || aiModel

  const [{ data: projects }, { data: openTasks }] = await Promise.all([
    supabase.from('projects').select('id, name, emoji, status, description, parent_id').eq('user_id', user.id),
    supabase.from('tasks').select('id, proj_id, name, status, urgent')
      .eq('user_id', user.id).neq('status', 'done').order('created_at'),
  ])

  // ── Tool executor ───────────────────────────────────────────────────────────

  const mutatedTabs: string[] = []
  const executeTool = createToolExecutor({ supabase, userId: user.id, projects, mutatedTabs })

  // ── Build messages ──────────────────────────────────────────────────────────

  const system    = buildSystemPrompt(projects ?? [], openTasks ?? [])
  const hasImages = attachments.some(a => a.type === 'image')

  const lastMsg   = messages[messages.length - 1]
  const lastText  = typeof lastMsg?.content === 'string' ? lastMsg.content : ''

  // ── OpenAI-compatible providers (Ollama, LM Studio, OpenAI) ────────────────
  // Met tool-support: zelfde tool-loop als het Anthropic-pad, in OpenAI-formaat.

  if (effectiveProvider !== 'anthropic') {
    const defaultBase = effectiveProvider === 'ollama' ? 'http://localhost:11434'
                      : effectiveProvider === 'lmstudio' ? 'http://localhost:1234'
                      : 'https://api.openai.com'
    const baseUrl  = aiBaseUrl || defaultBase
    const model    = effectiveModel || (effectiveProvider === 'ollama' ? 'mistral' : effectiveProvider === 'lmstudio' ? 'local-model' : 'gpt-4o-mini')
    // Ollama/LM Studio/OpenAI delen allemaal hetzelfde `<root>/v1/chat/completions`-pad,
    // maar niet elke OpenAI-compatible aanbieder doet dat — Google's Gemini-laag zit op
    // `.../v1beta/openai/chat/completions`, zonder extra /v1. Staat de basis-URL al op
    // .../chat/completions (compleet pad ingevuld door de gebruiker), gebruik 'm dan zoals
    // hij is; anders het vertrouwde /v1/chat/completions erachter plakken.
    const completionsUrl = baseUrl.replace(/\/$/, '').endsWith('/chat/completions')
      ? baseUrl.replace(/\/$/, '')
      : `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`

    const openAiTools = TOOLS.map(t => ({
      type: 'function' as const,
      function: { name: t.name, description: t.description, parameters: t.input_schema },
    }))

    type OToolCall = { id: string; type: 'function'; function: { name: string; arguments: string } }
    type OMsg =
      | { role: 'system' | 'user'; content: string }
      | { role: 'assistant'; content: string | null; tool_calls?: OToolCall[] }
      | { role: 'tool'; tool_call_id: string; content: string }

    const oMsgs: OMsg[] = [
      { role: 'system', content: system },
      ...messages.slice(0, -1).map(m => ({
        role:    (m.role === 'assistant' ? 'assistant' : 'user') as 'user',
        content: typeof m.content === 'string' ? m.content : '',
      })),
      { role: 'user', content: lastText },
    ]

    const reqHeaders: Record<string, string> = { 'content-type': 'application/json' }
    if (aiApiKey) reqHeaders['Authorization'] = `Bearer ${aiApiKey}`

    const toolSteps: { tool: string; label: string }[] = []
    let finalText  = ''
    let toolsOk    = true   // modellen zonder tool-support vallen terug op plain chat

    for (let round = 0; round < 8; round++) {
      const res = await fetch(completionsUrl, {
        method:  'POST',
        headers: reqHeaders,
        body:    JSON.stringify({
          model, messages: oMsgs, max_tokens: 2048, temperature: 0.4,
          ...(toolsOk ? { tools: openAiTools } : {}),
        }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        if (toolsOk && round === 0 && /tool/i.test(errText)) { toolsOk = false; round--; continue }
        console.error('OpenAI-compat error:', res.status, errText)
        return NextResponse.json({ error: `AI niet bereikbaar (${res.status}). Is ${effectiveProvider === 'ollama' ? 'Ollama' : 'LM Studio'} actief?` }, { status: 500 })
      }

      const data      = await res.json()
      const msg       = data.choices?.[0]?.message ?? {}
      const toolCalls = (msg.tool_calls ?? []) as OToolCall[]

      if (!toolCalls.length) {
        finalText = (msg.content as string | null) ?? ''
        break
      }

      oMsgs.push({ role: 'assistant', content: msg.content ?? null, tool_calls: toolCalls })
      for (const tc of toolCalls) {
        let input: Record<string, unknown> = {}
        try { input = JSON.parse(tc.function.arguments || '{}') } catch {}
        toolSteps.push({ tool: tc.function.name, label: humanizeToolCall(tc.function.name, input) })
        const result = await executeTool(tc.function.name, input)
        oMsgs.push({ role: 'tool', tool_call_id: tc.id, content: result })
      }
    }

    if (!finalText) finalText = 'Ik kon je verzoek niet afmaken. Probeer het anders te formuleren.'

    // Zelfde SSE-vorm als het Anthropic-pad, zodat JarvisWidget niets hoeft te weten
    const encoder    = new TextEncoder()
    const uniqueTabs = [...new Set(mutatedTabs)]
    const sse = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const step of toolSteps) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'step', tool: step.tool, label: step.label })}\n\n`))
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: finalText } }] })}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(sse, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
        ...(uniqueTabs.length ? { 'X-Mutations': uniqueTabs.join(',') } : {}),
      },
    })
  }

  // ── Anthropic path (with full tool support) ────────────────────────────────

  if (!aiApiKey) return NextResponse.json({ error: 'Geen Anthropic API key geconfigureerd. Ga naar Instellingen → AI om een key in te voeren.' }, { status: 500 })

  function buildLastUserContent(): string | ABlock[] {
    if (!attachments.length) return lastText

    const textFiles = attachments.filter(a => a.type === 'text') as { type: 'text'; content: string; name: string }[]
    const prefix    = textFiles.length
      ? textFiles.map(f => `[Bestand: ${f.name}]\n${f.content.slice(0, 4000)}`).join('\n\n') + '\n\n' + lastText
      : lastText

    const blocks: ABlock[] = [{ type: 'text', text: prefix }]
    for (const a of attachments) {
      if (a.type === 'image') {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: a.mimeType, data: a.base64 } })
      }
    }
    return blocks
  }

  const historyMsgs: AMsg[] = messages.slice(0, -1).map(m => ({
    role:    m.role as 'user' | 'assistant',
    content: m.content as string,
  }))

  const msgs: AMsg[] = [
    ...historyMsgs,
    { role: 'user', content: buildLastUserContent() },
  ]

  const model = effectiveModel || MODEL

  function apiHeaders() {
    return { 'x-api-key': aiApiKey!, 'anthropic-version': ANTHROPIC_VERSION, 'content-type': 'application/json' }
  }

  function baseBody(stream = false) {
    return {
      model,
      system,
      messages: msgs,
      ...(hasImages ? {} : { tools: TOOLS, tool_choice: { type: 'auto' } }),
      max_tokens:  8192,
      temperature: 0.4,
      ...(stream ? { stream: true } : {}),
    }
  }

  // ── Tool loop — max 8 rounds (supports multi-step self-builds) ────────────

  const toolSteps: { tool: string; label: string }[] = []

  for (let round = 0; round < 8; round++) {
    const res = await fetch(ANTHROPIC_URL, {
      method:  'POST',
      headers: apiHeaders(),
      body:    JSON.stringify(baseBody()),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Anthropic error:', err)
      return NextResponse.json({ error: 'AI niet bereikbaar. Probeer opnieuw.' }, { status: 500 })
    }

    const responseData               = await res.json()
    const content: ABlock[]          = responseData.content ?? []
    const stopReason: string         = responseData.stop_reason ?? 'end_turn'
    const toolUseBlocks              = content.filter((b): b is AToolUse => b.type === 'tool_use')

    // No more tool calls → stream the final answer
    if (stopReason !== 'tool_use' || !toolUseBlocks.length) {
      const streamRes = await fetch(ANTHROPIC_URL, {
        method:  'POST',
        headers: apiHeaders(),
        body:    JSON.stringify(baseBody(true)),
      })

      if (!streamRes.ok || !streamRes.body) {
        const fallback = content.find((b): b is ATextBlock => b.type === 'text')?.text ?? 'Geen antwoord.'
        return NextResponse.json({ content: fallback, mutations: [...new Set(mutatedTabs)] })
      }

      // Transform Anthropic SSE → OpenAI SSE format so JarvisWidget stays unchanged
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
      const writer  = writable.getWriter()
      const encoder = new TextEncoder()
      const decoder = new TextDecoder()

      ;(async () => {
        try {
          // Send collected tool steps before streaming the answer text
          for (const step of toolSteps) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'step', tool: step.tool, label: step.label })}\n\n`))
          }
          const reader = streamRes.body!.getReader()
          let buf = '', currentEvent = ''
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() ?? ''
            for (const line of lines) {
              if (line.startsWith('event: ')) { currentEvent = line.slice(7).trim(); continue }
              if (!line.startsWith('data: '))  continue
              const raw = line.slice(6)
              if (currentEvent === 'content_block_delta') {
                try {
                  const parsed = JSON.parse(raw)
                  if (parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
                    const chunk = JSON.stringify({ choices: [{ delta: { content: parsed.delta.text } }] })
                    await writer.write(encoder.encode(`data: ${chunk}\n\n`))
                  }
                } catch {}
              } else if (currentEvent === 'message_stop') {
                await writer.write(encoder.encode('data: [DONE]\n\n'))
              }
            }
          }
        } finally {
          writer.close().catch(() => {})
        }
      })()

      const uniqueTabs = [...new Set(mutatedTabs)]
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
          ...(uniqueTabs.length ? { 'X-Mutations': uniqueTabs.join(',') } : {}),
        },
      })
    }

    // Add the assistant's tool-use message
    msgs.push({ role: 'assistant', content })

    // Execute all tool calls and collect results
    const toolResults: AToolResult[] = []
    for (const block of toolUseBlocks) {
      toolSteps.push({ tool: block.name, label: humanizeToolCall(block.name, block.input) })
      const result = await executeTool(block.name, block.input)
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
    }
    msgs.push({ role: 'user', content: toolResults })
  }

  return NextResponse.json({ content: 'Ik kon je verzoek niet afmaken. Probeer het anders te formuleren.', mutations: [...new Set(mutatedTabs)] })
}

// ─── Tool step label ─────────────────────────────────────────────────────────

function humanizeToolCall(name: string, input: Record<string, unknown>): string {
  const str = (k: string) => (input[k] as string | undefined) ?? ''
  const num = (k: string) => String(input[k] ?? '')
  switch (name) {
    case 'get_tasks':            return `📋 Taken ophalen${str('status') ? ` (${str('status')})` : ''}`
    case 'get_week_items':       return `📅 Weekplanning ophalen`
    case 'add_task':             return `✅ Taak aanmaken: "${str('name')}"`
    case 'update_task':          return `✏️ Taak bijwerken [#${num('task_id')}]`
    case 'delete_task':          return `🗑️ Taak verwijderen [#${num('task_id')}]`
    case 'add_week_item':        return `📅 Inplannen op ${str('date')}: "${str('text')}"`
    case 'update_week_item':     return `✏️ Week-item bijwerken [#${num('item_id')}]${str('text') ? `: "${str('text')}"` : ''}`
    case 'delete_week_item':     return `🗑️ Week-item verwijderen [#${num('item_id')}]`
    case 'add_recurring_task':   return `🔁 Vaste taak aanmaken: "${str('name')}"`
    case 'delete_recurring_task':return `🗑️ Vaste taak verwijderen [#${num('recurring_task_id')}]`
    case 'list_recurring_tasks': return `🔁 Vaste taken ophalen`
    case 'get_weather':          return `🌤️ Weer ophalen`
    case 'get_recent_emails':    return `📧 E-mails lezen`
    case 'get_projects':         return `📁 Projecten ophalen`
    case 'add_project':          return `🗂 Project aanmaken: "${str('name')}"${str('parent_id') ? ` onder ${str('parent_id')}` : ''}`
    case 'update_project':       return `🧩 Project bijwerken: ${str('project_id')}`
    case 'add_achievement':      return `🏆 Prestatie opslaan: "${str('text')}"`
    case 'get_achievements':     return `🏆 Prestaties ophalen`
    case 'get_goals':            return `🎯 Doelen ophalen`
    case 'get_xp_status':        return `⭐ XP & level checken`
    case 'read_file':            return `📄 Bestand lezen: ${str('path')}`
    case 'list_files':           return `📁 Map lezen: ${str('path') || 'root'}`
    case 'write_file':           return `💾 Bestand schrijven: ${str('path')}`
    case 'run_type_check':       return `⚙️ TypeScript controle`
    case 'git_commit':           return `🔖 Git commit: "${str('message')}"`
    default:                     return `🔧 ${name.replace(/_/g, ' ')}`
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  projects: { id: string; emoji: string; name: string; status: string; parent_id?: string | null }[],
  tasks:    { id: number; proj_id: string | null; name: string; status: string; urgent: boolean }[]
): string {
  const urgent  = tasks.filter(t => t.urgent)
  const doing   = tasks.filter(t => t.status === 'doing' && !t.urgent)
  const waiting = tasks.filter(t => t.status === 'waiting')

  // Use Amsterdam timezone so the date is always correct for the user
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(new Date())

  const fmt = (t: { id: number; name: string; proj_id: string | null }) => `  [${t.id}] ${t.name} (${t.proj_id ?? '📥 inbox'})`

  return `Je bent Horizon AI, de persoonlijke AI assistent van Horizon.

Vandaag is het: ${today}

PROJECTEN (${projects.length}, ↳ = sub-project):
${(() => {
  const ids = new Set(projects.map(p => p.id))
  const roots = projects.filter(p => !p.parent_id || !ids.has(p.parent_id))
  const kids  = (id: string) => projects.filter(p => p.parent_id === id)
  return roots.flatMap(p => [
    `  ${p.emoji} ${p.id} — ${p.name} [${p.status}]`,
    ...kids(p.id).map(k => `     ↳ ${k.emoji} ${k.id} — ${k.name} [${k.status}]`),
  ]).join('\n')
})()}

URGENT (${urgent.length}):
${urgent.length ? urgent.map(fmt).join('\n') : '  — geen urgente taken'}

BEZIG (${doing.length}):
${doing.length ? doing.slice(0, 8).map(fmt).join('\n') : '  — niets'}

WACHTEN (${waiting.length}):
${waiting.length ? waiting.slice(0, 5).map(fmt).join('\n') : '  — niets'}

⚠️ KRITIEKE REGEL: Roep tools ALTIJD echt aan via de tool_use interface — NOOIT als tekst, pseudocode of code-block beschrijven. Als je denkt "ik zou update_week_item aanroepen", doe het dan ook echt. Een tool-aanroep als tekst beschrijven heeft GEEN effect op de data. Zeg nooit "ik gebruik add_week_item(...)" als tekst — activeer de tool.

INSTRUCTIES:
- Wees kort en direct. Geen lange uitleg tenzij gevraagd.
- Gebruik tools actief: als iemand zegt "doe X" → voer het uit en bevestig. Niet beschrijven, maar doen.
- Spreek Nederlands tenzij de gebruiker in het Engels schrijft.
- Bij "wat moet ik vandaag doen": geef urgente + doing taken, gesorteerd op prioriteit.
- Taak-IDs zijn getallen — gebruik die bij update_task en delete_task.
- Weet je een proj_id niet? Vraag het, of gebruik get_projects.
- VERPLICHT: Noem taken ALTIJD met hun numerieke ID tussen vierkante haken: [23] Taak naam. Gebruik NOOIT genummerde lijsten (1. 2. 3.) voor taken — alleen het [ID] formaat. Voorbeeld: "[23] Tandarts bellen — doing ⚡". Dit is essentieel zodat de gebruiker erop kan klikken.
- Bij vragen over mails: gebruik get_recent_emails en geef een beknopt overzicht van de interessantste/meest urgente berichten.
- Bij vragen over weer of buitenactiviteiten: gebruik get_weather en geef praktisch advies (bijv. "Trek een jas aan, regen over 20 min").
- Combineer context: als er regen verwacht wordt en de gebruiker vraagt wat die moet doen, noem dan of een geplande buitenactiviteit verstandig is.
- Bij "wat staat er op mijn planning" of "wat heb ik deze week": gebruik get_week_items om de weekplanning op te halen. Week-items hebben ook een [ID] in de output — gebruik die bij update_week_item en delete_week_item.
- Bij "plan X op Y" of "zet in mijn agenda op dag Z" (eenmalig, niet herhalend): gebruik add_week_item met de juiste datum (YYYY-MM-DD). "Morgen", "volgende week dinsdag", etc. zijn EENMALIG → add_week_item, niet add_recurring_task.
- Bij "kun je [bestaand item] aanpassen", "verander de tijd naar X", "zet het op X uur", "pas dat aan": roep EERST get_week_items aan om het item-ID te vinden. Gebruik dan update_week_item met het gevonden item_id en de nieuwe text/datum.
- Bij "markeer X als gedaan" of "verplaats X naar dinsdag": gebruik update_week_item met het juiste item_id.
- Bij "verwijder dat item" of "die afspraak hoeft niet meer": gebruik delete_week_item met het item_id.
- Bij "elke [dag]", "wekelijks", "iedere [dag]", "herhalend", "vaste [dag]": gebruik ALTIJD add_recurring_task met de juiste dag(en) in het Engels (monday/tuesday/wednesday/thursday/friday/saturday/sunday). Vertaal "dinsdag" → "tuesday", "woensdag" → "wednesday", etc. Nooit add_week_item gebruiken voor herhalende taken.
- Bij "welke vaste taken heb ik" of "wat herhaalt zich": gebruik list_recurring_tasks.
- Bij "verwijder vaste taak" of "stop met [activiteit] elke week": gebruik delete_recurring_task.
- Bij "verwijder taak X" of "die taak hoeft niet meer": gebruik delete_task met het ID. Vraag bevestiging als je het ID niet zeker weet.
- Bij "ik heb X bereikt", "het is gelukt", "vandaag deed ik Y": gebruik add_achievement en sla het op — kies de emoji die het beste past.
- Bij "wat heb ik bereikt", "wat waren mijn successen": gebruik get_achievements.
- Bij "wat zijn mijn doelen", "wat wil ik dit jaar": gebruik get_goals.
- XP & LEVELS (gamification): Horizon heeft een XP-systeem. Elke afgeronde taak geeft +10 XP (+5 als urgent), elke prestatie +25, elk nieuw doel +15, elk afgevinkt planning-item +5. Dit gebeurt AUTOMATISCH in de database zodra jij zo'n actie uitvoert — je hoeft zelf geen XP toe te kennen. Er is ook een level per levensgebied ("skill").
  → Nadat je een taak hebt afgevinkt, een prestatie of doel hebt toegevoegd: roep get_xp_status aan en meld kort hoeveel XP het opleverde en of de gebruiker een level omhoog ging. Bijvoorbeeld: "✅ Afgevinkt — +10 XP! Je staat nu op Level 7, nog 485 tot Level 8." Doe dit spontaan en enthousiast, maar kort (één zin). Bij een level-up: vier het extra ("🎉 LEVEL UP! Level 8 bereikt!").
  → Bij "hoeveel XP heb ik", "welk level ben ik", "hoe staat mijn [levensgebied] ervoor", "mijn stats": gebruik get_xp_status en geef een motiverend overzicht.
- SUB-PROJECTEN: projecten kunnen onder een hoofdproject hangen (↳ in de lijst hierboven). Bij "maak een (sub)project X onder Y": gebruik add_project met parent_id. Bij "hang X onder Y", "maak X los", "archiveer X", "maak X een routine/prioriteit": gebruik update_project. Taken voeg je gewoon toe aan het (sub)project zelf met add_task.
- update_project kan BEWUST geen beschrijving/visie/notities wijzigen — inhoud van projecten past de gebruiker zelf aan (of via de AI-import in de app, die voorstellen doet).
- Bij "plan mijn dag" of "verdeel mijn taken over de dag": haal EERST de items van vandaag op met get_week_items (from=to=vandaag). Geef daarna elk open item ZONDER tijdblok een logisch tijdblok via update_week_item (time_block, HH:MM op 30-min raster, tussen 09:00 en 17:30). Regels: nooit overlappen met items die al een tijdblok hebben, zware/belangrijke taken 's ochtends, korte taakjes na de lunch, max ~6 items inplannen. Sluit af met een compact overzicht van de dagindeling.

SUGGESTIES (verplicht): sluit ELK antwoord af met precies één extra regel in exact dit formaat:
SUGGESTIES: ["korte vervolgprompt 1","korte vervolgprompt 2","korte vervolgprompt 3"]
Dit zijn 2-3 acties die de gebruiker waarschijnlijk hierna wil doen (elk max 6 woorden, in het Nederlands, passend bij het gesprek — bijv. na een takenlijst: "Plan mijn dag" of "Markeer [23] als gedaan"). Geen andere tekst op die regel, geen uitleg erover.

ZELFBOUWEN (gebruik read_file, list_files, write_file, run_type_check, git_commit):
- Bij "kun je X bouwen", "voeg X toe aan de app", "de app mist X", "maak een nieuw scherm voor Y":
  1. Lees eerst CODEBASE.md met read_file voor de architectuurregels
  2. Lees 1-2 bestaande vergelijkbare bestanden met read_file voor patronen
  3. Plan in 2-3 zinnen: welke bestanden, welke aanpak
  4. Schrijf het nieuwe bestand met write_file (prefereer NIEUWE bestanden boven bestaande aanpassen)
  5. Voer run_type_check uit — fix eventuele fouten voor je rapporteert
  6. Als alles klopt: maak een git_commit checkpoint met de gewijzigde bestanden
  7. Rapporteer: wat gebouwd, welke bestanden, welke git hash, wat de gebruiker moet testen
- Nooit app/api/chat/route.ts of app/api/build/route.ts overschrijven
- Alleen .ts, .tsx, .css, .json, .md bestanden schrijven — geen binaries
- Als een feature data nodig heeft die nog niet in de DB zit, beschrijf de SQL die de gebruiker moet uitvoeren`
}
