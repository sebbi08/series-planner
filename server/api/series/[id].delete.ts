export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { deletedCount } = await seriesCollection().deleteOne({ _id: requireSeriesId(event), user: user.name })
  if (deletedCount === 0) throw createError({ statusCode: 404, statusMessage: 'Series not found' })
  emitSeriesChanged(user.name)
  setResponseStatus(event, 204)
  return null
})
