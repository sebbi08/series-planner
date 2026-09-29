<script setup lang="ts">
import { isRunning } from '#shared/types'
import { canFinishSeason, canWatchEpisode } from '#shared/series-actions'
import { buildWatchUrl } from '#shared/watch-url'
import { formatDate, runningDayLabel } from '#shared/format'

const route = useRoute()
const id = computed(() => String(route.params.id))
const { series, status, error, loaded, refresh } = useSeries()
const { settings } = useSettings()
const api = useSeriesApi()
const { openEdit } = useSeriesForm()

const item = computed(() => series.value.find(s => s.id === id.value) ?? null)
const watchUrl = computed(() => (item.value && settings.value.watchUrlTemplate ? buildWatchUrl(settings.value.watchUrlTemplate, item.value) : null))
useHead({ title: computed(() => (item.value ? `${item.value.name} · Series Planner` : 'Series Planner')) })

const back = () => navigateTo({ path: '/', query: { focus: id.value } })

const confirmDelete = ref(false)
const deleting = ref(false)
async function doDelete() {
  deleting.value = true
  const ok = await api.remove(id.value)
  deleting.value = false
  confirmDelete.value = false
  if (ok) await navigateTo('/')
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-6">
    <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" label="Back" class="-ml-2 min-h-11" @click="back" />

    <USkeleton v-if="status === 'pending' && !item" class="h-64 w-full" />

    <UEmpty
      v-else-if="error && !loaded"
      icon="i-lucide-cloud-off"
      title="Could not load this series"
      description="The server could not be reached. Check your connection and try again."
      :actions="[{ label: 'Retry', icon: 'i-lucide-refresh-cw', class: 'min-h-11', onClick: () => refresh() }]"
    />

    <UEmpty
      v-else-if="!item"
      icon="i-lucide-search-x"
      title="Series not found"
      description="It may have been deleted."
      :actions="[{ label: 'Back to list', icon: 'i-lucide-arrow-left', to: '/', class: 'min-h-11' }]"
    />

    <template v-else>
      <div class="space-y-3">
        <h1 class="text-2xl font-bold break-words">{{ item.name }}</h1>
        <SeriesStatusBadge :series="item" />
      </div>

      <UCard>
        <dl class="grid grid-cols-2 gap-4">
          <div>
            <dt class="text-sm text-muted">Season</dt>
            <dd class="text-2xl font-semibold">{{ item.season }}</dd>
          </div>
          <div>
            <dt class="text-sm text-muted">Episode</dt>
            <dd class="text-2xl font-semibold">{{ item.episode }}</dd>
          </div>
          <div class="col-span-2">
            <dt class="text-sm text-muted">{{ isRunning(item) ? 'Running day' : 'Start date' }}</dt>
            <dd class="font-medium">
              <template v-if="isRunning(item)">{{ runningDayLabel(item.runningDay) }}</template>
              <template v-else-if="item.startDate">Starts on {{ formatDate(item.startDate) }}</template>
              <template v-else>Not currently running</template>
            </dd>
          </div>
        </dl>
      </UCard>

      <div class="grid gap-2 sm:grid-cols-3">
        <UButton v-if="watchUrl" :to="watchUrl" target="_blank" icon="i-lucide-play" label="Watch" size="xl" block />
        <UButton
          icon="i-lucide-plus"
          label="Episode watched"
          size="xl"
          block
          variant="soft"
          :disabled="!canWatchEpisode(item)"
          @click="api.watchEpisode(item.id)"
        />
        <UButton
          icon="i-lucide-flag"
          label="Season finished"
          size="xl"
          block
          variant="soft"
          :disabled="!canFinishSeason(item)"
          @click="api.finishSeason(item.id)"
        />
      </div>

      <USeparator />

      <div class="flex gap-2">
        <UButton color="neutral" variant="outline" icon="i-lucide-pencil" label="Edit" size="lg" class="min-h-11" @click="openEdit(item)" />
        <UButton color="error" variant="ghost" icon="i-lucide-trash-2" label="Delete" size="lg" class="min-h-11" @click="confirmDelete = true" />
      </div>

      <UModal v-model:open="confirmDelete" :close="{ class: 'min-h-11 min-w-11' }" title="Delete series?" :description="`“${item.name}” will be deleted. This cannot be undone.`">
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton color="neutral" variant="ghost" label="Cancel" class="min-h-11" @click="confirmDelete = false" />
            <UButton color="error" label="Delete" class="min-h-11" :loading="deleting" @click="doDelete" />
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
