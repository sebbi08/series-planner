import { OPEN_END, type SeriesInput } from './types'

type S = Pick<SeriesInput, 'runningDay' | 'startDate'>

export const canWatchEpisode = (s: S) => s.runningDay !== null || !!s.startDate
export const canFinishSeason = (s: S) => s.runningDay !== null

/** "Episode watched". Returns the updated series, or null if not allowed. */
export function episodeWatched<T extends SeriesInput>(s: T): T | null {
  if (s.runningDay !== null) return { ...s, episode: s.episode + 1 }
  if (s.startDate) {
    return { ...s, runningDay: OPEN_END, startDate: null, episode: s.episode + 1, season: s.season === 0 ? 1 : s.season }
  }
  return null
}

/** "Season finished". Returns the updated series, or null if not allowed. */
export function seasonFinished<T extends SeriesInput>(s: T): T | null {
  if (s.runningDay === null) return null
  return { ...s, episode: 0, season: s.season + 1, runningDay: null }
}
