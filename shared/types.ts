export const OPEN_END = 7

/** Index = stored runningDay value (0 = Monday … 6 = Sunday, 7 = Open End). */
export const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Open End'] as const

export interface Series {
  id: string
  name: string
  season: number
  episode: number
  /** 0–7 or null (= not running) */
  runningDay: number | null
  /** YYYY-MM-DD or null */
  startDate: string | null
}

export type SeriesInput = Omit<Series, 'id'>

export interface Settings {
  watchUrlTemplate: string | null
}

export function isRunning(s: Pick<Series, 'runningDay'>): boolean {
  return s.runningDay !== null
}
