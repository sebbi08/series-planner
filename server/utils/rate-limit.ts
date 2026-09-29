const MAX_FAILURES = 10
const WINDOW_MS = 15 * 60 * 1000
const failures = new Map<string, { count: number, resetAt: number }>()

export function assertLoginAllowed(key: string): void {
  const entry = failures.get(key)
  if (!entry) return
  if (Date.now() > entry.resetAt) {
    failures.delete(key)
    return
  }
  if (entry.count >= MAX_FAILURES) {
    throw createError({ statusCode: 429, statusMessage: 'Too many failed attempts. Try again later.' })
  }
}

export function recordLoginFailure(key: string): void {
  const now = Date.now()
  const entry = failures.get(key)
  if (!entry || now > entry.resetAt) failures.set(key, { count: 1, resetAt: now + WINDOW_MS })
  else entry.count++
}

export function clearLoginFailures(key: string): void {
  failures.delete(key)
}
