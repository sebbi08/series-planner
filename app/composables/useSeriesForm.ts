import type { Series } from '#shared/types'

export function useSeriesForm() {
  const state = useState('series-form', () => ({ open: false, series: null as Series | null, key: 0 }))
  return {
    state,
    openCreate: () => { state.value = { open: true, series: null, key: state.value.key + 1 } },
    openEdit: (series: Series) => { state.value = { open: true, series: { ...series }, key: state.value.key + 1 } },
    close: () => { state.value.open = false },
  }
}
