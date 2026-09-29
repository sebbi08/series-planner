import { seasonFinished } from '#shared/series-actions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const doc = await findOwnSeries(event, user.name)
  const next = seasonFinished(toSeries(doc))
  if (!next) throw createError({ statusCode: 409, statusMessage: 'Only a running series can finish a season' })
  await seriesCollection().updateOne({ _id: doc._id, user: user.name }, { $set: toSeriesDocFields(next) })
  emitSeriesChanged(user.name)
  return next
})
