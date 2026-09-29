<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const { user, clear } = useUserSession()
const colorMode = useColorMode()
const { openCreate } = useSeriesForm()

async function logout() {
  await clear()
  await navigateTo('/login')
}

const menu = computed<DropdownMenuItem[][]>(() => [
  [{ label: user.value?.name ?? '', icon: 'i-lucide-user', type: 'label' }],
  [
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings', class: 'min-h-11' },
    {
      label: colorMode.value === 'dark' ? 'Light mode' : 'Dark mode',
      icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
      class: 'min-h-11 sm:hidden',
      onSelect: () => { colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark' },
    },
  ],
  [{ label: 'Logout', icon: 'i-lucide-log-out', onSelect: logout, class: 'min-h-11' }],
])
</script>

<template>
  <div class="min-h-dvh bg-default">
    <header class="sticky top-0 z-40 border-b border-default bg-default/80 pt-[env(safe-area-inset-top)] backdrop-blur">
      <UContainer class="flex h-14 items-center gap-2">
        <NuxtLink to="/" class="flex min-h-11 items-center gap-2 font-semibold">
          <UIcon name="i-lucide-tv" class="size-5 text-primary" />
          Series Planner
        </NuxtLink>
        <div class="flex-1" />
        <UButton class="hidden sm:inline-flex" icon="i-lucide-plus" label="Add series" @click="openCreate()" />
        <UColorModeButton class="hidden sm:inline-flex" />
        <UDropdownMenu :items="menu" :content="{ align: 'end' }">
          <UButton color="neutral" variant="ghost" icon="i-lucide-circle-user-round" class="min-h-11 min-w-11 justify-center" aria-label="Account menu" />
        </UDropdownMenu>
      </UContainer>
    </header>

    <UContainer as="main" class="py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:py-6">
      <slot />
    </UContainer>

    <UButton
      icon="i-lucide-plus"
      size="xl"
      aria-label="Add series"
      class="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 size-14 justify-center rounded-full shadow-lg sm:hidden"
      @click="openCreate()"
    />
    <SeriesFormOverlay />
  </div>
</template>
