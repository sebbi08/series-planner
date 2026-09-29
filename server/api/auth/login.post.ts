import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
})

export default defineEventHandler(async (event) => {
  const { name, password } = await readValidatedBody(event, bodySchema.parse)
  const key = `${clientIp(event)}|${name.toLowerCase()}`
  assertLoginAllowed(key)

  const user = await usersCollection().findOne({ name })
  const result = user ? await checkUserPassword(user, password) : { ok: false }
  if (!user || !result.ok) {
    recordLoginFailure(key)
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  }
  clearLoginFailures(key)

  if (result.upgradedHash) {
    await usersCollection().updateOne({ _id: user._id }, { $set: { passwordHash: result.upgradedHash } })
  }
  await setUserSession(event, { user: { id: user._id.toHexString(), name: user.name } })
  return { ok: true }
})
