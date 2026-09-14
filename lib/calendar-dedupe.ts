// Fuzzy dedupe for Google Calendar sync: a synced event is a duplicate when
// the user already has an item on that date whose words cover the event title
// (or vice versa), ignoring emoji, times, and punctuation. This catches
// "🎹 Pianoles Mio 09:30" (manual) vs "Pianoles Mio" (Google Calendar).

export function normalizeEventText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}]/gu, '')
    .replace(/\b\d{1,2}[:.]\d{2}\b/g, '')          // times: 09:30, 20.15
    .replace(/[^\p{L}\p{N}]+/gu, ' ')              // punctuation → space
    .replace(/\s+/g, ' ')
    .trim()
}

// True when one title's words are a subset of the other's — the shape of a
// manual entry that adds an emoji/time/detail to the same underlying event.
export function isSameEvent(a: string, b: string): boolean {
  const na = normalizeEventText(a)
  const nb = normalizeEventText(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const ta = new Set(na.split(' '))
  const tb = new Set(nb.split(' '))
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta]
  for (const w of small) if (!large.has(w)) return false
  return true
}
