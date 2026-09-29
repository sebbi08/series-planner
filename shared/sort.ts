import type { Series } from './types'

export type SeriesGroupKey = 'running' | 'upcoming' | 'notStarted' | 'paused'

const GROUP_ORDER: SeriesGroupKey[] = ['running', 'upcoming', 'notStarted', 'paused']

export const GROUP_LABELS: Record<SeriesGroupKey, string> = {
  running: 'Running',
  upcoming: 'Upcoming',
  notStarted: 'Not started',
  paused: 'Paused',
}

type Sortable = Pick<Series, 'name' | 'season' | 'runningDay' | 'startDate'>

export function groupOf(s: Sortable): SeriesGroupKey {
  if (s.runningDay !== null) return 'running'
  if (s.startDate) return 'upcoming'
  if (s.season === 0) return 'notStarted'
  return 'paused'
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function compareSeries(a: Sortable, b: Sortable): number {
  const ga = groupOf(a)
  const gb = groupOf(b)
  if (ga !== gb) return GROUP_ORDER.indexOf(ga) - GROUP_ORDER.indexOf(gb)
  if (ga === 'running' && a.runningDay !== b.runningDay) return a.runningDay! - b.runningDay!
  if (ga === 'upcoming' && a.startDate !== b.startDate) return cmp(a.startDate!, b.startDate!)
  return cmp(a.name, b.name)
}

export function groupSeries<T extends Sortable>(list: T[]): { key: SeriesGroupKey, label: string, items: T[] }[] {
  const sorted = [...list].sort(compareSeries)
  return GROUP_ORDER
    .map(key => ({ key, label: GROUP_LABELS[key], items: sorted.filter(s => groupOf(s) === key) }))
    .filter(g => g.items.length > 0)
}
