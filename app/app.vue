<script setup lang="ts">
const colorMode = useColorMode()
useHead({
  meta: [{ name: 'theme-color', content: computed(() => (colorMode.value === 'dark' ? '#18181b' : '#ffffff')) }],
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
