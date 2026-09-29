import { episodeWatched } from '#shared/series-actions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return applySeriesAction(event, user.name, episodeWatched, 'This series is not running and has no start date')
})
