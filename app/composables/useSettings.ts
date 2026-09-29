import type { Settings } from '#shared/types'

export function useSettings() {
  const { data, refresh } = useFetch<Settings>('/api/settings', { key: 'settings', default: () => ({ watchUrlTemplate: null }) })
  return { settings: data, refresh }
}
