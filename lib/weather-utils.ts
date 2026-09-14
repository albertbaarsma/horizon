// Buienradar icon letter → emoji
export const BUIEN_EMOJI: Record<string, string> = {
  a: '☀️', aa: '☀️',
  b: '⛅', bb: '⛅',
  c: '☁️', cc: '☁️',
  d: '🌤',
  e: '🌦',
  f: '🌧', ff: '🌧',
  g: '🌧',
  h: '⛈',
  i: '❄️',
  j: '🌫', k: '🌫',
}

export function forecastEmoji(iconCode: string, desc?: string): string {
  if (iconCode) return BUIEN_EMOJI[iconCode.toLowerCase()] ?? '🌤'
  const d = (desc ?? '').toLowerCase()
  if (d.includes('onweer')) return '⛈'
  if (d.includes('regen') || d.includes('bui')) return '🌧'
  if (d.includes('zon') || d.includes('helder')) return '☀️'
  if (d.includes('bewolk') || d.includes('mix') || d.includes('opklaring')) return '⛅'
  if (d.includes('sneeuw')) return '❄️'
  if (d.includes('mist')) return '🌫'
  return '🌤'
}

export function currentEmoji(desc: string, isRaining: boolean): string {
  const d = desc.toLowerCase()
  if (isRaining || d.includes('regen') || d.includes('bui')) return '🌧'
  if (d.includes('onweer')) return '⛈'
  if (d.includes('zon') || d.includes('helder')) return '☀️'
  if (d.includes('bewolk') || d.includes('mix') || d.includes('opklaring')) return '⛅'
  if (d.includes('mist')) return '🌫'
  if (d.includes('sneeuw')) return '❄️'
  return '🌤'
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function rainValueMmPerHour(v: number): number {
  if (v === 0) return 0
  return Math.pow(10, (v - 109) / 32)
}

// Open-Meteo WMO weather codes → Dutch description
// (kept as plain words so forecastEmoji's keyword fallback still matches)
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Helder',
  1: 'Grotendeels helder',
  2: 'Half bewolkt',
  3: 'Bewolkt',
  45: 'Mist', 48: 'Mist',
  51: 'Motregen', 53: 'Motregen', 55: 'Motregen', 56: 'Motregen', 57: 'Motregen',
  61: 'Regen', 63: 'Regen', 65: 'Regen', 66: 'Regen', 67: 'Regen',
  71: 'Sneeuw', 73: 'Sneeuw', 75: 'Sneeuw', 77: 'Sneeuw',
  80: 'Regenbuien', 81: 'Regenbuien', 82: 'Regenbuien',
  85: 'Sneeuwbuien', 86: 'Sneeuwbuien',
  95: 'Onweer', 96: 'Onweer', 99: 'Onweer',
}

export function wmoToDescription(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? 'Wisselvallig'
}

const COMPASS_NL = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW']

export function compassNL(deg: number): string {
  return COMPASS_NL[Math.round(deg / 45) % 8]
}
