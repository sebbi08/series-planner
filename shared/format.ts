import { DAY_LABELS } from './types'

/** "2023-08-23" → "23.08.2023" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function runningDayLabel(day: number | null): string {
  return day === null ? 'Not running' : (DAY_LABELS[day] ?? 'Unknown')
}
