<script setup lang="ts">
import type { Series } from '#shared/types'
import { groupOf } from '#shared/sort'
import { formatDate, runningDayLabel } from '#shared/format'

const props = defineProps<{ series: Series }>()
const badge = computed(() => {
  switch (groupOf(props.series)) {
    case 'running': return { label: runningDayLabel(props.series.runningDay), color: 'success' as const, icon: 'i-lucide-play' }
    case 'upcoming': return { label: formatDate(props.series.startDate!), color: 'info' as const, icon: 'i-lucide-calendar' }
    case 'notStarted': return { label: 'Not started', color: 'neutral' as const, icon: 'i-lucide-circle-dashed' }
    default: return { label: 'Paused', color: 'warning' as const, icon: 'i-lucide-pause' }
  }
})
</script>

<template>
  <UBadge :label="badge.label" :color="badge.color" :icon="badge.icon" variant="subtle" />
</template>
