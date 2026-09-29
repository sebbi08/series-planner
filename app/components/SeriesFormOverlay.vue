<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

const { state, close } = useSeriesForm()
const isDesktop = useMediaQuery('(min-width: 640px)')
const title = computed(() => (state.value.series ? 'Edit series' : 'Add series'))
const open = computed({ get: () => state.value.open, set: (v: boolean) => { state.value.open = v } })
</script>

<template>
  <UModal v-if="isDesktop" v-model:open="open" :title="title" :close="{ class: 'min-h-11 min-w-11' }">
    <template #body>
      <SeriesForm :key="state.key" :series="state.series" @saved="close" @cancel="close" />
    </template>
  </UModal>
  <UDrawer v-else v-model:open="open" :title="title" :ui="{ content: 'max-h-[95dvh]', body: 'pb-[calc(1rem+env(safe-area-inset-bottom))]' }">
    <template #body>
      <SeriesForm :key="state.key" :series="state.series" @saved="close" @cancel="close" />
    </template>
  </UDrawer>
</template>
