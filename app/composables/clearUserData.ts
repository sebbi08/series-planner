/**
 * Drop every per-user client cache. Call whenever the session ends or begins.
 * Order matters: clear the "last good" state first, so the default() of the purged asyncData falls back to [] / empty settings.
 */
export function clearUserData() {
  // reset (not delete): still-mounted components hold refs to these keys and must see the initial value, not undefined
  clearNuxtState(['series-last', 'settings-last', 'series-form', 'series-busy'], { reset: true })
  clearNuxtData(['series', 'settings'])
}
