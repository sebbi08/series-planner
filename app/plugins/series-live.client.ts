export default defineNuxtPlugin(() => {
  const { loggedIn } = useUserSession()
  let source: EventSource | null = null

  const refresh = () => {
    if (loggedIn.value) void refreshNuxtData('series')
  }

  watch(loggedIn, (isLoggedIn) => {
    if (isLoggedIn && !source) {
      source = new EventSource('/api/events')
      source.addEventListener('series-changed', refresh)
    }
    else if (!isLoggedIn && source) {
      source.close()
      source = null
    }
  }, { immediate: true })

  // also catches edits made through the OLD app, which does not emit SSE events
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh()
  })
})
