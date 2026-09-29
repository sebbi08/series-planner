// Several parallel requests can 401 at once; only redirect (and toast) once.
let redirecting = false

export function useApiError() {
  const toast = useToast()
  const { clear } = useUserSession()

  function messageOf(e: unknown): string {
    const err = e as { data?: { statusMessage?: string, message?: string, data?: { issues?: { message: string }[] } }, statusMessage?: string, message?: string }
    return err?.data?.data?.issues?.[0]?.message
      ?? err?.data?.statusMessage
      ?? err?.statusMessage
      ?? err?.message
      ?? 'Something went wrong'
  }

  function toastError(e: unknown, title = 'Action failed') {
    const status = (e as { statusCode?: number, status?: number })?.statusCode ?? (e as { status?: number })?.status
    if (status === 401) {
      if (redirecting) return
      redirecting = true
      toast.add({ id: 'session-expired', title: 'Session expired', description: 'Please log in again.', color: 'warning', icon: 'i-lucide-log-in' })
      void clear()
        .then(async () => { clearUserData(); await navigateTo('/login') })
        .finally(() => { redirecting = false })
      return
    }
    toast.add({ title, description: messageOf(e), color: 'error', icon: 'i-lucide-circle-alert' })
  }

  return { toastError, messageOf }
}
