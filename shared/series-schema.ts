import { z } from 'zod'
import type { SeriesInput } from './types'

const isRealDate = (v: string) => {
  const d = new Date(`${v}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v)
}

export const seriesInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
  season: z.number().int('Must be a whole number').min(0, 'Must be 0 or more'),
  episode: z.number().int('Must be a whole number').min(0, 'Must be 0 or more'),
  runningDay: z.number().int().min(0).max(7).nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').refine(isRealDate, 'Invalid date').nullable(),
})

/** Validates a request body and applies the rule "a running series has no start date". Throws ZodError. */
export function normaliseSeriesInput(body: unknown): SeriesInput {
  const v = seriesInputSchema.parse(body)
  return v.runningDay !== null ? { ...v, startDate: null } : v
}
