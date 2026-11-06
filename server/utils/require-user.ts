import type { H3Event } from 'h3'

/**
 * 401 without a session. Re-issues the session cookie so the 30-day session slides with use:
 * since nuxt-auth-utils 0.6 the session maxAge counts from the last write, so setUserSession is enough.
 */
export async function requireUser(event: H3Event) {
  const { user } = await requireUserSession(event)
  await setUserSession(event, { user })
  return { id: user.id, name: user.name }
}
