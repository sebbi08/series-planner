import { z } from 'zod'
import type { Settings } from './types'

export const settingsSchema = z.object({
  watchUrlTemplate: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(500, 'Template is too long').regex(/^https?:\/\//i, 'Must start with http:// or https://').nullable(),
  ),
})

export function parseSettings(body: unknown): Settings {
  return settingsSchema.parse(body) as Settings
}
