import { normaliseSeriesInput } from '#shared/series-schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await readValidatedBody(event, normaliseSeriesInput)
  const fields = toSeriesDocFields(input)
  const { insertedId } = await seriesCollection().insertOne({ ...fields, user: user.name } as never)
  emitSeriesChanged(user.name)
  setResponseStatus(event, 201)
  return toSeries({ _id: insertedId, ...fields, user: user.name })
})
