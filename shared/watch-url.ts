import type { Series } from './types'

export const BURNING_SERIES_PRESET = 'http://burningseries.ac/serie/{slug}/{season}'

export const WATCH_PLACEHOLDERS = [
  { token: '{name}', description: 'Series name' },
  { token: '{slug}', description: 'Name as URL slug (burningseries style)' },
  { token: '{season}', description: 'Season number' },
  { token: '{episode}', description: 'Episode number' },
] as const

/** Old app's burningseries slug rules. */
export function burningSeriesSlug(name: string): string {
  let slug = name.replace(/[:.;&''`´ ]/g, '-').replace(/-+/g, '-')
  if (slug.endsWith('-')) slug = slug.slice(0, -1)
  return slug
}

export function buildWatchUrl(template: string, s: Pick<Series, 'name' | 'season' | 'episode'>): string {
  const values: Record<string, string> = {
    name: s.name,
    slug: burningSeriesSlug(s.name),
    season: String(s.season),
    episode: String(s.episode),
  }
  return template.replace(/\{(name|slug|season|episode)\}/g, (_, key: string) => encodeURIComponent(values[key]!))
}
