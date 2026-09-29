<script setup lang="ts">
import { settingsSchema } from '#shared/settings-schema'
import { BURNING_SERIES_PRESET, WATCH_PLACEHOLDERS, buildWatchUrl } from '#shared/watch-url'

const { settings, error, loaded, refresh } = useSettings()
const { series } = useSeries()
const { toastError } = useApiError()
const toast = useToast()

const state = reactive({ watchUrlTemplate: '' as string })
watch(settings, s => { state.watchUrlTemplate = s.watchUrlTemplate ?? '' }, { immediate: true })

const sample = computed(() => series.value[0] ?? { name: "Marvel's Agents of S.H.I.E.L.D.", season: 3, episode: 5 })
const preview = computed(() => {
  const t = state.watchUrlTemplate.trim()
  return /^https?:\/\//i.test(t) ? buildWatchUrl(t, sample.value) : null
})

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    await $fetch('/api/settings', { method: 'PUT', body: { watchUrlTemplate: state.watchUrlTemplate } })
    await refreshNuxtData('settings')
    toast.add({ title: 'Settings saved', color: 'success', icon: 'i-lucide-check' })
  }
  catch (e) {
    toastError(e, 'Could not save settings')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-6">
    <h1 class="text-2xl font-bold">Settings</h1>

    <UEmpty
      v-if="error && !loaded"
      icon="i-lucide-cloud-off"
      title="Could not load your settings"
      description="Saving is disabled until they have loaded."
      :actions="[{ label: 'Retry', icon: 'i-lucide-refresh-cw', class: 'min-h-11', onClick: () => refresh() }]"
    />

    <UCard v-else>
      <template #header>
        <h2 class="font-semibold">Watch link</h2>
        <p class="text-sm text-muted">The “Watch” button opens this URL. Leave empty to hide the button.</p>
      </template>

      <UForm :schema="settingsSchema" :state="state" class="space-y-4" @submit="save">
        <UFormField label="URL template" name="watchUrlTemplate">
          <UInput v-model="state.watchUrlTemplate" placeholder="https://example.com/{slug}/{season}" size="xl" class="w-full" inputmode="url" autocapitalize="none" />
        </UFormField>

        <ul class="space-y-1 text-sm">
          <li v-for="p in WATCH_PLACEHOLDERS" :key="p.token" class="flex gap-2">
            <code class="rounded bg-elevated px-1.5">{{ p.token }}</code><span class="text-muted">{{ p.description }}</span>
          </li>
        </ul>

        <div v-if="preview" class="rounded-md bg-elevated p-3 text-sm">
          <div class="text-muted">Preview for “{{ sample.name }}”</div>
          <a :href="preview" target="_blank" rel="noopener" class="break-all text-primary underline">{{ preview }}</a>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton type="submit" label="Save" size="lg" class="min-h-11" :loading="saving" />
          <UButton color="neutral" variant="outline" label="Use burningseries preset" size="lg" class="min-h-11" @click="state.watchUrlTemplate = BURNING_SERIES_PRESET" />
          <UButton color="neutral" variant="ghost" label="Clear" size="lg" class="min-h-11" @click="state.watchUrlTemplate = ''" />
        </div>
      </UForm>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Appearance</h2>
      </template>
      <UFormField label="Color mode">
        <UColorModeSelect size="xl" class="w-full sm:w-60" :ui="{ base: 'min-h-11' }" />
      </UFormField>
    </UCard>
  </div>
</template>
