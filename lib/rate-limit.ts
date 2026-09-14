const store = new Map<string, number[]>()

/**
 * Sliding-window rate limiter keyed by userId.
 * Returns true if the request is allowed, false if the limit is exceeded.
 */
export function checkRateLimit(userId: string, maxPerMinute = 30): boolean {
  const now = Date.now()
  const window = 60_000
  const timestamps = (store.get(userId) ?? []).filter(t => now - t < window)
  if (timestamps.length >= maxPerMinute) return false
  timestamps.push(now)
  store.set(userId, timestamps)
  return true
}

/** Exposed for tests — reset all counters */
export function _resetStore() {
  store.clear()
}
