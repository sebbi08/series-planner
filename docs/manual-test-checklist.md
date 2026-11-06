# Manual test checklist

Run against a release image on series-new (real data), or locally with `npm run dev:db` + `npm run dev` (starts with an empty database — create users with `scripts/create-user.mjs`; items that need existing legacy accounts or the old app only apply on series-new).

## Auth
- [ ] Existing account logs in; afterwards `Users.<name>` has `passwordHash`, and `password`/`salt` are unchanged
- [ ] The same account still logs into the OLD app
- [ ] Wrong password and unknown user show the same "Invalid username or password"
- [ ] A wrong password on the login page shows "Login failed", not "Session expired"
- [ ] 11th failed attempt within 15 min → "Too many failed attempts"
- [ ] No "Create account" link while ALLOW_SIGNUP=false; `/api/auth/register` → 404
- [ ] Logout returns to /login; / redirects to /login when logged out
- [ ] Deleting the session cookie then clicking "+" → one "Session expired" toast → /login
- [ ] Session cookie deleted, then resume/focus the tab → one "Session expired" toast and /login
- [ ] Behind Traefik on series-new: re-run this section over HTTPS (secure cookie is set and sent)

## List
- [ ] Sections and order match the old app for every user (Running by weekday then name, Upcoming by date, Not started, Paused)
- [ ] Naruto Shippuden shows "Open End"; dates show as DD.MM.YYYY
- [ ] Search is case-insensitive and handles apostrophes/umlauts; "/" focuses the search box
- [ ] Search ignores punctuation: "shield" finds S.H.I.E.L.D.
- [ ] "+" increments instantly and survives a reload

## Series
- [ ] Add (running) → startDate is null in Mongo; Add (upcoming) → startDate `YYYY-MM-DDT00:00:00.000Z`, not shifted by timezone
- [ ] Episode watched: running → +1; upcoming → Open End, season 1 if it was 0
- [ ] Season finished → season+1, episode 0, not running; buttons disabled accordingly
- [ ] Edit prefilled; save updates; Back scrolls to and highlights the series
- [ ] Delete asks for confirmation and removes the series
- [ ] A series edited in the new app looks correct in the OLD app, and vice versa (new app refreshes on focus)
- [ ] Another user's series id in the URL → "Series not found"; the API returns 404 for PUT/DELETE

## Watch link
- [ ] No template → no Watch buttons
- [ ] burningseries preset → correct URL; custom template with {name} encodes special characters
- [ ] Non-http template rejected

## Live sync
- [ ] Two tabs: change in tab A appears in tab B within ~1 s
- [ ] Mongo stopped while the list is open, then focus the tab → the list stays visible and an error toast shows; after Mongo restarts, focus → it updates
- [ ] Restarting the container while a tab is open → the list catches up when the event stream reconnects
- [ ] Behind Traefik on series-new: re-run this section (SSE works through the proxy)

## Appearance and mobile (375 × 812)
Run this section on a real iPhone and a real Android device on series-new before cutover.

- [ ] Light / Dark / System; no wrong-theme flash on reload; theme-color meta follows the mode
- [ ] Header collapses to title + menu; FAB bottom-right respects the safe area
- [ ] Add/Edit opens as a bottom sheet; number steppers and the calendar work inside it
- [ ] Swipe left on a row reveals Episode/Watch; swipe right/tap closes it
- [ ] "Add to Home Screen" shows the icon and opens standalone

## Operations
Re-run this section behind Traefik on series-new (HTTPS, SSE through the proxy, secure cookie).

- [ ] `/api/health` → ok / db up / session ok / correct version; 503 while Mongo is stopped; recovers when it starts again
- [ ] With `NUXT_APP_SECRET` unset or shorter than 32 chars: startup logs a `[config]` error and `/api/health` → 503 `session: misconfigured`
- [ ] Container health status becomes `healthy`
- [ ] `node .output/server/scripts/create-user.mjs <name>` works inside the container
- [ ] Publishing a GitHub release pushes `ghcr.io/sebbi08/series-planner` for linux/amd64 and linux/arm64
