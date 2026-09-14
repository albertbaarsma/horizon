// ─── Startgesprek voor nieuwe gebruikers ──────────────────────────────────────
// Zet losse regels tekst om in concrete voorstellen (wekelijkse taken, doelen).
// Deterministisch en testbaar; de gebruiker keurt daarna per regel goed.

import type { RecurringTask, GoalHorizon } from '@/lib/types'

export const SETUP_STEPS = [
  'welkom',
  'visie',
  'gebieden',
  'doelen',
  'routines',
  'claude',
  'klaar',
] as const
export type SetupStep = typeof SETUP_STEPS[number]

/** Levensgebieden waarmee een nieuwe gebruiker kan starten (allemaal optioneel). */
export const STARTER_AREAS = [
  { id: 'gezondheid',  name: 'Gezondheid' },
  { id: 'werk',        name: 'Werk' },
  { id: 'relaties',    name: 'Relaties' },
  { id: 'thuis',       name: 'Thuis' },
  { id: 'persoonlijk', name: 'Persoonlijk' },
] as const

const DAY_WORDS: Record<string, string> = {
  ma: 'monday',    maandag: 'monday',
  di: 'tuesday',   dinsdag: 'tuesday',
  wo: 'wednesday', woensdag: 'wednesday',
  do: 'thursday',  donderdag: 'thursday',
  vr: 'friday',    vrijdag: 'friday',
  za: 'saturday',  zaterdag: 'saturday',
  zo: 'sunday',    zondag: 'sunday',
}
const ALL_DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const WEEKDAYS = ['monday','tuesday','wednesday','thursday','friday']

export interface RoutineProposal {
  name: string
  days: string[]
  duration_min: number | null
  type: RecurringTask['type']
}

/**
 * "sportschool maandag en donderdag 60m" →
 *   { name:'Sportschool', days:['monday','thursday'], duration_min:60 }
 * "elke dag mediteren 15 min" → alle dagen
 * "boodschappen" → geen dagen (gebruiker kiest zelf)
 */
export function parseRoutineLine(line: string): RoutineProposal | null {
  const raw = line.trim()
  if (!raw) return null

  let rest = raw
  const days = new Set<string>()

  // "elke dag" / "dagelijks" / "iedere dag"
  if (/\b(elke dag|iedere dag|dagelijks)\b/i.test(rest)) {
    ALL_DAYS.forEach(d => days.add(d))
    rest = rest.replace(/\b(elke dag|iedere dag|dagelijks)\b/gi, ' ')
  }
  // "werkdagen" / "doordeweeks"
  if (/\b(werkdagen|doordeweeks)\b/i.test(rest)) {
    WEEKDAYS.forEach(d => days.add(d))
    rest = rest.replace(/\b(werkdagen|doordeweeks)\b/gi, ' ')
  }
  // "weekend"
  if (/\bweekend(en)?\b/i.test(rest)) {
    days.add('saturday'); days.add('sunday')
    rest = rest.replace(/\bweekend(en)?\b/gi, ' ')
  }

  // losse dagnamen — alleen als heel woord
  for (const [word, key] of Object.entries(DAY_WORDS)) {
    const re = new RegExp(`(^|[\\s,/+])${word}([\\s,/+.]|$)`, 'i')
    if (re.test(rest)) {
      days.add(key)
      rest = rest.replace(new RegExp(`(^|[\\s,/+])${word}(?=[\\s,/+.]|$)`, 'gi'), ' ')
    }
  }

  // duur: "60m", "60 min", "1u", "1.5 uur", "90 minuten"
  let duration: number | null = null
  const hour = rest.match(/(\d+(?:[.,]\d+)?)\s*(?:u|uur)\b/i)
  const min  = rest.match(/(\d+)\s*(?:m|min|minuten)\b/i)
  if (hour) {
    duration = Math.round(parseFloat(hour[1].replace(',', '.')) * 60)
    rest = rest.replace(hour[0], ' ')
  } else if (min) {
    duration = parseInt(min[1], 10)
    rest = rest.replace(min[0], ' ')
  }

  // opruimen: losse voegwoorden en leestekens die overblijven
  const name = rest
    .replace(/\b(en|op|elke|iedere|每)\b/gi, ' ')
    .replace(/[,;/+]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')
    .trim()

  if (!name) return null

  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    days: ALL_DAYS.filter(d => days.has(d)),   // vaste ma→zo volgorde
    duration_min: duration,
    type: guessType(name),
  }
}

/** Kiest een passend type op basis van woorden in de naam. */
export function guessType(name: string): RecurringTask['type'] {
  const n = name.toLowerCase()
  if (/\b(sport|sportschool|hardlop|fitness|zwemmen|yoga|wandel|train)/.test(n)) return 'sport'
  if (/\b(kind|kinderen|school|zoon|dochter|oppas)/.test(n))                     return 'kids'
  if (/\b(afspraak|agenda|overleg|meeting|les)/.test(n))                          return 'cal'
  return 'task'
}

export function parseRoutineLines(text: string): RoutineProposal[] {
  return text.split('\n').map(parseRoutineLine).filter((r): r is RoutineProposal => r !== null)
}

export interface GoalProposal {
  text: string
  horizon: GoalHorizon
}

/** Elke regel is een doel. Horizon standaard 'kwartaal' — concreet maar niet krap. */
export function parseGoalLines(text: string, horizon: GoalHorizon = 'kwartaal'): GoalProposal[] {
  return text.split('\n')
    // Opsommingstekens weghalen, maar een getal aan het begin blijft staan:
    // "10 optredens spelen" is een doel, "1. doel" een genummerde lijst.
    .map(l => l.replace(/^[\s*\-•]+/, '').replace(/^\d+[.)]\s+/, '').trim())
    .filter(l => l.length > 0)
    .map(text => ({ text, horizon }))
}
