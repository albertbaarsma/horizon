// ─── Vertalingen voor de publieke landingspagina ──────────────────────────────
// Eén bron voor de EN/NL-inhoud van app/LandingPage.tsx. De rest van de app
// (dashboard, updatelog, over-pagina) blijft gewoon Nederlands — dit bestand
// bestaat puur voor de homepage-i18n.

import type { Lang } from './lang'
export type { Lang }

interface Kaart { emoji: string; titel: string; tekst: string }
interface Koppeling extends Kaart { straks?: boolean }

interface LandingContent {
  pil: string
  h1: [string, string]
  lead: string
  ctaBeginnen: string
  ctaAlHeb: string
  noot: string
  bijgewerkt: (datum: string) => string
  bord: {
    titel: string
    kol1: string; kol1Kaarten: [string, string]
    kol2: string; kol2Kaarten: [string, string]
    kol3: string; kol3Kaarten: [string, string]
  }
  sectie1: { label: string; h2: string; intro: string }
  functies: Kaart[]
  rpm: { label: string; h2: string; intro: string; credit: string; link: string }
  ai: {
    label: string; h2: string; intro: string
    bubbelJij: string; bubbelAi: string; bubbelDoen: [string, string]
    watMag: string; watMagIntro: string
    li: [string, string, string]
  }
  koppelSectie: { label: string; h2: string; intro: string; binnenkort: string }
  koppelingen: Koppeling[]
  stappenSectie: { label: string; h2: string; intro: string }
  stappen: { titel: string; tekst: string }[]
  slot: { h2: string; intro: string; beginnen: string; inloggen: string }
  nav: { updates: string; over: string; rpm: string; inloggen: string; account: string }
  voet: (naam: string) => string
}

// Toolnamen zijn technische identifiers — taalonafhankelijk, in beide versies gelijk.
export const MCP_TOOLS = [
  'get_tasks', 'add_task', 'update_task', 'delete_task',
  'get_week_items', 'add_week_item', 'update_week_item', 'delete_week_item',
  'get_achievements', 'add_achievement', 'get_xp',
]

export const LANDING: Record<Lang, LandingContent> = {
  nl: {
    pil: 'Gratis alpha · een hobbyproject',
    h1: ['Je hele leven in één overzicht —', 'en je AI mag meekijken'],
    lead: 'Horizon brengt je visie, doelen, projecten, taken en week bij elkaar op één plek. Geen losse lijstjes meer die elkaar tegenspreken. En omdat je je AI eraan koppelt, hoef je het niet allemaal zelf bij te houden: je vertelt wat er veranderd is, en je planning schuift mee.',
    ctaBeginnen: 'Beginnen',
    ctaAlHeb: 'Ik heb al een account',
    noot: 'Inloggen met Google of e-mail',
    bijgewerkt: datum => ` · laatst bijgewerkt ${datum}`,
    bord: {
      titel: '🎯 Doelen',
      kol1: '📅 Deze week', kol1Kaarten: ['Setlist afmaken', '3× sporten'],
      kol2: '📆 6 weken', kol2Kaarten: ['Album opnemen', 'Moestuin klaar'],
      kol3: '📊 Kwartaal', kol3Kaarten: ['Dak gerepareerd', '20 optredens'],
    },
    sectie1: {
      label: 'Wat je ermee doet',
      h2: 'Van levensvisie tot wat je vanmiddag oppakt.',
      intro: 'De meeste planners beginnen bij je takenlijst en houden daar op. Horizon begint bij waar je heen wil, en rekent dat terug naar deze week — zodat je op een drukke dag nog steeds ziet waaróm iets op je lijst staat.',
    },
    functies: [
      { emoji: '🎯', titel: 'Doelen op vijf horizonnen',
        tekst: 'Nu, deze week, zes weken, kwartaal en dit jaar — naast elkaar. Schuiven je plannen? Sleep een doel naar een andere horizon.' },
      { emoji: '🌟', titel: 'Visie per levensgebied',
        tekst: 'Gezondheid, werk, gezin, muziek — elk gebied krijgt zijn eigen visie, waarom, rollen en resources. Gebouwd rond de RPM-methode.' },
      { emoji: '📅', titel: 'Week, maand en dag',
        tekst: 'Een weekraster waarin je taken naar dagen sleept, herhaaltaken die zichzelf inplannen, en een dagoverzicht dat laat zien wat er nú toe doet.' },
      { emoji: '✅', titel: 'Taken en projecten',
        tekst: 'Van losse inbox-taak tot project onder een levensgebied. Backlog, mee bezig, wachtend, klaar — met een kanban die meebeweegt.' },
      { emoji: '🏆', titel: 'Wins, XP en levels',
        tekst: 'Elk gehaald doel wordt automatisch een prestatie. Je verzamelt XP en klimt in level, zodat vooruitgang zichtbaar wordt in plaats van vanzelfsprekend.' },
      { emoji: '📓', titel: 'Dagboek en stemming',
        tekst: 'Schrijf kort terug op je dag en houd je stemming bij. Over weken heen zie je patronen die je in het moment mist.' },
      { emoji: '📊', titel: 'Inzicht en consistentie',
        tekst: 'Een heatmap van je productiviteit, een 3D-graaf van hoe je projecten samenhangen, en een controle die aangeeft waar je plan uit elkaar loopt.' },
      { emoji: '🧭', titel: 'Wekelijkse plansessie',
        tekst: 'Eén begeleide ronde per week: terug naar je visie, prestaties vieren, en van daaruit je week neerzetten.' },
    ],
    rpm: {
      label: 'De methode',
      h2: 'Gebouwd op RPM, niet een kopie ervan.',
      intro: 'Horizon volgt de RPM-methode (Rapid Planning Method) van Tony Robbins: begin bij je ultieme visie, werk terug naar wat dat vraagt, en laat je takenlijst daaruit volgen — in plaats van andersom.',
      credit: 'Horizon is een eigen, onafhankelijke implementatie van dat idee in software — niet gemaakt door, goedgekeurd door of verbonden aan Tony Robbins of Robbins Research International.',
      link: 'Lees hoe RPM werkt →',
    },
    ai: {
      label: 'Je tweede brein',
      h2: 'Koppel je AI en praat gewoon tegen je planning.',
      intro: 'Horizon heeft een MCP-server — het protocol waarmee AI-assistenten met externe apps praten. Verbind je Claude eraan (of een andere AI die MCP spreekt), dan kan die je taken, weekplanning, prestaties en XP zowel lezen als bijwerken. Geen kopiëren en plakken meer: je vertelt hoe je week eruitziet, en het staat in je dashboard.',
      bubbelJij: 'Morgen wil ik naar de sportschool in plaats van thuis trainen, en de omzetbelasting schuift naar maandag.',
      bubbelAi: 'Ik heb je bestaande planning erbij gepakt en twee dingen aangepast.',
      bubbelDoen: ['✓ “Thuis trainen” → sportschool, morgen', '✓ “Omzetbelasting” verzet naar maandag'],
      watMag: 'Wat je AI mag doen',
      watMagIntro: 'De MCP-server geeft je assistent een vaste, afgebakende set handelingen:',
      li: [
        'Werkt met Claude Desktop en Claude Code — en met elke assistent die MCP ondersteunt.',
        'Of via een gewone REST-API met een persoonlijk token, voor je eigen scripts.',
        'Liever lokaal? Zet de ingebouwde chat op Ollama of LM Studio; het model draait dan op je eigen computer.',
      ],
    },
    koppelSectie: {
      label: 'Koppelingen',
      h2: 'Alles wat je brein toch al gebruikt.',
      intro: 'Je agenda, je mail en je AI leven nu in aparte tabbladen. Horizon haalt ze naar één scherm, zodat je week klopt met wat er werkelijk staat te gebeuren.',
      binnenkort: 'binnenkort',
    },
    koppelingen: [
      { emoji: '🤖', titel: 'Claude, of elke AI die MCP spreekt',
        tekst: 'Via de meegeleverde MCP-server. Claude Desktop, Claude Code of je eigen assistent leest en schrijft je planning rechtstreeks.' },
      { emoji: '🔑', titel: 'Je eigen scripts, via een REST-API',
        tekst: 'Spreekt jouw assistent geen MCP? Met het persoonlijke token uit Instellingen komt elk script dat HTTP kan bij dezelfde gegevens.' },
      { emoji: '💬', titel: 'Ingebouwde AI-chat',
        tekst: 'Kies je eigen model: Claude, OpenAI, of lokaal via Ollama of LM Studio, dat op je eigen computer draait.' },
      { emoji: '📆', titel: 'Google Agenda',
        tekst: 'Je afspraken komen automatisch naast je eigen planning te staan, zodat je week klopt met de werkelijkheid.' },
      { emoji: '✉️', titel: 'Gmail',
        tekst: 'Je inbox in de app. Laat de AI een lange draad samenvatten en maak er in één klik een taak van.' },
      { emoji: '📺', titel: 'YouTube',
        tekst: 'De laatste video’s van je eigen kanaal binnen handbereik, zodat je content geen apart tabblad hoeft te zijn.' },
      { emoji: '🗂', titel: 'Google Drive', straks: true,
        tekst: 'Je documenten en notities erbij halen staat op de planning — nog niet gekoppeld.' },
    ],
    stappenSectie: {
      label: 'Aan de slag',
      h2: 'In drie stappen ingericht.',
      intro: 'Je hoeft niet eerst een systeem te bedenken. De app stelt bij je eerste inlog een paar vragen en zet je levensgebieden voor je klaar.',
    },
    stappen: [
      { titel: 'Maak een account', tekst: 'Met Google of gewoon met een e-mailadres. Je zit binnen een minuut in je dashboard.' },
      { titel: 'Richt je levensgebieden in', tekst: 'Waar draait jouw leven om? Per gebied leg je vast wat je wil bereiken en waarom dat telt.' },
      { titel: 'Koppel je AI en je agenda', tekst: 'Verbind Google en zet de MCP-server aan in je AI. Vanaf dan houdt je planning zichzelf bij.' },
    ],
    slot: {
      h2: 'Begin bij waar je heen wil.',
      intro: 'Zet je visie neer, laat je AI de rommelige rest bijhouden.',
      beginnen: 'Beginnen',
      inloggen: 'Inloggen',
    },
    nav: { updates: 'Updates', over: 'Over', rpm: 'RPM', inloggen: 'Inloggen', account: 'Account maken' },
    voet: naam => `⚡ Horizon — gratis alpha, gebouwd door ${naam}`,
  },
  en: {
    pil: 'Free alpha · a hobby project',
    h1: ['Your whole life, one overview —', 'and your AI gets to see it'],
    lead: 'Horizon brings your vision, goals, projects, tasks, and week together in one place. No more scattered lists that contradict each other. And because you connect your AI to it, you don’t have to keep it all up to date yourself: tell it what changed, and your plan shifts with you.',
    ctaBeginnen: 'Get started',
    ctaAlHeb: 'I already have an account',
    noot: 'Sign in with Google or email',
    bijgewerkt: datum => ` · last updated ${datum}`,
    bord: {
      titel: '🎯 Goals',
      kol1: '📅 This week', kol1Kaarten: ['Finish the setlist', 'Work out 3×'],
      kol2: '📆 6 weeks', kol2Kaarten: ['Record the album', 'Finish the garden'],
      kol3: '📊 Quarter', kol3Kaarten: ['Roof repaired', '20 gigs'],
    },
    sectie1: {
      label: 'What it does for you',
      h2: 'From life vision to what you pick up this afternoon.',
      intro: 'Most planners start at your to-do list and stop there. Horizon starts with where you’re headed, and works backward to this week — so even on a busy day you can still see why something is on your list.',
    },
    functies: [
      { emoji: '🎯', titel: 'Goals across five horizons',
        tekst: 'Now, this week, six weeks, quarter, and this year — side by side. Plans shifting? Drag a goal to a different horizon.' },
      { emoji: '🌟', titel: 'Vision per life area',
        tekst: 'Health, work, family, music — each area gets its own vision, purpose, roles, and resources. Built around the RPM method.' },
      { emoji: '📅', titel: 'Week, month, and day',
        tekst: 'A week grid where you drag tasks onto days, recurring tasks that schedule themselves, and a day view that shows what matters right now.' },
      { emoji: '✅', titel: 'Tasks and projects',
        tekst: 'From a loose inbox task to a project under a life area. Backlog, in progress, waiting, done — with a kanban that moves with you.' },
      { emoji: '🏆', titel: 'Wins, XP, and levels',
        tekst: 'Every goal you hit automatically becomes an achievement. You earn XP and level up, so progress becomes visible instead of assumed.' },
      { emoji: '📓', titel: 'Journal and mood',
        tekst: 'Jot a quick reflection on your day and track your mood. Over weeks, you’ll see patterns you’d miss in the moment.' },
      { emoji: '📊', titel: 'Insight and consistency',
        tekst: 'A heatmap of your productivity, a 3D graph of how your projects connect, and a check that flags where your plan is coming apart.' },
      { emoji: '🧭', titel: 'Weekly planning session',
        tekst: 'One guided round per week: back to your vision, celebrate wins, and lay out your week from there.' },
    ],
    rpm: {
      label: 'The method',
      h2: 'Built on RPM, not a copy of it.',
      intro: 'Horizon follows the RPM method (Rapid Planning Method) developed by Tony Robbins: start from your ultimate vision, work backward to what that requires, and let your task list follow from that — instead of the other way around.',
      credit: 'Horizon is an independent, unofficial implementation of that idea in software — it is not made by, endorsed by, or affiliated with Tony Robbins or Robbins Research International.',
      link: 'Read how RPM works →',
    },
    ai: {
      label: 'Your second brain',
      h2: 'Connect your AI and just talk to your planning.',
      intro: 'Horizon has an MCP server — the protocol AI assistants use to talk to external apps. Connect Claude to it (or any other AI that speaks MCP), and it can both read and update your tasks, week plan, achievements, and XP. No more copying and pasting: tell it what your week looks like, and it lands in your dashboard.',
      bubbelJij: 'Tomorrow I want to go to the gym instead of training at home, and the VAT filing moves to Monday.',
      bubbelAi: 'I pulled up your existing plan and adjusted two things.',
      bubbelDoen: ['✓ “Train at home” → gym, tomorrow', '✓ “VAT filing” moved to Monday'],
      watMag: 'What your AI can do',
      watMagIntro: 'The MCP server gives your assistant a fixed, well-defined set of actions:',
      li: [
        'Works with Claude Desktop and Claude Code — and any assistant that supports MCP.',
        'Or through a plain REST API with a personal token, for your own scripts.',
        'Prefer local? Point the built-in chat at Ollama or LM Studio; the model then runs on your own computer.',
      ],
    },
    koppelSectie: {
      label: 'Integrations',
      h2: 'Everything your brain already uses.',
      intro: 'Your calendar, your mail, and your AI currently live in separate tabs. Horizon pulls them into one screen, so your week matches what’s actually happening.',
      binnenkort: 'coming soon',
    },
    koppelingen: [
      { emoji: '🤖', titel: 'Claude, or any AI that speaks MCP',
        tekst: 'Through the included MCP server. Claude Desktop, Claude Code, or your own assistant reads and writes your planning directly.' },
      { emoji: '🔑', titel: 'Your own scripts, via a REST API',
        tekst: 'Assistant doesn’t speak MCP? With the personal token from Settings, any script that can do HTTP reaches the same data.' },
      { emoji: '💬', titel: 'Built-in AI chat',
        tekst: 'Pick your own model: Claude, OpenAI, or local via Ollama or LM Studio, running on your own computer.' },
      { emoji: '📆', titel: 'Google Calendar',
        tekst: 'Your appointments show up alongside your own planning automatically, so your week matches reality.' },
      { emoji: '✉️', titel: 'Gmail',
        tekst: 'Your inbox, in the app. Have the AI summarize a long thread and turn it into a task in one click.' },
      { emoji: '📺', titel: 'YouTube',
        tekst: 'The latest videos from your own channel within reach, so your content doesn’t need its own tab.' },
      { emoji: '🗂', titel: 'Google Drive', straks: true,
        tekst: 'Pulling in your documents and notes is on the roadmap — not connected yet.' },
    ],
    stappenSectie: {
      label: 'Getting started',
      h2: 'Set up in three steps.',
      intro: 'You don’t need to design a system first. On your first login, the app asks a few questions and sets up your life areas for you.',
    },
    stappen: [
      { titel: 'Create an account', tekst: 'With Google or just an email address. You’re in your dashboard within a minute.' },
      { titel: 'Set up your life areas', tekst: 'What does your life revolve around? For each area, define what you want to achieve and why it matters.' },
      { titel: 'Connect your AI and calendar', tekst: 'Connect Google and turn on the MCP server in your AI. From there, your plan keeps itself up to date.' },
    ],
    slot: {
      h2: 'Start with where you’re headed.',
      intro: 'Lay out your vision, let your AI handle the messy rest.',
      beginnen: 'Get started',
      inloggen: 'Log in',
    },
    nav: { updates: 'Updates', over: 'About', rpm: 'RPM', inloggen: 'Log in', account: 'Sign up' },
    voet: naam => `⚡ Horizon — free alpha, built by ${naam}`,
  },
}
