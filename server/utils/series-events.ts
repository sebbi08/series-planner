import type { createEventStream } from 'h3'

type Stream = ReturnType<typeof createEventStream>
const listeners = new Map<string, Set<Stream>>()

export function addSeriesListener(userName: string, stream: Stream): () => void {
  let set = listeners.get(userName)
  if (!set) listeners.set(userName, (set = new Set()))
  set.add(stream)
  return () => {
    set.delete(stream)
    if (set.size === 0) listeners.delete(userName)
  }
}

/** Notifies every open tab of this user. No listeners → no-op (the old app crashed here). */
export function emitSeriesChanged(userName: string): void {
  for (const stream of listeners.get(userName) ?? []) {
    stream.push({ event: 'series-changed', data: String(Date.now()) }).catch(() => {})
  }
}
