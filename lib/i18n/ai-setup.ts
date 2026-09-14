import type { Lang } from '../lang'

interface AiSetupContent {
  titel: string
  intro: string
  kopieer: string; gekopieerd: string
  paden: { desktop: string; code: string; rest: string; model: string }
  desktop: {
    stap1: string; stap1Tekst: string
    stap2: string; stap2Tekst: string
    urlLabel: string
  }
  code: {
    stap1: string; stap1Tekst: string
    commandoLabel: string
  }
  rest: {
    intro: string
    tokenLabel: string
  }
  model: {
    intro: string
    optie1Titel: string; optie1Tekst: string
    optie2Titel: string; optie2Tekst: string; optie2Velden: string
    optie3Titel: string; optie3Tekst: string
    kiezen: string
    settingsLink: string
    caveat: string
  }
  test: {
    knop: string
    bezig: string
    ok: (level: number, xp: number) => string
    fout: string
    noot: string
  }
}

export const AI_SETUP: Record<Lang, AiSetupContent> = {
  nl: {
    titel: '🤖 Koppel je AI',
    intro: 'Verbind Claude of een andere AI met je Horizon, zodat die je taken, weekplanning, prestaties en XP kan lezen én bijwerken.',
    kopieer: 'Kopieer',
    gekopieerd: '✓ Gekopieerd',
    paden: {
      desktop: 'Claude Desktop of claude.ai',
      code: 'Claude Code',
      rest: 'Eigen scripts (REST API)',
      model: 'Eigen AI-model instellen',
    },
    desktop: {
      stap1: '1. Open Connectors',
      stap1Tekst: 'In Claude: Customize → Connectors → Add custom connector.',
      stap2: '2. Plak deze URL',
      stap2Tekst: 'Je token zit al in de link — er is geen aparte OAuth-stap of API-sleutel nodig.',
      urlLabel: 'Connector-URL',
    },
    code: {
      stap1: 'Voer dit commando uit',
      stap1Tekst: 'Werkt vanaf elke terminal waar Claude Code geïnstalleerd is:',
      commandoLabel: 'Commando',
    },
    rest: {
      intro: 'Spreekt jouw assistent geen MCP? Elk script dat HTTP kan, komt bij dezelfde gegevens met je persoonlijke token.',
      tokenLabel: 'Jouw token',
    },
    model: {
      intro: 'Dit is het andere kantje op: hiermee stel je in welk AI-model Horizon AI zelf gebruikt — de chatknop rechtsonder en de volledige chatpagina. Krijg je "Geen API key geconfigureerd"? Dan staat dit nog niet ingesteld. Drie opties, van gratis-en-lokaal tot betaald-en-krachtig:',
      optie1Titel: '① Gratis & open source — op je eigen computer',
      optie1Tekst: 'Installeer Ollama (ollama.com), draai daarna `ollama pull mistral` in een terminal. Kies in Instellingen → Horizon AI de provider "Ollama (lokaal)" — er is geen API-sleutel nodig, alles blijft op je eigen machine. LM Studio (met een grafische interface) werkt op dezelfde manier via de provider "LM Studio (lokaal)".',
      optie2Titel: '② Gratis, in de cloud — Google Gemini',
      optie2Tekst: 'Haal een gratis sleutel op via aistudio.google.com/apikey. Kies daarna in Instellingen → Horizon AI de provider "OpenAI-compatible" en vul in:',
      optie2Velden: 'Base URL: https://generativelanguage.googleapis.com/v1beta/openai\nModel: gemini-2.0-flash\nAPI key: je Gemini-sleutel',
      optie3Titel: '③ Betaald, meest capabel — Anthropic Claude (hetzelfde model als deze chat)',
      optie3Tekst: 'Haal een sleutel op via console.anthropic.com en plak die bij "API key" — de provider staat al standaard op "Anthropic Claude", verder hoef je niks aan te passen.',
      kiezen: 'Daarna, in de chat zelf: klik bovenin op het modelnaampje en kies "⚙️ Mijn instellingen" — anders blijft de chat gewoon de eigen standaardkeuze gebruiken en merk je niks van wat je net hebt ingesteld. Bij optie ③ hoeft dit niet: dat ís al de standaardkeuze.',
      settingsLink: 'Ga naar Instellingen → Horizon AI →',
      caveat: 'Let op: een paar losse AI-hulpjes (weeknotities omzetten in prestaties, een rapport genereren, een bankafschrift of stemming laten inschatten) werken vooralsnog altijd via Anthropic, ongeacht wat je hierboven kiest voor de chat zelf — daar is dus sowieso een Anthropic-sleutel voor nodig als je die losse functies wilt gebruiken.',
    },
    test: {
      knop: 'Test mijn token',
      bezig: 'Bezig…',
      ok: (level, xp) => `✓ Werkt — je bent Level ${level} met ${xp} XP.`,
      fout: '✗ Kon geen verbinding maken. Probeer je token opnieuw te kopiëren.',
      noot: 'Dit test alleen of het token zelf geldig is — niet of Claude Desktop de verbinding daadwerkelijk gelegd heeft. Vraag Claude daarna gewoon naar je taken.',
    },
  },
  en: {
    titel: '🤖 Connect your AI',
    intro: 'Connect Claude or another AI to your Horizon, so it can read and update your tasks, week plan, achievements, and XP.',
    kopieer: 'Copy',
    gekopieerd: '✓ Copied',
    paden: {
      desktop: 'Claude Desktop or claude.ai',
      code: 'Claude Code',
      rest: 'Your own scripts (REST API)',
      model: 'Set up your own AI model',
    },
    desktop: {
      stap1: '1. Open Connectors',
      stap1Tekst: 'In Claude: Customize → Connectors → Add custom connector.',
      stap2: '2. Paste this URL',
      stap2Tekst: 'Your token is already baked into the link — no separate OAuth step or API key needed.',
      urlLabel: 'Connector URL',
    },
    code: {
      stap1: 'Run this command',
      stap1Tekst: 'Works from any terminal where Claude Code is installed:',
      commandoLabel: 'Command',
    },
    rest: {
      intro: 'Your assistant doesn’t speak MCP? Any script that can do HTTP reaches the same data with your personal token.',
      tokenLabel: 'Your token',
    },
    model: {
      intro: 'This is the other direction: it sets which AI model powers Horizon AI itself — the chat button in the corner and the full-page chat. Seeing "No API key configured"? This is what’s missing. Three options, from free-and-local to paid-and-strongest:',
      optie1Titel: '① Free & open source — on your own computer',
      optie1Tekst: 'Install Ollama (ollama.com), then run `ollama pull mistral` in a terminal. In Settings → Horizon AI, pick the provider "Ollama (local)" — no API key needed, everything stays on your own machine. LM Studio (with a graphical interface) works the same way via the "LM Studio (local)" provider.',
      optie2Titel: '② Free, in the cloud — Google Gemini',
      optie2Tekst: 'Get a free key at aistudio.google.com/apikey. Then in Settings → Horizon AI, pick the provider "OpenAI-compatible" and fill in:',
      optie2Velden: 'Base URL: https://generativelanguage.googleapis.com/v1beta/openai\nModel: gemini-2.0-flash\nAPI key: your Gemini key',
      optie3Titel: '③ Paid, most capable — Anthropic Claude (the same model as this chat)',
      optie3Tekst: 'Get a key at console.anthropic.com and paste it into "API key" — the provider is already set to "Anthropic Claude" by default, nothing else to change.',
      kiezen: 'Then, in the chat itself: click the model name at the top and pick "⚙️ My settings" — otherwise the chat keeps using its own default and none of what you just configured takes effect. Skip this for option ③: that already is the default.',
      settingsLink: 'Go to Settings → Horizon AI →',
      caveat: 'Note: a handful of separate AI helpers (turning weekly notes into achievements, generating a report, reading a bank statement, suggesting a mood) currently always run on Anthropic, regardless of what you pick above for the chat itself — so those specifically still need an Anthropic key if you want to use them.',
    },
    test: {
      knop: 'Test my token',
      bezig: 'Testing…',
      ok: (level, xp) => `✓ Works — you’re Level ${level} with ${xp} XP.`,
      fout: '✗ Could not connect. Try copying your token again.',
      noot: 'This only tests whether the token itself is valid — not whether Claude Desktop actually made the connection. Just ask Claude about your tasks afterward.',
    },
  },
}
