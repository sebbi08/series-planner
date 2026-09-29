<script setup lang="ts">
import { useSwipe } from '@vueuse/core'
import type { Series } from '#shared/types'
import { canWatchEpisode } from '#shared/series-actions'
import { buildWatchUrl } from '#shared/watch-url'

const props = defineProps<{ series: Series, watchTemplate: string | null, highlight?: boolean }>()
const api = useSeriesApi()

const watchUrl = computed(() => (props.watchTemplate ? buildWatchUrl(props.watchTemplate, props.series) : null))
const canPlusOne = computed(() => canWatchEpisode(props.series))

const rowEl = ref<HTMLElement | null>(null)
const revealed = ref(false)
useSwipe(rowEl, {
  passive: true,
  onSwipeEnd: (_e, direction) => {
    if (direction === 'left') revealed.value = true
    else if (direction === 'right') revealed.value = false
  },
})

function onRowClick(e: MouseEvent) {
  if (revealed.value) {
    e.preventDefault()
    revealed.value = false
  }
}
</script>

<template>
  <li
    :id="`s-${series.id}`"
    ref="rowEl"
    class="relative overflow-hidden rounded-lg border border-default transition-shadow"
    :class="highlight && 'ring-2 ring-primary'"
  >
    <!-- mobile swipe tray -->
    <div class="absolute inset-y-0 right-0 flex sm:hidden" aria-hidden="true">
      <button
        v-if="canPlusOne"
        type="button"
        :disabled="api.isBusy(series.id)"
        tabindex="-1"
        class="flex w-24 flex-col items-center justify-center gap-1 bg-primary text-xs font-medium text-inverted"
        @click="api.watchEpisode(series.id); revealed = false"
      >
        <UIcon name="i-lucide-plus" class="size-5" /> Episode
      </button>
      <a
        v-if="watchUrl"
        :href="watchUrl"
        target="_blank"
        rel="noopener"
        tabindex="-1"
        class="flex w-24 flex-col items-center justify-center gap-1 bg-info text-xs font-medium text-inverted"
        @click="revealed = false"
      >
        <UIcon name="i-lucide-play" class="size-5" /> Watch
      </a>
    </div>

    <div
      class="relative flex items-center gap-2 bg-default p-2 pl-3 transition-transform duration-200"
      :style="revealed ? { transform: `translateX(-${(canPlusOne ? 96 : 0) + (watchUrl ? 96 : 0)}px)` } : undefined"
    >
      <NuxtLink :to="`/series/${series.id}`" class="flex min-h-11 min-w-0 flex-1 flex-col justify-center" @click.capture="onRowClick">
        <span class="truncate font-medium">{{ series.name }}</span>
        <span class="flex flex-wrap items-center gap-2 text-sm text-muted">
          S{{ series.season }} · E{{ series.episode }}
          <SeriesStatusBadge :series="series" />
        </span>
      </NuxtLink>
      <UButton
        v-if="canPlusOne"
        icon="i-lucide-plus"
        color="primary"
        variant="soft"
        class="min-h-11 min-w-11 justify-center"
        :loading="api.isBusy(series.id)"
        :aria-label="`Mark next episode of ${series.name} as watched`"
        @click="api.watchEpisode(series.id)"
      />
      <UButton
        v-if="watchUrl"
        icon="i-lucide-play"
        color="neutral"
        variant="soft"
        :to="watchUrl"
        target="_blank"
        class="min-h-11 min-w-11 justify-center"
        :aria-label="`Watch ${series.name}`"
      />
      <UIcon name="i-lucide-chevron-right" class="hidden size-5 shrink-0 text-dimmed sm:block" />
    </div>
  </li>
</template>
