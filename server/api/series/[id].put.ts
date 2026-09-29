import { normaliseSeriesInput } from '#shared/series-schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const _id = requireSeriesId(event)
  const input = await readValidatedBody(event, normaliseSeriesInput)
  const doc = await seriesCollection().findOneAndUpdate(
    { _id, user: user.name },
    { $set: toSeriesDocFields(input) },
    { returnDocument: 'after' },
  )
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Series not found' })
  emitSeriesChanged(user.name)
  return toSeries(doc)
})
