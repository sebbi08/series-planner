import { seasonFinished } from '#shared/series-actions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return applySeriesAction(event, user.name, seasonFinished, 'Only a running series can finish a season')
})
