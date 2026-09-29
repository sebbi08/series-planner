import { z } from 'zod'
import { MongoServerError } from 'mongodb'
import { hashPassword } from '~~/lib/password.mjs'

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Username is required').max(50, 'Username is too long'),
  password: z.string().min(8, 'Password must have at least 8 characters').max(200),
})

export default defineEventHandler(async (event) => {
  if (process.env.ALLOW_SIGNUP !== 'true') throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const { name, password } = await readValidatedBody(event, bodySchema.parse)

  if (await usersCollection().findOne({ name })) {
    throw createError({ statusCode: 409, statusMessage: 'Username is already taken' })
  }
  try {
    const { insertedId } = await usersCollection().insertOne({ name, passwordHash: await hashPassword(password) } as never)
    await setUserSession(event, { user: { id: insertedId.toHexString(), name } })
  }
  catch (e) {
    if (e instanceof MongoServerError && e.code === 11000) throw createError({ statusCode: 409, statusMessage: 'Username is already taken' })
    throw e
  }
  setResponseStatus(event, 201)
  return { ok: true }
})
