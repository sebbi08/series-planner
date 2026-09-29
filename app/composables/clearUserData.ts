/**
 * Drop every per-user client cache. Call whenever the session ends or begins.
 * Order matters: clear the "last good" state first, so the default() of the purged asyncData falls back to [] / empty settings.
 */
export function clearUserData() {
  clearNuxtState(['series-last', 'settings-last'])
  clearNuxtData(['series', 'settings'])
}
