import { episodeWatched } from '#shared/series-actions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const doc = await findOwnSeries(event, user.name)
  const next = episodeWatched(toSeries(doc))
  if (!next) throw createError({ statusCode: 409, statusMessage: 'This series is not running and has no start date' })
  await seriesCollection().updateOne({ _id: doc._id, user: user.name }, { $set: toSeriesDocFields(next) })
  emitSeriesChanged(user.name)
  return next
})
