import type { Settings } from '#shared/types'

export function useSettings() {
  // see useSeries: default() returns the last good value so a failed refresh does not blank the form
  const last = useState<Settings | null>('settings-last', () => null)
  const { data, status, error, refresh } = useFetch<Settings>('/api/settings', {
    key: 'settings',
    default: () => last.value ?? { watchUrlTemplate: null },
    transform: (v) => { last.value = v; return v },
  })
  const loaded = computed(() => last.value !== null)
  return { settings: data, status, error, loaded, refresh }
}
