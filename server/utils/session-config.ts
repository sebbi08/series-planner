const MIN_LENGTH = 32

/** Mirrors Nuxt's deriveSecret(), which nuxt-auth-utils uses to seal the session. Returns a human-readable problem, or null when usable. */
export function sessionPasswordProblem(): string | null {
  const secret: unknown = useRuntimeConfig().appSecret
  if (secret === undefined || secret === null || secret === '') return 'NUXT_APP_SECRET is not set'
  if (typeof secret !== 'string') return `NUXT_APP_SECRET was parsed as a ${typeof secret}; quote the value (NUXT_APP_SECRET='"…"')`
  if (secret.length < MIN_LENGTH) return `NUXT_APP_SECRET is too short (${secret.length} characters, needs at least ${MIN_LENGTH})`
  return null
}
