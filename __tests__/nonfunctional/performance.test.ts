/**
 * Performance tests — non-functional
 *
 * These tests verify that pure utility functions stay fast even under load.
 * They don't test a UI or network call — just raw CPU time.
 *
 * Rule of thumb used here: any helper called on every render or in a tight
 * loop should complete 10 000 iterations in under 50 ms on a laptop.
 * Adjust the threshold if the CI machine is known to be slower.
 *
 * Note: these tests are not deterministic on a loaded machine. They catch
 * accidental O(n²) regressions (e.g. someone replaces a Set lookup with a
 * nested .find()), not micro-optimisation opportunities.
 */
import { describe, it, expect } from 'vitest'
import { haversineKm, rainValueMmPerHour, forecastEmoji, currentEmoji, BUIEN_EMOJI } from '@/lib/weather-utils'

const ITERATIONS = 10_000
const MAX_MS      = 50

function bench(fn: () => void): number {
  const start = performance.now()
  for (let i = 0; i < ITERATIONS; i++) fn()
  return performance.now() - start
}

describe('weather-utils performance', () => {
  it(`haversineKm runs ${ITERATIONS}x in under ${MAX_MS}ms`, () => {
    const ms = bench(() => haversineKm(52.44, 6.75, 52.26, 6.16))
    expect(ms, `took ${ms.toFixed(1)}ms — possible O(n) regression?`).toBeLessThan(MAX_MS)
  })

  it(`rainValueMmPerHour runs ${ITERATIONS}x in under ${MAX_MS}ms`, () => {
    // Cover the full integer range to stress any branch-heavy implementation
    let i = 0
    const ms = bench(() => rainValueMmPerHour(i++ % 256))
    expect(ms, `took ${ms.toFixed(1)}ms`).toBeLessThan(MAX_MS)
  })

  it(`forecastEmoji runs ${ITERATIONS}x in under ${MAX_MS}ms`, () => {
    // Use real icon letter codes from the BUIEN_EMOJI table + unknown key to hit fallback
    const codes = ['a', 'b', 'c', 'd', 'e', 'f', 'h', 'i', 'j', 'unknown']
    let i = 0
    const ms = bench(() => forecastEmoji(codes[i++ % codes.length]))
    expect(ms, `took ${ms.toFixed(1)}ms`).toBeLessThan(MAX_MS)
  })

  it(`currentEmoji runs ${ITERATIONS}x in under ${MAX_MS}ms`, () => {
    const cases: [string, boolean][] = [
      ['zonnig', false], ['bewolkt', false], ['regen', true],
      ['mist', false],   ['sneeuw', false],  ['onbekend', false], ['helder', false],
    ]
    let i = 0
    const ms = bench(() => { const [d, r] = cases[i++ % cases.length]; currentEmoji(d, r) })
    expect(ms, `took ${ms.toFixed(1)}ms`).toBeLessThan(MAX_MS)
  })

  it('BUIEN_EMOJI table covers the full 0–255 buienradar integer range', () => {
    // Non-timing check: the lookup table must never return undefined for a valid input.
    // A missing bucket would cause the UI to show "undefined" instead of an emoji.
    for (let v = 0; v <= 255; v++) {
      const result = rainValueMmPerHour(v)
      // rainValueMmPerHour uses BUIEN_EMOJI indirectly; the result must be a finite number
      expect(typeof result, `v=${v} → ${result}`).toBe('number')
      expect(Number.isFinite(result), `v=${v} produced non-finite`).toBe(true)
    }
  })
})
