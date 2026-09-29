import type { ObjectId } from 'mongodb'
import type { Series, SeriesInput } from '#shared/types'

/** Series as stored. Legacy data may have runningDay as a numeric string and startDate as a Date. */
export interface SeriesDoc {
  _id: ObjectId
  name: string
  season: number
  episode: number
  runningDay: number | string | null
  startDate: string | Date | null
  user: string
}

export interface UserDoc {
  _id: ObjectId
  name: string
  /** legacy unsalted sha256 hex — never modified */
  password?: string
  /** legacy, unused by any hash — never modified */
  salt?: string
  /** scrypt$N$r$p$saltB64$hashB64 */
  passwordHash?: string
  watchUrlTemplate?: string | null
}

export function normaliseRunningDay(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 7 ? n : null
}

export function normaliseStartDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const nonNegativeInt = (v: unknown) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

export function toSeries(doc: SeriesDoc): Series {
  return {
    id: doc._id.toHexString(),
    name: String(doc.name ?? ''),
    season: nonNegativeInt(doc.season),
    episode: nonNegativeInt(doc.episode),
    runningDay: normaliseRunningDay(doc.runningDay),
    startDate: normaliseStartDate(doc.startDate),
  }
}

/** The exact field shape the old app writes (startDate as midnight-UTC ISO string). */
export function toSeriesDocFields(input: SeriesInput): Omit<SeriesDoc, '_id' | 'user'> {
  return {
    name: input.name,
    season: input.season,
    episode: input.episode,
    runningDay: input.runningDay,
    startDate: input.startDate ? `${input.startDate}T00:00:00.000Z` : null,
  }
}
