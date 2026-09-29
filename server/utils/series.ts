import type { H3Event } from 'h3'
import type { ObjectId } from 'mongodb'
import type { SeriesDoc } from './documents'
import type { Series } from '#shared/types'

const notFound = () => createError({ statusCode: 404, statusMessage: 'Series not found' })

export function requireSeriesId(event: H3Event): ObjectId {
  const id = parseObjectId(getRouterParam(event, 'id'))
  if (!id) throw notFound()
  return id
}

/** Loads a series by route id, scoped to the user. 404 if missing or owned by someone else. */
export async function findOwnSeries(event: H3Event, userName: string): Promise<SeriesDoc> {
  const doc = await seriesCollection().findOne({ _id: requireSeriesId(event), user: userName })
  if (!doc) throw notFound()
  return doc
}

/**
 * Applies a state transition as a compare-and-set on the raw season/episode/runningDay that were read, so two
 * concurrent requests cannot both write the same "+1". Retries once on a lost race, then answers 409.
 */
export async function applySeriesAction(
  event: H3Event,
  userName: string,
  action: (s: Series) => Series | null,
  notAllowed: string,
): Promise<Series> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const doc = await findOwnSeries(event, userName)
    const next = action(toSeries(doc))
    if (!next) throw createError({ statusCode: 409, statusMessage: notAllowed })
    const { matchedCount } = await seriesCollection().updateOne(
      { _id: doc._id, user: userName, season: doc.season, episode: doc.episode, runningDay: doc.runningDay },
      { $set: toSeriesDocFields(next) },
    )
    if (matchedCount === 1) {
      emitSeriesChanged(userName)
      return next
    }
  }
  throw createError({ statusCode: 409, statusMessage: 'Series changed, please retry' })
}
