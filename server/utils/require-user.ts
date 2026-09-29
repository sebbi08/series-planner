import type { H3Event } from 'h3'

/**
 * 401 without a session. Re-issues the session cookie with a fresh createdAt so the 30-day session slides with use.
 * h3's session.update() keeps the original createdAt (fixed cookie expiry, and unsealSession rejects once
 * now - createdAt > maxAge), so we reset it on the session object nuxt-auth-utils already loaded into
 * event.context.sessions, then setUserSession re-seals it with nuxt-auth-utils' own session config.
 */
export async function requireUser(event: H3Event) {
  const { user } = await requireUserSession(event)
  const name = useRuntimeConfig(event).session?.name ?? 'nuxt-session'
  const session = (event.context.sessions as Record<string, { createdAt: number }> | undefined)?.[name]
  if (session) session.createdAt = Date.now()
  await setUserSession(event, { user })
  return { id: user.id, name: user.name }
}
