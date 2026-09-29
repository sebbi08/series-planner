import { ObjectId } from 'mongodb'
import { parseSettings } from '#shared/settings-schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const settings = await readValidatedBody(event, parseSettings)
  await usersCollection().updateOne({ _id: new ObjectId(user.id) }, { $set: { watchUrlTemplate: settings.watchUrlTemplate } })
  return settings
})
