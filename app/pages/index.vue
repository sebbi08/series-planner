<script setup lang="ts">
import { groupSeries } from '#shared/sort'

const route = useRoute()
const { series, status, error, loaded, refresh } = useSeries()
const { settings } = useSettings()
const { openCreate } = useSeriesForm()

const search = ref('')
const searchInput = useTemplateRef('searchInput')
defineShortcuts({ '/': () => searchInput.value?.inputRef?.focus() })

// case- and punctuation-insensitive, so "shield" finds "S.H.I.E.L.D."
const normalize = (v: string) => v.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

const groups = computed(() => {
  const q = normalize(search.value)
  return groupSeries(q ? series.value.filter(s => normalize(s.name).includes(q)) : series.value)
})

// "Back" from the detail page lands here with ?focus=<id>: scroll to it and flash a ring
const highlightId = ref<string | null>(null)
const nuxtApp = useNuxtApp()
// Nuxt's router resets the scroll to the top once the page has finished rendering; scroll after that
const afterPageFinish = () => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, 400)
  nuxtApp.hooks.hookOnce('page:finish', () => { clearTimeout(timer); resolve() })
})
watch([() => route.query.focus, () => series.value.length], async ([focus]) => {
  if (typeof focus !== 'string' || !series.value.length) return
  await nextTick()
  if (import.meta.client) {
    await afterPageFinish()
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
  document.getElementById(`s-${focus}`)?.scrollIntoView({ block: 'center' })
  highlightId.value = focus
  setTimeout(() => { highlightId.value = null }, 1600)
  await navigateTo({ query: {} }, { replace: true })
}, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <UInput
      ref="searchInput"
      v-model="search"
      icon="i-lucide-search"
      placeholder="Search series…"
      size="xl"
      class="w-full"
      :ui="{ trailing: 'pe-1' }"
    >
      <template #trailing>
        <UButton v-if="search" color="neutral" variant="link" icon="i-lucide-x" aria-label="Clear search" @click="search = ''" />
        <UKbd v-else value="/" class="hidden sm:inline-flex" />
      </template>
    </UInput>

    <div v-if="status === 'pending' && !series.length" class="space-y-2">
      <USkeleton v-for="i in 6" :key="i" class="h-16 w-full" />
    </div>

    <UEmpty
      v-else-if="error && !loaded"
      icon="i-lucide-cloud-off"
      title="Could not load your series"
      description="The server could not be reached. Check your connection and try again."
      :actions="[{ label: 'Retry', icon: 'i-lucide-refresh-cw', class: 'min-h-11', onClick: () => refresh() }]"
    />

    <UEmpty
      v-else-if="!series.length"
      icon="i-lucide-tv"
      title="No series yet"
      description="Add the first series you want to keep track of."
      :actions="[{ label: 'Add series', icon: 'i-lucide-plus', onClick: () => openCreate() }]"
    />

    <p v-else-if="!groups.length" class="py-8 text-center text-muted">No series match “{{ search }}”.</p>

    <section v-for="group in groups" :key="group.key" class="space-y-2">
      <h2 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
        {{ group.label }} <UBadge :label="group.items.length" color="neutral" variant="subtle" size="sm" />
      </h2>
      <ul class="space-y-2">
        <SeriesRow
          v-for="s in group.items"
          :key="s.id"
          :series="s"
          :watch-template="settings.watchUrlTemplate"
          :highlight="highlightId === s.id"
        />
      </ul>
    </section>
  </div>
</template>
