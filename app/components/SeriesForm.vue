<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { parseDate, type DateValue } from '@internationalized/date'
import { DAY_LABELS, type Series, type SeriesInput } from '#shared/types'
import { seriesInputSchema } from '#shared/series-schema'
import { formatDate } from '#shared/format'

const props = defineProps<{ series: Series | null }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()
const api = useSeriesApi()

const state = reactive<SeriesInput>({
  name: props.series?.name ?? '',
  season: props.series?.season ?? 0,
  episode: props.series?.episode ?? 0,
  runningDay: props.series?.runningDay ?? null,
  startDate: props.series?.startDate ?? null,
})

// Reka's Select cannot hold null values → map to string keys
const dayItems = [{ label: 'Not running', value: 'none' }, ...DAY_LABELS.map((label, i) => ({ label, value: String(i) }))]
const runningDayKey = computed({
  get: () => (state.runningDay === null ? 'none' : String(state.runningDay)),
  set: (v: string) => {
    state.runningDay = v === 'none' ? null : Number(v)
    if (state.runningDay !== null) state.startDate = null
  },
})

const datePickerOpen = ref(false)
const calendarValue = computed({
  get: () => (state.startDate ? parseDate(state.startDate) : undefined),
  set: (v: DateValue | undefined) => {
    state.startDate = v ? v.toString() : null
    datePickerOpen.value = false
  },
})

const saving = ref(false)
async function onSubmit(event: FormSubmitEvent<SeriesInput>) {
  saving.value = true
  const result = props.series ? await api.update(props.series.id, event.data) : await api.create(event.data)
  saving.value = false
  if (result) emit('saved')
}
</script>

<template>
  <UForm :schema="seriesInputSchema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField label="Name" name="name" required>
      <UInput v-model="state.name" size="xl" class="w-full" :autofocus="series === null" />
    </UFormField>

    <div class="grid grid-cols-2 gap-3">
      <UFormField label="Season" name="season">
        <UInputNumber v-model="state.season" :min="0" size="xl" class="w-full" />
      </UFormField>
      <UFormField label="Episode" name="episode">
        <UInputNumber v-model="state.episode" :min="0" size="xl" class="w-full" />
      </UFormField>
    </div>

    <UFormField label="Running day" name="runningDay">
      <USelect v-model="runningDayKey" :items="dayItems" size="xl" class="w-full" />
    </UFormField>

    <UFormField label="Start date" name="startDate" :help="state.runningDay !== null ? 'Only for series that are not running yet' : undefined">
      <div class="flex gap-2">
        <UPopover v-model:open="datePickerOpen" :content="{ align: 'start' }">
          <UButton
            color="neutral"
            variant="outline"
            size="xl"
            icon="i-lucide-calendar"
            class="flex-1"
            :disabled="state.runningDay !== null"
            :label="state.startDate ? formatDate(state.startDate) : 'Pick a date'"
          />
          <template #content>
            <UCalendar v-model="calendarValue" class="p-2" />
          </template>
        </UPopover>
        <UButton
          v-if="state.startDate"
          color="neutral"
          variant="ghost"
          size="xl"
          icon="i-lucide-x"
          aria-label="Clear start date"
          @click="state.startDate = null"
        />
      </div>
    </UFormField>

    <div class="flex justify-end gap-2 pt-2">
      <UButton color="neutral" variant="ghost" size="xl" label="Cancel" @click="emit('cancel')" />
      <UButton type="submit" size="xl" :loading="saving" :label="series ? 'Save' : 'Add series'" />
    </div>
  </UForm>
</template>
