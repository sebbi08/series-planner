<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })

const { fetch: refreshSession } = useUserSession()
const toast = useToast()
const { messageOf } = useApiError()
const { data: config } = await useFetch('/api/config', { default: () => ({ allowSignup: false }) })

const mode = ref<'login' | 'register'>('login')
const loading = ref(false)
const state = reactive({ name: '', password: '', confirm: '' })

const schema = computed(() => mode.value === 'login'
  ? z.object({ name: z.string().min(1, 'Username is required'), password: z.string().min(1, 'Password is required'), confirm: z.string() })
  : z.object({
      name: z.string().trim().min(1, 'Username is required').max(50),
      password: z.string().min(8, 'At least 8 characters'),
      confirm: z.string(),
    }).refine(v => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] }))

async function onSubmit(event: FormSubmitEvent<typeof state>) {
  loading.value = true
  try {
    await $fetch(mode.value === 'login' ? '/api/auth/login' : '/api/auth/register', {
      method: 'POST',
      body: { name: event.data.name, password: event.data.password },
    })
    await refreshSession()
    clearUserData()
    await navigateTo('/')
  }
  catch (e) {
    // Not toastError: a 401 here means bad credentials, not an expired session.
    toast.add({ title: mode.value === 'login' ? 'Login failed' : 'Could not create account', description: messageOf(e), color: 'error', icon: 'i-lucide-circle-alert' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-sm">
    <template #header>
      <div class="flex items-center gap-2 text-lg font-semibold">
        <UIcon name="i-lucide-tv" class="size-6 text-primary" />
        Series Planner
      </div>
    </template>

    <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField label="Username" name="name">
        <UInput v-model="state.name" autocomplete="username" autocapitalize="none" size="xl" class="w-full" />
      </UFormField>
      <UFormField label="Password" name="password">
        <UInput v-model="state.password" type="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" size="xl" class="w-full" />
      </UFormField>
      <UFormField v-if="mode === 'register'" label="Repeat password" name="confirm">
        <UInput v-model="state.confirm" type="password" autocomplete="new-password" size="xl" class="w-full" />
      </UFormField>
      <UButton type="submit" block size="xl" :loading="loading" :label="mode === 'login' ? 'Log in' : 'Create account'" />
    </UForm>

    <template v-if="config.allowSignup" #footer>
      <UButton
        variant="link"
        color="neutral"
        block
        class="min-h-11"
        :label="mode === 'login' ? 'No account yet? Create one' : 'Already have an account? Log in'"
        @click="mode = mode === 'login' ? 'register' : 'login'"
      />
    </template>
  </UCard>
</template>
