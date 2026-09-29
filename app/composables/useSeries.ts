import type { Series, SeriesInput } from '#shared/types'
import { episodeWatched } from '#shared/series-actions'

export function useSeries() {
  // Nuxt resets `data` to default() when a refresh fails. Returning the last good value from default() keeps the list on screen.
  const last = useState<Series[] | null>('series-last', () => null)
  const { data, status, error, refresh } = useFetch<Series[]>('/api/series', {
    key: 'series',
    default: () => last.value ?? [],
    transform: (v) => { last.value = v; return v },
  })
  const loaded = computed(() => last.value !== null)
  return { series: data, status, error, loaded, refresh }
}

/** Mutations. Call in setup. Every mutation refreshes the list; errors become toasts (401 → login). */
export function useSeriesApi() {
  const { toastError } = useApiError()
  const toast = useToast()
  const { data: cached } = useNuxtData<Series[]>('series')
  const refreshList = () => refreshNuxtData('series')

  async function run<T>(request: () => Promise<T>, errorTitle: string): Promise<T | undefined> {
    try {
      return await request()
    }
    catch (e) {
      toastError(e, errorTitle)
      return undefined
    }
    finally {
      await refreshList()
    }
  }

  return {
    create: async (input: SeriesInput) => {
      const created = await run(() => $fetch<Series>('/api/series', { method: 'POST', body: input }), 'Could not add series')
      if (created) toast.add({ title: `Added "${created.name}"`, color: 'success', icon: 'i-lucide-check' })
      return created
    },
    update: (id: string, input: SeriesInput) =>
      run(() => $fetch<Series>(`/api/series/${id}`, { method: 'PUT', body: input }), 'Could not save series'),
    remove: async (id: string) =>
      (await run(() => $fetch(`/api/series/${id}`, { method: 'DELETE' }).then(() => true), 'Could not delete series')) ?? false,
    // optimistic; run()'s refresh afterwards re-syncs with the server, which also rolls back a failed request
    watchEpisode: async (id: string) => {
      if (cached.value) cached.value = cached.value.map(s => (s.id === id ? (episodeWatched(s) ?? s) : s))
      await run(() => $fetch(`/api/series/${id}/episode-watched`, { method: 'POST' }), 'Could not mark episode')
    },
    finishSeason: async (id: string) => {
      await run(() => $fetch(`/api/series/${id}/season-finished`, { method: 'POST' }), 'Could not finish season')
    },
  }
}
