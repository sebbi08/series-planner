import type { H3Event } from 'h3'

/** 401 without a session. Re-seals the cookie so the 30-day session slides with use. */
export async function requireUser(event: H3Event) {
  const { user } = await requireUserSession(event)
  await setUserSession(event, { user })
  return user
}
