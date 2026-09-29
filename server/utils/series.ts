import type { H3Event } from 'h3'
import type { ObjectId } from 'mongodb'
import type { SeriesDoc } from './documents'

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
