const MIN_LENGTH = 32

/** Mirrors nuxt-auth-utils: the env var wins over runtimeConfig. Returns a human-readable problem, or null when usable. */
export function sessionPasswordProblem(): string | null {
  const password = process.env.NUXT_SESSION_PASSWORD || useRuntimeConfig().session?.password || ''
  if (!password) return 'NUXT_SESSION_PASSWORD is not set'
  if (password.length < MIN_LENGTH) return `NUXT_SESSION_PASSWORD is too short (${password.length} characters, needs at least ${MIN_LENGTH})`
  return null
}
