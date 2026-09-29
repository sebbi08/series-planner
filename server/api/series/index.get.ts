import { compareSeries } from '#shared/sort'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const docs = await seriesCollection().find({ user: user.name }).toArray()
  return docs.map(toSeries).sort(compareSeries)
})
