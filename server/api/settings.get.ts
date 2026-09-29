import { ObjectId } from 'mongodb'
import type { Settings } from '#shared/types'

export default defineEventHandler(async (event): Promise<Settings> => {
  const user = await requireUser(event)
  const doc = await usersCollection().findOne({ _id: new ObjectId(user.id) }, { projection: { watchUrlTemplate: 1 } })
  return { watchUrlTemplate: doc?.watchUrlTemplate ?? null }
})
