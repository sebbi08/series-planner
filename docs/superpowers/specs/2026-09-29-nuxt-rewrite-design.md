# Series Planner — Nuxt Rewrite Design

**Date:** 2026-09-29
**Status:** Approved in conversation, pending written-spec review

## 1. Goal

Recreate the existing Series Planner (Angular 4 + Express + socket.io, in `OLD/`) as a
Nuxt 4 app with Nuxt UI. It must run against the **existing MongoDB database unchanged**,
keep all existing accounts working, and fix the old app's security problems. The rewrite is
a faithful port plus these additions:

- Dark mode (light / dark / system).
- A per-user, configurable "Watch" link template, stored in the database.
- First-class mobile support.
- Closed registration.
- Release via GitHub Releases, which build and publish a Docker image.

### Context: the old app

- Live at `series.sebmahr.de` (Traefik), docker-compose with `mongo:8.0.32`, DB `SeriesPlaner2`.
- 5 users, 79 series. Personal/family use.
- The frontend source is lost; behaviour was reconstructed from the compiled
  `OLD/app/public/main.bundle.js`.

### Old-app problems this rewrite fixes

| Problem | Fix |
|---|---|
| Passwords hashed client-side; `CryptoJS.SHA256(password, salt)` ignores `salt`, so the stored `password` is unsalted SHA-256 | Server-side scrypt, with a transparent upgrade on login |
| No server auth: anyone who knows a username can read, edit or delete that user's series; the API returns password hashes | Encrypted cookie sessions; every query scoped to the session user |
| `emitChange` throws when a user has no socket | SSE registry treats missing listeners as a no-op |
| `POST /user` never responds | Registration disabled by default; responds correctly when enabled |
| Search is case-sensitive | Case-insensitive search |

## 2. Decisions

| Topic | Decision |
|---|---|
| Framework | Nuxt 4 (`app/` dir), SSR on for the first paint |
| UI | Nuxt UI (Tailwind + Reka UI), built-in color mode |
| DB access | Official `mongodb` driver + zod normalisation (no ORM) |
| Auth | `nuxt-auth-utils` sealed cookie session, scrypt hashes |
| Live sync | Server-Sent Events + refetch on window focus |
| Registration | Closed; `ALLOW_SIGNUP=true` enables it; CLI script creates users |
| Rollout | Side-by-side on `series-new.sebmahr.de`, then switch Traefik rule |
| Verification | Manual only (written checklist), no automated tests |
| Delivery | GitHub Release → Actions → multi-arch image on GHCR |
| Repo | Private `github.com/sebbi08/series-planner`; `OLD/` is gitignored |

## 3. Project layout

```
series-planner/
├─ app/
│  ├─ app.vue, app.config.ts, assets/css/main.css
│  ├─ layouts/default.vue
│  ├─ middleware/auth.global.ts
│  ├─ pages/index.vue, login.vue, series/[id].vue, settings.vue
│  ├─ components/SeriesList.vue, SeriesRow.vue, SeriesForm.vue, SeriesFormOverlay.vue, …
│  └─ composables/useSeries.ts, useSettings.ts
├─ server/
│  ├─ api/auth/login.post.ts, logout.post.ts, register.post.ts
│  ├─ api/series/index.get.ts, index.post.ts, [id].put.ts, [id].delete.ts,
│  │         [id]/episode-watched.post.ts, [id]/season-finished.post.ts
│  ├─ api/settings.get.ts, settings.put.ts, events.get.ts, health.get.ts
│  ├─ plugins/mongo.ts            (connect with retry, ensure indexes)
│  └─ utils/mongo.ts, schemas.ts, password.ts, events.ts, rate-limit.ts, require-user.ts
├─ shared/
│  ├─ types.ts                    (Series, Day enum, DTOs)
│  ├─ sort.ts                     (old comparator + grouping)
│  ├─ series-actions.ts           (episodeWatched / seasonFinished transitions)
│  └─ watch-url.ts                (slug + template expansion)
├─ public/                        (favicon, manifest icons)
├─ scripts/create-user.mjs
├─ docs/manual-test-checklist.md
├─ .github/workflows/release.yml
├─ Dockerfile, .dockerignore, .env.example, README.md
└─ OLD/                           (untouched, gitignored)
```

Anything used by both client and server lives in `shared/` as pure functions, so it can't
drift between the two.

## 4. Data model and compatibility

The database is `SeriesPlaner2`, with collections `Series` and `Users`. The old app and the
new app will write to the same database during the side-by-side phase. Rule: **the new app
must only write data the old app can read correctly.**

### Series (existing shape, unchanged)

```ts
{ _id: ObjectId, name: string, season: int, episode: int,
  runningDay: int 0..7 | null,        // 0=Mon … 6=Sun, 7=Open End
  startDate: string | null,           // ISO "YYYY-MM-DDT00:00:00.000Z"
  user: string }                      // user *name*, not id
```

- **Read normalisation** (zod, in `server/utils/schemas.ts`):
  - `runningDay`: numeric strings such as `"7"` become ints; out-of-range values become `null`.
  - `startDate`: an ISO string or a BSON Date becomes `YYYY-MM-DD` (UTC date part); invalid values become `null`.
  - Missing `season` / `episode` become `0`.
- **Write format:**
  - `runningDay` is always written as an int or `null`.
  - `startDate` is always written as a string `YYYY-MM-DDT00:00:00.000Z` or `null`.
  - The new app never writes fields other than the six listed.
- **Semantics** (same as the old app):
  - "Running" means `runningDay !== null`.
  - Choosing a running day in the form clears `startDate`.

### Users (existing fields kept, two optional fields added)

```ts
{ _id, name: string, password: string /* legacy sha256 hex */, salt: string /* unused */,
  passwordHash?: string   /* new: "scrypt$N$r$p$saltB64$hashB64" */,
  watchUrlTemplate?: string | null }
```

- The old app ignores unknown fields, so adding these is safe.
- `password` and `salt` stay untouched until cutover, so logging in to the old app keeps working.
- New users (from signup or the CLI) get only `passwordHash`. The CLI's `--legacy` flag also writes
  `password` (sha256) and a random `salt`, so a user created during the side-by-side phase can log in to
  the old app too. It's off by default because it stores an unsalted hash.

### Indexes (created idempotently at startup)

- `Series: { user: 1 }`
- `Users: { name: 1 }, unique`. Verified: the 5 existing names are unique. If creating the
  index fails, log a warning and continue; don't crash.

## 5. Server

### Mongo connection

- `DB` env var, in the same format as the old compose file
  (`user:pw@host:27017/SeriesPlaner2?authSource=admin`). If it has no `mongodb://` prefix, the app adds one.
- One shared `MongoClient`. At startup it connects with exponential backoff (1s → 30s, retrying forever) and
  logs each failed attempt. `/api/health` returns `{status, db: "up"|"down", version}` with a
  200 or 503 status.

### Auth (`nuxt-auth-utils`)

- The session cookie is sealed with `NUXT_SESSION_PASSWORD` (≥ 32 chars), `maxAge` is 30 days, and each request refreshes it.
- Session data: `{ user: { id: string, name: string } }`. Nothing else goes in the session, and hashes are never sent to the client.
- `POST /api/auth/login {name, password}`:
  1. Find the user by exact `name`.
  2. If `passwordHash` is set, verify it with scrypt (`crypto.scrypt`, timing-safe compare).
  3. Otherwise compare `sha256hex(password)` against `password` (timing-safe). On a match,
     `$set` `passwordHash`.
  4. On failure: `401 "Invalid username or password"`, the same message for an unknown user or a wrong password.
  5. Rate limit: in-memory, 10 failed attempts per 15 minutes per (IP, name) pair → `429`.
- `POST /api/auth/logout`: clears the session.
- `POST /api/auth/register {name, password}`:
  - returns `404` unless `ALLOW_SIGNUP=true`
  - name is 1–50 chars, password at least 8 chars
  - an existing name returns `409`
  - on success, logs the new user in
- `server/utils/require-user.ts`: `requireUserSession` wrapper that returns the session user. Every route
  below uses it.

### Series API

All queries filter on `{ user: session.user.name }`. An invalid ObjectId, or a document owned by another user, returns `404`.

| Route | Behaviour |
|---|---|
| `GET /api/series` | Normalised list, sorted with `shared/sort.ts` |
| `POST /api/series` | zod body: `name` 1–200 trimmed, `season`/`episode` int ≥ 0, `runningDay` 0–7 or null, `startDate` `YYYY-MM-DD` or null. If `runningDay` is set, `startDate` is forced to null. Returns the created series |
| `PUT /api/series/:id` | Same body, full replace of the five data fields |
| `DELETE /api/series/:id` | Deletes it; returns `204` |
| `POST /api/series/:id/episode-watched` | `shared/series-actions.ts` `episodeWatched` |
| `POST /api/series/:id/season-finished` | `shared/series-actions.ts` `seasonFinished` |

Transitions (the old rules, applied on the server):
- `episodeWatched(s)`:
  - if running: `episode+1`
  - else if it has a `startDate`: `runningDay=7`, `episode+1`, and `season=1` if it was 0
  - otherwise: no change → `409`
- `seasonFinished(s)`: only allowed while running (otherwise `409`). Sets `episode=0`, `season+1`, `runningDay=null`.

Every successful write calls `emitSeriesChanged(userName)`.

### Settings API

- `GET /api/settings` → `{ watchUrlTemplate: string | null }`.
- `PUT /api/settings { watchUrlTemplate }`: accepts a trimmed string (max 500 chars) or null, and the string must
  start with `http://` or `https://`.

### Live sync (SSE)

- `GET /api/events` requires a session. It opens an event stream (h3 `createEventStream`) and registers
  it in `Map<userName, Set<stream>>`. On close, it's removed from the registry.
- It sends `: ping` every 25s.
- `emitSeriesChanged(user)` pushes `event: series-changed`. If the user has no listeners, it does nothing.
- This works in a single process only, which is fine for one container.

### Errors

- Error codes:
  - zod failure → `400` with `data.issues`
  - no session → `401`
  - rate limited → `429`
  - not found or foreign document → `404`
  - disallowed transition → `409`
  - anything else → `500`, logged server-side with a generic message to the client
- The client shows every non-2xx response from a mutation as a `useToast()` error toast.

## 6. Watch link

- Per-user `watchUrlTemplate`, set on `/settings`. The Watch button is hidden while it's null.
- Placeholders, all URL-encoded with `encodeURIComponent` except `{slug}`, which is already URL-safe:
  - `{name}`: series name
  - `{slug}`: old burningseries slug. Replace each of `: . ; & ' ’ \` ´` and space with
    `-`, collapse runs of `-`, strip a single trailing `-`.
  - `{season}`, `{episode}`: numbers
- A preset button fills in exactly the old behaviour: `http://burningseries.ac/serie/{slug}/{season}`.
  The user can edit it afterwards (for example, if the domain has changed).
- Opens with `window.open(url, '_blank', 'noopener')`.

## 7. UI

The UI uses Nuxt UI components throughout. The theme comes from `app.config.ts` (primary color and neutral
color), and color mode is stored in a cookie so the first paint doesn't flash the wrong theme.

### Layout (`layouts/default.vue`)

- **Desktop header:** title "Series Planner" · spacer · "Add series" button · color-mode toggle ·
  user dropdown (username, Settings, Logout).
- **Mobile (< `sm`) header:** title plus a user dropdown that also holds the color mode. "Add series"
  becomes a floating action button (bottom-right, respects `env(safe-area-inset-bottom)`).
- `/login` uses a minimal, centered layout with no header actions.

### Pages

- **`/login`:** a card with username, password and a Login button. On submit it calls the API, fetches the session and
  goes to `/`. A "Create account" toggle appears only when the public runtime config
  `allowSignup` is true; it adds a confirm-password field.
- **`/` (series list):**
  - `UInput` search (case-insensitive substring match on name; the `/` key focuses it).
  - Grouped sections, in the old sort order. Each section header shows a count, and empty sections are hidden:
    1. **Running** (sorted by runningDay, then name). Badge: weekday or "Open End".
    2. **Upcoming**: not running, has a startDate (sorted by date). Shows the date as `DD.MM.YYYY`.
    3. **Not started**: not running, no startDate, season 0 (by name).
    4. **Paused**: everything else (by name).
  - Each row shows the name, `S{season} · E{episode}`, and a badge or date. Tapping the row goes to the detail page.
    Row actions: "+1 episode" (only when the series qualifies) and "Watch" (only when a template is set). Both are
    always visible as buttons of at least 44px. On mobile you can also swipe the row left to reveal them
    (a small custom pointer-events composable `useSwipe`; Nuxt UI has no swipe-row component).
  - Each row gets `id="s-<id>"`. Arriving with `?focus=<id>` scrolls to that row and briefly highlights it.
  - Empty state: "No series yet" plus an "Add series" button.
- **`/series/[id]`:**
  - Name, status badge, season, episode, and running day or start date. If not running and there's no start date: "Not currently
    running".
  - Primary actions: Watch · Episode watched · Season finished, each disabled under the old
    rules.
  - Secondary actions: Back (to `/?focus=<id>`) · Edit (opens the form) · Delete (confirmation modal, then back to the list).
  - An unknown id shows a "Series not found" message and a Back button.
- **Add/Edit form (`SeriesForm` + `SeriesFormOverlay`):**
  - `UForm` + zod, with the same schema as the server.
  - Fields:
    - Name
    - Season and Episode (number, min 0)
    - Running day (`USelect`: Not running, Monday…Sunday, Open End)
    - Start date (`UPopover` + `UCalendar`, with a clear button; disabled while a running day is set)
  - Choosing a running day clears the start date.
  - The overlay is a `UModal` on ≥ `sm` screens and a `UDrawer` (bottom sheet) on mobile.
- **`/settings`:** Watch-URL template input, placeholder help, live preview using the user's first series
  (or an example name), "Use burningseries preset" and "Clear" buttons, and a color-mode selector
  (System, Light, Dark).

### Client state

- `useSeries()`:
  - `useFetch('/api/series', { key: 'series' })`
  - opens an `EventSource('/api/events')` on the client while the page is logged in, and calls `refresh()` on
    `series-changed`
  - also refreshes on `visibilitychange` → visible and on `focus`
  - on logout, it closes the EventSource
  - mutations call the API and then `refresh()`; only "+1 episode" updates the list optimistically first and rolls back on error
- `useSettings()`: `useFetch('/api/settings')` plus a `save()` function.
- `middleware/auth.global.ts`:
  - not logged in and not on `/login` → `/login`
  - logged in and on `/login` → `/`

## 8. Mobile

- Designed mobile-first and checked at 375px width.
- Touch targets are at least 44px; there are no hover-only controls.
- `viewport-fit=cover` plus safe-area padding for the header, FAB and drawer.
- A `theme-color` meta tag that follows the color mode.
- Web app manifest (`name`, `short_name`, `display: standalone`, theme and background colors) and icons (192,
  512, maskable, apple-touch-icon), so it can be added to the home screen. There's no service worker and no offline mode.

## 9. Delivery

### Dockerfile

- Multi-stage, `node:22-alpine`: `npm ci` → `nuxt build` → a runtime stage that copies only
  `.output`.
- Runs as the non-root `node` user, with `ENV PORT=3000 HOST=0.0.0.0` and `EXPOSE 3000`.
- `HEALTHCHECK` uses `wget -qO- http://127.0.0.1:3000/api/health`.
- Build arg `APP_VERSION` is exposed via the runtime config and `/api/health`.

### GitHub

- Private repo `sebbi08/series-planner`, created with `gh repo create --private`.
- `.gitignore` covers `node_modules`, `.output`, `.nuxt`, `.env`, `OLD/` and `.playwright-mcp/`.
- `.github/workflows/release.yml`:
  - Trigger: `release: types: [published]`.
  - Permissions: `contents: read`, `packages: write`.
  - Steps: checkout, `docker/setup-qemu-action`, `docker/setup-buildx-action`,
    `docker/login-action` (ghcr.io, `GITHUB_TOKEN`), `docker/metadata-action` (semver tags
    `{{version}}` and `{{major}}.{{minor}}`, `{{major}}`, `latest`), and `docker/build-push-action` with
    platforms `linux/amd64,linux/arm64`, the GHA cache, and `APP_VERSION` set to the tag.
- To release: `gh release create vX.Y.Z --generate-notes`.

### Server rollout (documented in the README; the user performs it on the server)

1. On the server, run `docker login ghcr.io` once, with a PAT that has `read:packages`.
2. Add `NUXT_SESSION_PASSWORD` and `ALLOW_SIGNUP=false` to `.env`.
3. Add this service to the compose file:
   ```yaml
   series-new:
     image: ghcr.io/sebbi08/series-planner:1
     restart: unless-stopped
     environment:
       DB: root:${SERIES_PLANNER_DB_PW}@mongo:27017/SeriesPlaner2?authSource=admin
       NUXT_SESSION_PASSWORD: ${NUXT_SESSION_PASSWORD}
       ALLOW_SIGNUP: ${ALLOW_SIGNUP:-false}
     depends_on: [mongo]
     expose: [3000]
     labels:
       - traefik.enable=true
       - traefik.http.routers.series-new.rule=Host(`series-new.sebmahr.de`)
       - traefik.http.routers.series-new.entrypoints=websecure
       - traefik.http.services.series-new.loadbalancer.server.port=3000
       - wud.watch=true
       - wud.tag.include=^\d+\.\d+\.\d+$
     networks: [all]
   ```
4. Verify using the manual checklist.
5. Cutover: change the router rule to `series.sebmahr.de`, then remove the old `app` service.
6. Optional, after all users have logged in to the new app: remove the legacy `password` and `salt` fields
   (the command is in the README).

### User CLI

- `scripts/create-user.mjs <name>`: prompts for the password without echoing it, and reads `DB` from the environment.
- It writes `passwordHash`; `--legacy` also writes `password` and `salt` (see §4). An existing name → exit 1.
- It can be run inside the container with `docker compose exec series-new node scripts/create-user.mjs <name>`, so the script is
  copied into the image.

## 10. Verification

There are no automated tests. The following must be true before cutover:
- `docs/manual-test-checklist.md` has been worked through against a **copy** of the production `db/` (local
  docker Mongo) and every item passes. It covers:
  - login with an existing account → `passwordHash` added, `password` and `salt` unchanged, old app login still works
  - wrong password or unknown user → same error; the rate limit triggers after 10 failures
  - list grouping and order match the old app for every user
  - add, edit, +1 episode (for a running series, and for an upcoming one that becomes Open End), season finished, delete
  - a series edited in the new app displays correctly in the old app
  - the Watch button is hidden without a template; the preset and custom templates open the correct URL
  - live sync between two browser tabs
  - user A can't access user B's series via its URL or the API
  - dark, light and system modes; no flash of the wrong theme on reload
  - mobile (375px): FAB, bottom-sheet form, swipe actions, home-screen install
  - `/api/health` reports the db status and version
  - a release publishes `ghcr.io/sebbi08/series-planner` for both architectures
- Claude may drive the local checks with the Playwright MCP.

## 11. Out of scope

- Automated tests
- Data model changes beyond the two additive `Users` fields
- Email or password reset
- i18n
- Service worker or offline mode
- Multi-instance scaling of SSE
