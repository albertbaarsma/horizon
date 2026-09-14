// Natuurlijke-taal parsing voor quick-add invoer.
// "morgen 15:00 tandarts"  → { date: morgen,      timeBlock: '15:00', text: 'tandarts' }
// "vr pianoles Mio"        → { date: vrijdag a.s., timeBlock: null,    text: 'pianoles Mio' }
// "boodschappen doen"      → { date: null,         timeBlock: null,    text: 'boodschappen doen' }

export interface ParsedQuickAdd {
  text:      string
  date:      string | null   // YYYY-MM-DD, null = geen datum herkend
  timeBlock: string | null   // HH:MM, null = geen tijd herkend
}

const DAY_WORDS: Record<string, number> = {
  zondag: 0, maandag: 1, dinsdag: 2, woensdag: 3, donderdag: 4, vrijdag: 5, zaterdag: 6,
  zo: 0, ma: 1, di: 2, wo: 3, do: 4, vr: 5, za: 6,
}

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Volgende voorkomen van een weekdag, strikt ná vandaag (zelfde dag = +7)
function nextWeekday(today: string, targetDow: number): string {
  const todayDow = new Date(today + 'T12:00:00').getDay()
  const diff = (targetDow - todayDow + 7) % 7
  return addDays(today, diff === 0 ? 7 : diff)
}

export function parseQuickAdd(input: string, today: string): ParsedQuickAdd {
  let rest = input.trim()
  let date: string | null = null
  let timeBlock: string | null = null

  // Tijd: eerste voorkomen van HH:MM of HH.MM (ook "9:00"), waar dan ook
  const timeMatch = rest.match(/(?:^|\s)(\d{1,2})[:.](\d{2})(?=\s|$)/)
  if (timeMatch) {
    const h = parseInt(timeMatch[1]), m = parseInt(timeMatch[2])
    if (h <= 23 && m <= 59) {
      timeBlock = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      rest = (rest.slice(0, timeMatch.index) + ' ' + rest.slice(timeMatch.index! + timeMatch[0].length)).trim()
    }
  }

  // Datumwoord: alleen als EERSTE woord, zodat "bel morgen Mika" intact blijft
  const firstWord = rest.split(/\s+/)[0]?.toLowerCase() ?? ''
  if (firstWord === 'vandaag') {
    date = today
    rest = rest.slice(firstWord.length).trim()
  } else if (firstWord === 'morgen') {
    date = addDays(today, 1)
    rest = rest.slice(firstWord.length).trim()
  } else if (firstWord === 'overmorgen') {
    date = addDays(today, 2)
    rest = rest.slice(firstWord.length).trim()
  } else if (firstWord in DAY_WORDS) {
    date = nextWeekday(today, DAY_WORDS[firstWord])
    rest = rest.slice(firstWord.length).trim()
  }

  // Als er na het parsen geen tekst overblijft, was het geen echte invoer
  if (!rest) return { text: input.trim(), date: null, timeBlock: null }

  return { text: rest, date, timeBlock }
}

const DAY_NL   = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag']
const MONTH_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec']

// Leesbaar voorbeeld voor de invoer-hint: "→ vrijdag 17 jul om 15:00"
export function describeParsed(parsed: ParsedQuickAdd, today: string): string | null {
  if (!parsed.date && !parsed.timeBlock) return null
  const parts: string[] = []
  if (parsed.date) {
    if (parsed.date === today) parts.push('vandaag')
    else {
      const d = new Date(parsed.date + 'T12:00:00')
      parts.push(`${DAY_NL[d.getDay()]} ${d.getDate()} ${MONTH_NL[d.getMonth()]}`)
    }
  }
  if (parsed.timeBlock) parts.push(`om ${parsed.timeBlock}`)
  return `→ ${parts.join(' ')}`
}
