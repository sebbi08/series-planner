# Series Planner Nuxt Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old Angular/Express Series Planner with a Nuxt 4 + Nuxt UI app. The new app uses the existing MongoDB database unchanged and adds dark mode, a per-user Watch-link template, mobile support, and releases to GHCR.

**Architecture:** A single full-stack Nuxt app.
- Nitro server routes talk to MongoDB through the official driver.
- A small normalisation layer absorbs quirks in the legacy data.
- Auth uses `nuxt-auth-utils` sealed cookie sessions, and legacy SHA-256 hashes are upgraded transparently to scrypt.
- Live sync uses Server-Sent Events.
- Pure domain logic (sorting, state transitions, watch URLs, validation) lives in `shared/` and is used by both client and server.

**Tech Stack:** Nuxt 4.5, Nuxt UI 4.11 (Tailwind 4), nuxt-auth-utils 0.5, mongodb 7, zod 4, @vueuse/core, @internationalized/date, Node 22, Docker, GitHub Actions → GHCR.

**Spec:** `docs/superpowers/specs/2026-09-29-nuxt-rewrite-design.md`. Read it before starting any task.

## Global Constraints

- **No automated tests** (user decision). Every task ends with the manual verification steps written in it, plus `npx nuxt typecheck`. Do not add Vitest or Playwright test files.
- Node 22. Pin `typescript@~6.0.3`: TypeScript 7 is the native port, and `vue-tsc` needs the JS API.
- Database `SeriesPlaner2`, collections `Series` and `Users`. Never rename or restructure existing fields.
- Series writes contain exactly `name, season, episode, runningDay, startDate, user`:
  - `runningDay` is an int 0–7 or `null` (0=Monday … 6=Sunday, 7=Open End).
  - `startDate` is the string `YYYY-MM-DDT00:00:00.000Z` or `null`.
- Users: only ever add `passwordHash` and `watchUrlTemplate`. Never modify `password` or `salt` on existing users.
- `passwordHash` format: `scrypt$16384$8$1$<saltB64>$<hashB64>` (key length 64, salt 16 bytes).
- Environment variables:
  - `DB`: the old compose format, `user:pw@host:27017/SeriesPlaner2?authSource=admin`, with the `mongodb://` prefix optional
  - `NUXT_SESSION_PASSWORD`: at least 32 characters
  - `ALLOW_SIGNUP`: registration is enabled only when this is `"true"`
  - `APP_VERSION`: optional, defaults to `dev`
- Every series and settings query is scoped to the session user. A foreign or invalid id returns **404**.
- Mobile: touch targets are at least 44px (`min-h-11 min-w-11`), there are no hover-only controls, and layouts must work at 375px wide.
- Icons: Lucide through Nuxt UI (`i-lucide-*`), served locally from `@iconify-json/lucide`.
- UI copy is in English, with dates shown as `DD.MM.YYYY`.
- The `OLD/` directory is never modified and never committed.
- Commit after every task, using conventional-commit messages ending with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Deliberate refinements of the spec (decided while planning)

1. **Logout:** uses nuxt-auth-utils' built-in `DELETE /api/_auth/session` (called by `useUserSession().clear()`). There is no custom `/api/auth/logout` route.
2. **Signup flag on the client:** `allowSignup` reaches the client through `GET /api/config`, not public runtime config. Public runtime config would be fixed at build time inside the Docker image; the endpoint reads `ALLOW_SIGNUP` at runtime.
3. **Swipe gesture:** uses VueUse `useSwipe`, not a hand-written composable.
4. **Password hashing:** lives in a dependency-free `lib/password.mjs` shared by the server and the CLI, so the CLI works inside the production image.
5. **Watch URL placeholders:** all are `encodeURIComponent`-encoded, including `{slug}`. This is harmless for slugs and safe for non-ASCII names.
6. **Normalisation:** implemented with plain functions, not zod. zod is used only for request validation.

## Review Focus

These are inputs and conditions the spec implies but no task exercises by default. Each has a manual check in its owning task.

1. **Legacy document quirks** (`runningDay: "7"`, string `startDate`, missing fields): the list must render all 79 production series without errors, and Naruto Shippuden must show as "Open End". *(Task 3, Step 6; Task 13)*
2. **Special characters in names** (`Marvel's Agents of S.H.I.E.L.D.`, umlauts, `&`): search matches them, the Watch URL is correct and encoded, and they round-trip through edit unchanged. *(Task 2, Step 6; Task 11, Step 4)*
3. **Session expiry or logout in another tab while on a page:** the next mutation redirects to `/login` with one toast, not a stream of errors. *(Task 8, Step 8)*
4. **Old app and new app editing the same data concurrently:** the new app picks up old-app edits on window focus, and the old app shows new-app edits correctly. *(Task 13, Step 5)*
5. **Mobile form in the bottom sheet:** the number inputs and the calendar popover work inside `UDrawer` at 375px, and the keyboard doesn't hide the Save button. *(Task 9, Step 5)*

---

## File Structure

```
series-planner/
├─ package.json, nuxt.config.ts, tsconfig.json, app.config.ts → (app/app.config.ts)
├─ .env.example, .gitignore (exists), .dockerignore, Dockerfile, README.md
├─ lib/password.mjs, lib/password.d.mts        # scrypt + legacy sha256, node:crypto only
├─ scripts/dev-db.sh                            # local Mongo on a COPY of OLD/db
├─ scripts/create-user.mjs                      # CLI user creation
├─ shared/
│  ├─ types.ts                                  # Series, SeriesInput, Settings, Day labels
│  ├─ types/auth.d.ts                           # nuxt-auth-utils User typing
│  ├─ series-schema.ts                          # zod input schema + normaliseSeriesInput
│  ├─ settings-schema.ts                        # zod settings schema
│  ├─ sort.ts                                   # groupOf, compareSeries, groupSeries
│  ├─ series-actions.ts                         # canWatchEpisode, canFinishSeason, episodeWatched, seasonFinished
│  ├─ watch-url.ts                              # burningSeriesSlug, buildWatchUrl, BURNING_SERIES_PRESET
│  └─ format.ts                                 # formatDate, runningDayLabel
├─ server/
│  ├─ plugins/mongo.ts                          # start connection loop
│  ├─ utils/mongo.ts                            # client, useDb, collections, parseObjectId, pingDb
│  ├─ utils/documents.ts                        # SeriesDoc/UserDoc, toSeries, toSeriesDocFields
│  ├─ utils/password.ts                         # checkUserPassword (legacy upgrade)
│  ├─ utils/rate-limit.ts                       # login failure limiter
│  ├─ utils/require-user.ts                     # requireUser (sliding session)
│  ├─ utils/series.ts                           # requireSeriesId, findOwnSeries
│  ├─ utils/series-events.ts                    # SSE listener registry
│  └─ api/ health.get.ts, config.get.ts, events.get.ts,
│         auth/login.post.ts, auth/register.post.ts,
│         series/index.get.ts, series/index.post.ts, series/[id].put.ts, series/[id].delete.ts,
│         series/[id]/episode-watched.post.ts, series/[id]/season-finished.post.ts,
│         settings.get.ts, settings.put.ts
├─ app/
│  ├─ app.vue, app.config.ts, assets/css/main.css
│  ├─ layouts/default.vue, layouts/auth.vue
│  ├─ middleware/auth.global.ts
│  ├─ plugins/series-live.client.ts             # EventSource + focus refresh
│  ├─ composables/useSeries.ts                  # useSeries (data) + useSeriesApi (mutations)
│  ├─ composables/useSettings.ts
│  ├─ composables/useSeriesForm.ts              # global add/edit overlay state
│  ├─ composables/useApiError.ts                # error → toast / redirect on 401
│  ├─ components/SeriesRow.vue, SeriesStatusBadge.vue, SeriesForm.vue, SeriesFormOverlay.vue
│  └─ pages/index.vue, login.vue, series/[id].vue, settings.vue
├─ public/ manifest.webmanifest, icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, favicon.ico
├─ docs/manual-test-checklist.md
└─ .github/workflows/release.yml
```

---

### Task 1: Scaffold Nuxt app and local dev database

**Files:**
- Create: `package.json`, `nuxt.config.ts`, `tsconfig.json`, `app/app.vue`, `app/app.config.ts`, `app/assets/css/main.css`, `app/pages/index.vue` (temporary), `.env.example`, `scripts/dev-db.sh`
- Modify: `.gitignore` (already has `.data/`, `OLD/`, `.env`)

**Interfaces:**
- Produces: a runnable `npm run dev` on port 3000; a local Mongo on `localhost:27018` holding a **copy** of the production data; `.env` with `DB=localhost:27018/SeriesPlaner2`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "series-planner",
  "private": true,
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "node .output/server/index.mjs",
    "typecheck": "nuxt typecheck",
    "postinstall": "nuxt prepare",
    "dev:db": "bash scripts/dev-db.sh"
  },
  "engines": { "node": ">=22" }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install nuxt@^4.5.2 @nuxt/ui@^4.11.2 nuxt-auth-utils@^0.5.30 mongodb@^7.7.0 zod@^4.6.5 @vueuse/core@^14 @internationalized/date@^3.12.4 @iconify-json/lucide tailwindcss@^4.3.3
npm install -D typescript@~6.0.3 vue-tsc@^3.3.11
```

Expected: installs without peer-dependency errors. If `@vueuse/core@^14` conflicts with Nuxt UI's copy, use the exact version Nuxt UI depends on (`npm ls @vueuse/core`).

- [ ] **Step 3: Create `nuxt.config.ts`**

```ts
export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: true },
  colorMode: { storage: 'cookie' },
  runtimeConfig: {
    session: { maxAge: 60 * 60 * 24 * 30 },
  },
  app: {
    head: {
      title: 'Series Planner',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'alternate icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },
})
```

- [ ] **Step 4: Create `tsconfig.json`**

This is the Nuxt 4 project-references layout.

```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

- [ ] **Step 5: Create the app shell files**

`app/assets/css/main.css`:
```css
@import "tailwindcss";
@import "@nuxt/ui";
```

`app/app.config.ts`:
```ts
export default defineAppConfig({
  ui: {
    colors: { primary: 'indigo', neutral: 'zinc' },
  },
})
```

`app/app.vue`:
```vue
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
```

`app/pages/index.vue` (temporary; replaced in Task 8):
```vue
<template>
  <div class="p-6"><UButton icon="i-lucide-tv">Series Planner</UButton> <UColorModeButton /></div>
</template>
```

- [ ] **Step 6: Create `scripts/dev-db.sh`**

```bash
#!/usr/bin/env bash
# Local MongoDB on a COPY of the production data in OLD/db. Never mounts OLD/db itself.
# Usage: scripts/dev-db.sh [--reset]
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=sp-dev-mongo
IMAGE=mongo:8.0.32

docker rm -f "$NAME" >/dev/null 2>&1 || true

if [[ "${1:-}" == "--reset" && -d .data/db ]]; then
  # files are owned by the container's mongodb user, so delete them from inside a container
  docker run --rm -v "$PWD/.data:/d" "$IMAGE" rm -rf /d/db
fi

if [[ ! -d .data/db ]]; then
  mkdir -p .data
  cp -r OLD/db .data/db
  rm -f .data/db/mongod.lock
fi

docker run -d --name "$NAME" -p 27018:27017 -v "$PWD/.data/db:/data/db" "$IMAGE" >/dev/null
echo "Mongo (copy of OLD/db) on mongodb://localhost:27018/SeriesPlaner2"
```

Run `chmod +x scripts/dev-db.sh`.

The copied data directory was created by a container started without `--auth` init variables, so the local instance needs no credentials.

- [ ] **Step 7: Create `.env.example` and a local `.env`**

`.env.example`:
```bash
# Mongo connection, same format as the old docker-compose "DB" variable; mongodb:// prefix optional
DB=localhost:27018/SeriesPlaner2
# >= 32 random chars: openssl rand -base64 48
NUXT_SESSION_PASSWORD=
# "true" enables /api/auth/register and the "Create account" link
ALLOW_SIGNUP=false
```

Then `cp .env.example .env` and fill in `NUXT_SESSION_PASSWORD` with the output of `openssl rand -base64 48`.

- [ ] **Step 8: Verify manually**

Run: `npm run dev:db && npm run dev`
Expected:
- Opening `http://localhost:3000` shows an indigo "Series Planner" button with a TV icon and a colour-mode button.
- Clicking the colour-mode button toggles dark mode, and a reload keeps the chosen mode with no flash of the wrong theme.

Run: `docker exec sp-dev-mongo mongosh --quiet --eval 'db.getSiblingDB("SeriesPlaner2").Series.countDocuments()'`
Expected: `79`

Run: `npx nuxt typecheck`
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json nuxt.config.ts tsconfig.json app .env.example scripts/dev-db.sh
git commit -m "chore: scaffold Nuxt 4 app with Nuxt UI and local dev DB script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared domain logic

**Files:**
- Create: `shared/types.ts`, `shared/series-schema.ts`, `shared/settings-schema.ts`, `shared/sort.ts`, `shared/series-actions.ts`, `shared/watch-url.ts`, `shared/format.ts`

**Interfaces:**
- Produces (imported via `#shared/<file>` everywhere):
  - `types.ts`:
    - `interface Series { id: string; name: string; season: number; episode: number; runningDay: number | null; startDate: string | null }` (`startDate` is `YYYY-MM-DD`)
    - `type SeriesInput = Omit<Series, 'id'>`
    - `interface Settings { watchUrlTemplate: string | null }`
    - `OPEN_END = 7`
    - `DAY_LABELS: readonly string[]` (8 entries)
    - `isRunning(s: Pick<Series,'runningDay'>): boolean`
  - `series-schema.ts`: `seriesInputSchema` (zod object) and `normaliseSeriesInput(body: unknown): SeriesInput` (parses the body, then forces `startDate = null` when `runningDay !== null`)
  - `settings-schema.ts`: `settingsSchema` (zod) and `parseSettings(body: unknown): Settings`
  - `sort.ts`:
    - `type SeriesGroupKey = 'running' | 'upcoming' | 'notStarted' | 'paused'`
    - `groupOf(s): SeriesGroupKey`
    - `compareSeries(a, b): number`
    - `groupSeries(list: Series[]): { key: SeriesGroupKey; label: string; items: Series[] }[]` (empty groups omitted)
  - `series-actions.ts`:
    - `canWatchEpisode(s): boolean`
    - `canFinishSeason(s): boolean`
    - `episodeWatched<T extends SeriesInput>(s: T): T | null`
    - `seasonFinished<T extends SeriesInput>(s: T): T | null`
  - `watch-url.ts`:
    - `BURNING_SERIES_PRESET: string`
    - `WATCH_PLACEHOLDERS: { token: string; description: string }[]`
    - `burningSeriesSlug(name: string): string`
    - `buildWatchUrl(template: string, s: Pick<Series,'name'|'season'|'episode'>): string`
  - `format.ts`:
    - `formatDate(iso: string): string` (`YYYY-MM-DD` → `DD.MM.YYYY`)
    - `runningDayLabel(day: number | null): string`

- [ ] **Step 1: Create `shared/types.ts`**

```ts
export const OPEN_END = 7

/** Index = stored runningDay value (0 = Monday … 6 = Sunday, 7 = Open End). */
export const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Open End'] as const

export interface Series {
  id: string
  name: string
  season: number
  episode: number
  /** 0–7 or null (= not running) */
  runningDay: number | null
  /** YYYY-MM-DD or null */
  startDate: string | null
}

export type SeriesInput = Omit<Series, 'id'>

export interface Settings {
  watchUrlTemplate: string | null
}

export function isRunning(s: Pick<Series, 'runningDay'>): boolean {
  return s.runningDay !== null
}
```

- [ ] **Step 2: Create `shared/series-schema.ts` and `shared/settings-schema.ts`**

`shared/series-schema.ts`:
```ts
import { z } from 'zod'
import type { SeriesInput } from './types'

const isRealDate = (v: string) => {
  const d = new Date(`${v}T00:00:00.000Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v)
}

export const seriesInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
  season: z.number().int('Must be a whole number').min(0, 'Must be 0 or more'),
  episode: z.number().int('Must be a whole number').min(0, 'Must be 0 or more'),
  runningDay: z.number().int().min(0).max(7).nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').refine(isRealDate, 'Invalid date').nullable(),
})

/** Validates a request body and applies the rule "a running series has no start date". Throws ZodError. */
export function normaliseSeriesInput(body: unknown): SeriesInput {
  const v = seriesInputSchema.parse(body)
  return v.runningDay !== null ? { ...v, startDate: null } : v
}
```

`shared/settings-schema.ts`:
```ts
import { z } from 'zod'
import type { Settings } from './types'

export const settingsSchema = z.object({
  watchUrlTemplate: z.preprocess(
    v => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(500, 'Template is too long').regex(/^https?:\/\//i, 'Must start with http:// or https://').nullable(),
  ),
})

export function parseSettings(body: unknown): Settings {
  return settingsSchema.parse(body) as Settings
}
```

- [ ] **Step 3: Create `shared/sort.ts`**

This reproduces the old comparator: running series by day then name, then series with a start date by date, then season-0 series, then the rest, each by name. Name comparison uses code-unit order, as the old app did.

```ts
import type { Series } from './types'

export type SeriesGroupKey = 'running' | 'upcoming' | 'notStarted' | 'paused'

const GROUP_ORDER: SeriesGroupKey[] = ['running', 'upcoming', 'notStarted', 'paused']

export const GROUP_LABELS: Record<SeriesGroupKey, string> = {
  running: 'Running',
  upcoming: 'Upcoming',
  notStarted: 'Not started',
  paused: 'Paused',
}

type Sortable = Pick<Series, 'name' | 'season' | 'runningDay' | 'startDate'>

export function groupOf(s: Sortable): SeriesGroupKey {
  if (s.runningDay !== null) return 'running'
  if (s.startDate) return 'upcoming'
  if (s.season === 0) return 'notStarted'
  return 'paused'
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function compareSeries(a: Sortable, b: Sortable): number {
  const ga = groupOf(a)
  const gb = groupOf(b)
  if (ga !== gb) return GROUP_ORDER.indexOf(ga) - GROUP_ORDER.indexOf(gb)
  if (ga === 'running' && a.runningDay !== b.runningDay) return a.runningDay! - b.runningDay!
  if (ga === 'upcoming' && a.startDate !== b.startDate) return cmp(a.startDate!, b.startDate!)
  return cmp(a.name, b.name)
}

export function groupSeries<T extends Sortable>(list: T[]): { key: SeriesGroupKey, label: string, items: T[] }[] {
  const sorted = [...list].sort(compareSeries)
  return GROUP_ORDER
    .map(key => ({ key, label: GROUP_LABELS[key], items: sorted.filter(s => groupOf(s) === key) }))
    .filter(g => g.items.length > 0)
}
```

- [ ] **Step 4: Create `shared/series-actions.ts`**

These are the old detail-page rules. Deviation: when an upcoming series becomes Open End, `startDate` is cleared, which keeps the "running ⇒ no start date" invariant. The old app displayed such series identically.

```ts
import { OPEN_END, type SeriesInput } from './types'

type S = Pick<SeriesInput, 'runningDay' | 'startDate'>

export const canWatchEpisode = (s: S) => s.runningDay !== null || !!s.startDate
export const canFinishSeason = (s: S) => s.runningDay !== null

/** "Episode watched". Returns the updated series, or null if not allowed. */
export function episodeWatched<T extends SeriesInput>(s: T): T | null {
  if (s.runningDay !== null) return { ...s, episode: s.episode + 1 }
  if (s.startDate) {
    return { ...s, runningDay: OPEN_END, startDate: null, episode: s.episode + 1, season: s.season === 0 ? 1 : s.season }
  }
  return null
}

/** "Season finished". Returns the updated series, or null if not allowed. */
export function seasonFinished<T extends SeriesInput>(s: T): T | null {
  if (s.runningDay === null) return null
  return { ...s, episode: 0, season: s.season + 1, runningDay: null }
}
```

- [ ] **Step 5: Create `shared/watch-url.ts` and `shared/format.ts`**

`shared/watch-url.ts`:
```ts
import type { Series } from './types'

export const BURNING_SERIES_PRESET = 'http://burningseries.ac/serie/{slug}/{season}'

export const WATCH_PLACEHOLDERS = [
  { token: '{name}', description: 'Series name' },
  { token: '{slug}', description: 'Name as URL slug (burningseries style)' },
  { token: '{season}', description: 'Season number' },
  { token: '{episode}', description: 'Episode number' },
] as const

/** Old app's burningseries slug rules. */
export function burningSeriesSlug(name: string): string {
  let slug = name.replace(/[:.;&'’`´ ]/g, '-').replace(/-+/g, '-')
  if (slug.endsWith('-')) slug = slug.slice(0, -1)
  return slug
}

export function buildWatchUrl(template: string, s: Pick<Series, 'name' | 'season' | 'episode'>): string {
  const values: Record<string, string> = {
    name: s.name,
    slug: burningSeriesSlug(s.name),
    season: String(s.season),
    episode: String(s.episode),
  }
  return template.replace(/\{(name|slug|season|episode)\}/g, (_, key: string) => encodeURIComponent(values[key]!))
}
```

`shared/format.ts`:
```ts
import { DAY_LABELS } from './types'

/** "2023-08-23" → "23.08.2023" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function runningDayLabel(day: number | null): string {
  return day === null ? 'Not running' : (DAY_LABELS[day] ?? 'Unknown')
}
```

- [ ] **Step 6: Verify manually with a throwaway script (not committed)**

Node 22.18+ strips types natively. Save this to the scratchpad (not the repo) as `check-shared.ts`, then run `node <scratchpad>/check-shared.ts`:

```ts
import { groupSeries } from '/home/sebastian/code/series-planner/shared/sort.ts'
import { buildWatchUrl, BURNING_SERIES_PRESET, burningSeriesSlug } from '/home/sebastian/code/series-planner/shared/watch-url.ts'
import { episodeWatched, seasonFinished } from '/home/sebastian/code/series-planner/shared/series-actions.ts'
import { normaliseSeriesInput } from '/home/sebastian/code/series-planner/shared/series-schema.ts'
const s = (name: string, season: number, runningDay: number | null, startDate: string | null) => ({ id: name, name, season, episode: 3, runningDay, startDate })
console.log(JSON.stringify(groupSeries([s('Zeta', 2, null, null), s('Beta', 1, 3, null), s('Alpha', 1, 3, null), s('Mon', 1, 0, null), s('Soon', 0, null, '2026-10-01'), s('New', 0, null, null)]).map(g => [g.key, g.items.map(i => i.name)])))
console.log(burningSeriesSlug("Marvel's Agents of S.H.I.E.L.D."))
console.log(buildWatchUrl(BURNING_SERIES_PRESET, { name: "Marvel's Agents of S.H.I.E.L.D.", season: 8, episode: 0 }))
console.log(buildWatchUrl('https://x.test/?q={name}&e={episode}', { name: 'Dark & Grüße', season: 1, episode: 2 }))
console.log(JSON.stringify(episodeWatched(s('Soon', 0, null, '2026-10-01'))), JSON.stringify(seasonFinished(s('Run', 2, 4, null))), episodeWatched(s('P', 2, null, null)))
console.log(JSON.stringify(normaliseSeriesInput({ name: ' X ', season: 1, episode: 0, runningDay: 2, startDate: '2026-01-01' })))
try { normaliseSeriesInput({ name: '', season: -1, episode: 0, runningDay: 9, startDate: '2026-02-30' }) } catch (e: any) { console.log(e.issues.length, 'issues') }
```

Expected output, line by line:
```
[["running",["Mon","Alpha","Beta"]],["upcoming",["Soon"]],["notStarted",["New"]],["paused",["Zeta"]]]
Marvel-s-Agents-of-S-H-I-E-L-D
http://burningseries.ac/serie/Marvel-s-Agents-of-S-H-I-E-L-D/8
https://x.test/?q=Dark%20%26%20Gr%C3%BC%C3%9Fe&e=2
{"id":"Soon","name":"Soon","season":1,"episode":4,"runningDay":7,"startDate":null} {"id":"Run","name":"Run","season":3,"episode":0,"runningDay":null,"startDate":null} null
{"name":"X","season":1,"episode":0,"runningDay":2,"startDate":null}
4 issues
```

If the import of `zod` fails from the scratchpad, run the script from the project root instead (`cd` there and use a relative path) and delete it afterwards.

Run: `npx nuxt typecheck`. Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add shared
git commit -m "feat: add shared series domain logic (sort, actions, watch URL, schemas)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Mongo layer, document normalisation, health and config routes

**Files:**
- Create: `server/utils/mongo.ts`, `server/plugins/mongo.ts`, `server/utils/documents.ts`, `server/api/health.get.ts`, `server/api/config.get.ts`

**Interfaces:**
- Consumes: `Series`, `SeriesInput` from `#shared/types`.
- Produces (Nitro auto-imports everything exported from `server/utils`):
  - `startMongo(): Promise<void>`
  - `useDb(): Db` (throws a 503 H3Error when not connected)
  - `pingDb(): Promise<boolean>`
  - `seriesCollection(): Collection<SeriesDoc>`
  - `usersCollection(): Collection<UserDoc>`
  - `parseObjectId(id: string | undefined): ObjectId | null`
  - `interface SeriesDoc`, `interface UserDoc`
  - `toSeries(doc: SeriesDoc): Series`
  - `toSeriesDocFields(input: SeriesInput): Omit<SeriesDoc, '_id' | 'user'>`
  - `normaliseRunningDay(v: unknown): number | null`
  - `normaliseStartDate(v: unknown): string | null`

- [ ] **Step 1: Create `server/utils/mongo.ts`**

```ts
import { MongoClient, ObjectId, type Db } from 'mongodb'
import type { SeriesDoc, UserDoc } from './documents'

let db: Db | null = null

function mongoUrl(): string {
  const raw = process.env.DB
  if (!raw) throw new Error('DB environment variable is not set')
  return /^mongodb(\+srv)?:\/\//.test(raw) ? raw : `mongodb://${raw}`
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function ensureIndexes(database: Db) {
  await database.collection('Series').createIndex({ user: 1 })
  try {
    await database.collection('Users').createIndex({ name: 1 }, { unique: true })
  }
  catch (e) {
    console.warn('[mongo] could not create unique index on Users.name:', (e as Error).message)
  }
}

/** Connects with exponential backoff (1s → 30s), forever. The driver handles reconnects after the first success. */
export async function startMongo(): Promise<void> {
  let delay = 1000
  for (;;) {
    const client = new MongoClient(mongoUrl(), { serverSelectionTimeoutMS: 5000 })
    try {
      await client.connect()
      const database = client.db()
      await ensureIndexes(database)
      db = database
      console.info(`[mongo] connected to database "${database.databaseName}"`)
      return
    }
    catch (e) {
      await client.close().catch(() => {})
      console.error(`[mongo] connection failed (${(e as Error).message}); retrying in ${delay / 1000}s`)
      await sleep(delay)
      delay = Math.min(delay * 2, 30_000)
    }
  }
}

export function useDb(): Db {
  if (!db) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  return db
}

export async function pingDb(): Promise<boolean> {
  if (!db) return false
  try {
    await db.command({ ping: 1 })
    return true
  }
  catch {
    return false
  }
}

export const seriesCollection = () => useDb().collection<SeriesDoc>('Series')
export const usersCollection = () => useDb().collection<UserDoc>('Users')

export function parseObjectId(id: string | undefined): ObjectId | null {
  return id && /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null
}
```

- [ ] **Step 2: Create `server/plugins/mongo.ts`**

```ts
export default defineNitroPlugin(() => {
  void startMongo()
})
```

- [ ] **Step 3: Create `server/utils/documents.ts`**

```ts
import type { ObjectId } from 'mongodb'
import type { Series, SeriesInput } from '#shared/types'

/** Series as stored. Legacy data may have runningDay as a numeric string and startDate as a Date. */
export interface SeriesDoc {
  _id: ObjectId
  name: string
  season: number
  episode: number
  runningDay: number | string | null
  startDate: string | Date | null
  user: string
}

export interface UserDoc {
  _id: ObjectId
  name: string
  /** legacy unsalted sha256 hex — never modified */
  password?: string
  /** legacy, unused by any hash — never modified */
  salt?: string
  /** scrypt$N$r$p$saltB64$hashB64 */
  passwordHash?: string
  watchUrlTemplate?: string | null
}

export function normaliseRunningDay(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 7 ? n : null
}

export function normaliseStartDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const nonNegativeInt = (v: unknown) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

export function toSeries(doc: SeriesDoc): Series {
  return {
    id: doc._id.toHexString(),
    name: String(doc.name ?? ''),
    season: nonNegativeInt(doc.season),
    episode: nonNegativeInt(doc.episode),
    runningDay: normaliseRunningDay(doc.runningDay),
    startDate: normaliseStartDate(doc.startDate),
  }
}

/** The exact field shape the old app writes (startDate as midnight-UTC ISO string). */
export function toSeriesDocFields(input: SeriesInput): Omit<SeriesDoc, '_id' | 'user'> {
  return {
    name: input.name,
    season: input.season,
    episode: input.episode,
    runningDay: input.runningDay,
    startDate: input.startDate ? `${input.startDate}T00:00:00.000Z` : null,
  }
}
```

- [ ] **Step 4: Create `server/api/health.get.ts` and `server/api/config.get.ts`**

`server/api/health.get.ts`:
```ts
export default defineEventHandler(async (event) => {
  const up = await pingDb()
  setResponseStatus(event, up ? 200 : 503)
  return { status: up ? 'ok' : 'degraded', db: up ? 'up' : 'down', version: process.env.APP_VERSION || 'dev' }
})
```

`server/api/config.get.ts`:
```ts
export default defineEventHandler(() => ({
  allowSignup: process.env.ALLOW_SIGNUP === 'true',
}))
```

- [ ] **Step 5: Verify health and retry behaviour**

With the dev DB running: `npm run dev`, then `curl -s -w ' %{http_code}\n' localhost:3000/api/health`
Expected: `{"status":"ok","db":"up","version":"dev"} 200`, and the dev log shows `[mongo] connected to database "SeriesPlaner2"`.

Run `docker stop sp-dev-mongo`, restart `npm run dev`, and curl again.
Expected: `... "db":"down" ... 503`, and the log shows retry lines with growing delays; the server doesn't crash. Then run `docker start sp-dev-mongo`. Within 30 seconds the log shows `connected` and health returns 200.

Run: `curl -s localhost:3000/api/config` → `{"allowSignup":false}`

- [ ] **Step 6: Verify legacy normalisation against the real data (Review Focus 1)**

Temporarily add `server/api/_debug-series.get.ts` (do not commit):
```ts
export default defineEventHandler(async () => {
  const docs = await seriesCollection().find({}).toArray()
  return docs.map(toSeries).filter(s => ['Naruto Shippuden', 'Mozart in the Jungle', 'Infiltration Invasion 2021', '3'].includes(s.name))
})
```
Run: `curl -s localhost:3000/api/_debug-series`
Expected:
- 4 objects, with no errors.
- Naruto Shippuden has `"runningDay":7` (a number).
- Mozart in the Jungle has `"startDate":"2018-02-16"`.
- Infiltration Invasion 2021 has `"startDate":"2023-08-23"`.

Then **delete the file**.

Run: `npx nuxt typecheck` → exits 0.

- [ ] **Step 7: Commit**

```bash
git add server
git commit -m "feat: add Mongo connection with retry, legacy document normalisation, health route

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Authentication (legacy upgrade, rate limit, register, CLI)

**Files:**
- Create: `lib/password.mjs`, `lib/password.d.mts`, `shared/types/auth.d.ts`, `server/utils/password.ts`, `server/utils/rate-limit.ts`, `server/utils/require-user.ts`, `server/api/auth/login.post.ts`, `server/api/auth/register.post.ts`, `scripts/create-user.mjs`

**Interfaces:**
- Consumes: `usersCollection()`, `UserDoc`.
- Produces:
  - `lib/password.mjs`:
    - `hashPassword(pw): Promise<string>`
    - `verifyPasswordHash(hash, pw): Promise<boolean>`
    - `legacySha256Hex(pw): string`
    - `verifyLegacyPassword(storedHex, pw): boolean`
    - `randomLegacySalt(): string`
  - `server/utils/password.ts`: `checkUserPassword(user: UserDoc, pw): Promise<{ ok: boolean, upgradedHash?: string }>`
  - `server/utils/rate-limit.ts`:
    - `assertLoginAllowed(key: string): void` (throws 429)
    - `recordLoginFailure(key)`
    - `clearLoginFailures(key)`
  - `server/utils/require-user.ts`: `requireUser(event): Promise<{ id: string, name: string }>`, which also refreshes the session cookie
  - Session type: `useUserSession().user.value` is `{ id: string, name: string } | null`.

- [ ] **Step 1: Create `lib/password.mjs` and its type declaration**

`lib/password.mjs`:
```js
// Password hashing shared by the Nitro server and scripts/create-user.mjs. node:crypto only — no dependencies.
import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const N = 16384
const R = 8
const P = 1
const KEY_LENGTH = 64

/** @returns {Promise<string>} "scrypt$N$r$p$saltB64$hashB64" */
export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, KEY_LENGTH, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPasswordHash(hash, password) {
  const parts = String(hash).split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltB64, keyB64] = parts
  const expected = Buffer.from(keyB64, 'base64')
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** The old app's hash: CryptoJS.SHA256(password, salt) ignores the salt → plain sha256 hex. */
export function legacySha256Hex(password) {
  return createHash('sha256').update(password, 'utf8').digest('hex')
}

export function verifyLegacyPassword(storedHex, password) {
  const a = Buffer.from(legacySha256Hex(password))
  const b = Buffer.from(String(storedHex ?? ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Same alphabet/length as the old app's createSalt(). Only written by `create-user --legacy`. */
export function randomLegacySalt() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-;,:.#*+~'
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join('')
}
```

`lib/password.d.mts`:
```ts
export declare function hashPassword(password: string): Promise<string>
export declare function verifyPasswordHash(hash: string, password: string): Promise<boolean>
export declare function legacySha256Hex(password: string): string
export declare function verifyLegacyPassword(storedHex: string | undefined, password: string): boolean
export declare function randomLegacySalt(): string
```

- [ ] **Step 2: Type the session user**

`shared/types/auth.d.ts`:
```ts
declare module '#auth-utils' {
  interface User {
    id: string
    name: string
  }
}

export {}
```

- [ ] **Step 3: Create the server utilities**

`server/utils/password.ts`:
```ts
import { hashPassword, verifyLegacyPassword, verifyPasswordHash } from '~~/lib/password.mjs'
import type { UserDoc } from './documents'

/** Verifies against passwordHash, else the legacy sha256 field. On a legacy match, returns a new scrypt hash to store. */
export async function checkUserPassword(user: UserDoc, password: string): Promise<{ ok: boolean, upgradedHash?: string }> {
  if (user.passwordHash) return { ok: await verifyPasswordHash(user.passwordHash, password) }
  if (user.password && verifyLegacyPassword(user.password, password)) {
    return { ok: true, upgradedHash: await hashPassword(password) }
  }
  return { ok: false }
}
```

`server/utils/rate-limit.ts`:
```ts
const MAX_FAILURES = 10
const WINDOW_MS = 15 * 60 * 1000
const failures = new Map<string, { count: number, resetAt: number }>()

export function assertLoginAllowed(key: string): void {
  const entry = failures.get(key)
  if (!entry) return
  if (Date.now() > entry.resetAt) {
    failures.delete(key)
    return
  }
  if (entry.count >= MAX_FAILURES) {
    throw createError({ statusCode: 429, statusMessage: 'Too many failed attempts. Try again later.' })
  }
}

export function recordLoginFailure(key: string): void {
  const now = Date.now()
  const entry = failures.get(key)
  if (!entry || now > entry.resetAt) failures.set(key, { count: 1, resetAt: now + WINDOW_MS })
  else entry.count++
}

export function clearLoginFailures(key: string): void {
  failures.delete(key)
}
```

`server/utils/require-user.ts`:
```ts
import type { H3Event } from 'h3'

/** 401 without a session. Re-seals the cookie so the 30-day session slides with use. */
export async function requireUser(event: H3Event) {
  const { user } = await requireUserSession(event)
  await setUserSession(event, { user })
  return user
}
```

- [ ] **Step 4: Create the login and register routes**

`server/api/auth/login.post.ts`:
```ts
import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
})

export default defineEventHandler(async (event) => {
  const { name, password } = await readValidatedBody(event, bodySchema.parse)
  const key = `${getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'}|${name.toLowerCase()}`
  assertLoginAllowed(key)

  const user = await usersCollection().findOne({ name })
  const result = user ? await checkUserPassword(user, password) : { ok: false }
  if (!user || !result.ok) {
    recordLoginFailure(key)
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  }
  clearLoginFailures(key)

  if (result.upgradedHash) {
    await usersCollection().updateOne({ _id: user._id }, { $set: { passwordHash: result.upgradedHash } })
  }
  await setUserSession(event, { user: { id: user._id.toHexString(), name: user.name } })
  return { ok: true }
})
```

`server/api/auth/register.post.ts`:
```ts
import { z } from 'zod'
import { MongoServerError } from 'mongodb'
import { hashPassword } from '~~/lib/password.mjs'

const bodySchema = z.object({
  name: z.string().trim().min(1, 'Username is required').max(50, 'Username is too long'),
  password: z.string().min(8, 'Password must have at least 8 characters').max(200),
})

export default defineEventHandler(async (event) => {
  if (process.env.ALLOW_SIGNUP !== 'true') throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const { name, password } = await readValidatedBody(event, bodySchema.parse)

  if (await usersCollection().findOne({ name })) {
    throw createError({ statusCode: 409, statusMessage: 'Username is already taken' })
  }
  try {
    const { insertedId } = await usersCollection().insertOne({ name, passwordHash: await hashPassword(password) } as never)
    await setUserSession(event, { user: { id: insertedId.toHexString(), name } })
  }
  catch (e) {
    if (e instanceof MongoServerError && e.code === 11000) throw createError({ statusCode: 409, statusMessage: 'Username is already taken' })
    throw e
  }
  setResponseStatus(event, 201)
  return { ok: true }
})
```

- [ ] **Step 5: Create `scripts/create-user.mjs`**

In the Docker image, this file is copied to `.output/server/scripts/` and `lib/` to `.output/server/lib/`, so `mongodb` resolves from `.output/server/node_modules` (Task 12).

```js
#!/usr/bin/env node
// Usage: DB=... node scripts/create-user.mjs <name> [--legacy]
//   --legacy  also write the old app's sha256 `password` + `salt`, so the user can log into the OLD app too.
import { MongoClient } from 'mongodb'
import { createInterface } from 'node:readline'
import { hashPassword, legacySha256Hex, randomLegacySalt } from '../lib/password.mjs'

const args = process.argv.slice(2)
const legacy = args.includes('--legacy')
const name = args.find(a => !a.startsWith('--'))
if (!name) {
  console.error('Usage: node scripts/create-user.mjs <name> [--legacy]')
  process.exit(1)
}
if (!process.env.DB) {
  console.error('DB environment variable is not set')
  process.exit(1)
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s) }
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer) })
  })
}

const password = await promptHidden('Password: ')
const confirm = await promptHidden('Repeat password: ')
if (password !== confirm) { console.error('Passwords do not match'); process.exit(1) }
if (password.length < 8) { console.error('Password must have at least 8 characters'); process.exit(1) }

const url = /^mongodb(\+srv)?:\/\//.test(process.env.DB) ? process.env.DB : `mongodb://${process.env.DB}`
const client = new MongoClient(url)
try {
  await client.connect()
  const users = client.db().collection('Users')
  if (await users.findOne({ name })) { console.error(`User "${name}" already exists`); process.exit(1) }
  const doc = { name, passwordHash: await hashPassword(password) }
  if (legacy) Object.assign(doc, { password: legacySha256Hex(password), salt: randomLegacySalt() })
  await users.insertOne(doc)
  console.log(`Created user "${name}"${legacy ? ' (with legacy hash for the old app)' : ''}`)
}
finally {
  await client.close()
}
```

- [ ] **Step 6: Verify manually**

With the dev DB and `npm run dev` running:

1. Create a user through the CLI: `set -a; source .env; set +a; node scripts/create-user.mjs testuser --legacy`. Enter `testpass123` twice.
   Expected: `Created user "testuser" (with legacy hash for the old app)`.
2. Simulate an old-app user by removing the new hash:
   `docker exec sp-dev-mongo mongosh --quiet --eval 'db.getSiblingDB("SeriesPlaner2").Users.updateOne({name:"testuser"},{$unset:{passwordHash:1}})'`
3. Log in:
   `curl -s -c /tmp/sp.jar -w ' %{http_code}\n' -H 'content-type: application/json' -d '{"name":"testuser","password":"testpass123"}' localhost:3000/api/auth/login`
   Expected: `{"ok":true} 200`.
4. Check the upgrade:
   `docker exec sp-dev-mongo mongosh --quiet --eval 'const u=db.getSiblingDB("SeriesPlaner2").Users.findOne({name:"testuser"}); print(u.passwordHash.slice(0,13), u.password.length, u.salt.length)'`
   Expected: `scrypt$16384$ 64 10` (hash added; legacy fields untouched).
5. Log in again (this time through the scrypt path): same command as 3. Expected: `200`.
6. Wrong password or unknown user:
   `-d '{"name":"testuser","password":"nope"}'` and `-d '{"name":"nobody","password":"x"}'` → both return `401` with `"statusMessage":"Invalid username or password"`.
7. Rate limit: repeat the wrong-password request 10 times; the 11th returns `429`. Restart the dev server to reset the limit.
8. Registration is disabled: `curl -s -w ' %{http_code}\n' -H 'content-type: application/json' -d '{"name":"x","password":"12345678"}' localhost:3000/api/auth/register` → `404`.
   Set `ALLOW_SIGNUP=true` in `.env` and restart. The same request → `201`; repeating it → `409`. Set it back to `false` and delete the user `x` in mongosh.
9. The session endpoint returns no hash: `curl -s -b /tmp/sp.jar localhost:3000/api/_auth/session` → contains `"user":{"id":"…","name":"testuser"}` and no `password` field.

Run: `npx nuxt typecheck` → exits 0.

- [ ] **Step 7: Commit**

```bash
git add lib shared/types server scripts/create-user.mjs
git commit -m "feat: add session auth with transparent legacy hash upgrade, rate limit, closed signup and user CLI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Series API and live-sync events

**Files:**
- Create: `server/utils/series.ts`, `server/utils/series-events.ts`, `server/api/series/index.get.ts`, `server/api/series/index.post.ts`, `server/api/series/[id].put.ts`, `server/api/series/[id].delete.ts`, `server/api/series/[id]/episode-watched.post.ts`, `server/api/series/[id]/season-finished.post.ts`, `server/api/events.get.ts`

**Interfaces:**
- Consumes: `requireUser`, `seriesCollection`, `parseObjectId`, `toSeries`, `toSeriesDocFields`, `normaliseSeriesInput`, `compareSeries`, `episodeWatched`, `seasonFinished`.
- Produces:
  - HTTP endpoints:
    - `GET /api/series` → `Series[]` (sorted)
    - `POST /api/series` → `201 Series`
    - `PUT /api/series/:id` → `Series`
    - `DELETE /api/series/:id` → `204`
    - `POST /api/series/:id/episode-watched` → `Series`
    - `POST /api/series/:id/season-finished` → `Series`
    - `GET /api/events` (SSE; event name `series-changed`)
  - Server utilities:
    - `requireSeriesId(event): ObjectId`
    - `findOwnSeries(event, userName): Promise<SeriesDoc>`
    - `emitSeriesChanged(userName): void`
    - `addSeriesListener(userName, stream): () => void`

- [ ] **Step 1: Create `server/utils/series.ts`**

```ts
import type { H3Event } from 'h3'
import type { ObjectId } from 'mongodb'
import type { SeriesDoc } from './documents'

const notFound = () => createError({ statusCode: 404, statusMessage: 'Series not found' })

export function requireSeriesId(event: H3Event): ObjectId {
  const id = parseObjectId(getRouterParam(event, 'id'))
  if (!id) throw notFound()
  return id
}

/** Loads a series by route id, scoped to the user. 404 if missing or owned by someone else. */
export async function findOwnSeries(event: H3Event, userName: string): Promise<SeriesDoc> {
  const doc = await seriesCollection().findOne({ _id: requireSeriesId(event), user: userName })
  if (!doc) throw notFound()
  return doc
}
```

- [ ] **Step 2: Create `server/utils/series-events.ts`**

```ts
import type { createEventStream } from 'h3'

type Stream = ReturnType<typeof createEventStream>
const listeners = new Map<string, Set<Stream>>()

export function addSeriesListener(userName: string, stream: Stream): () => void {
  let set = listeners.get(userName)
  if (!set) listeners.set(userName, (set = new Set()))
  set.add(stream)
  return () => {
    set.delete(stream)
    if (set.size === 0) listeners.delete(userName)
  }
}

/** Notifies every open tab of this user. No listeners → no-op (the old app crashed here). */
export function emitSeriesChanged(userName: string): void {
  for (const stream of listeners.get(userName) ?? []) {
    stream.push({ event: 'series-changed', data: String(Date.now()) }).catch(() => {})
  }
}
```

- [ ] **Step 3: Create the list and create routes**

`server/api/series/index.get.ts`:
```ts
import { compareSeries } from '#shared/sort'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const docs = await seriesCollection().find({ user: user.name }).toArray()
  return docs.map(toSeries).sort(compareSeries)
})
```

`server/api/series/index.post.ts`:
```ts
import { normaliseSeriesInput } from '#shared/series-schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await readValidatedBody(event, normaliseSeriesInput)
  const fields = toSeriesDocFields(input)
  const { insertedId } = await seriesCollection().insertOne({ ...fields, user: user.name } as never)
  emitSeriesChanged(user.name)
  setResponseStatus(event, 201)
  return toSeries({ _id: insertedId, ...fields, user: user.name })
})
```

- [ ] **Step 4: Create the update and delete routes**

`server/api/series/[id].put.ts`:
```ts
import { normaliseSeriesInput } from '#shared/series-schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const _id = requireSeriesId(event)
  const input = await readValidatedBody(event, normaliseSeriesInput)
  const doc = await seriesCollection().findOneAndUpdate(
    { _id, user: user.name },
    { $set: toSeriesDocFields(input) },
    { returnDocument: 'after' },
  )
  if (!doc) throw createError({ statusCode: 404, statusMessage: 'Series not found' })
  emitSeriesChanged(user.name)
  return toSeries(doc)
})
```

`server/api/series/[id].delete.ts`:
```ts
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { deletedCount } = await seriesCollection().deleteOne({ _id: requireSeriesId(event), user: user.name })
  if (deletedCount === 0) throw createError({ statusCode: 404, statusMessage: 'Series not found' })
  emitSeriesChanged(user.name)
  setResponseStatus(event, 204)
  return null
})
```

- [ ] **Step 5: Create the action routes**

`server/api/series/[id]/episode-watched.post.ts`:
```ts
import { episodeWatched } from '#shared/series-actions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const doc = await findOwnSeries(event, user.name)
  const next = episodeWatched(toSeries(doc))
  if (!next) throw createError({ statusCode: 409, statusMessage: 'This series is not running and has no start date' })
  await seriesCollection().updateOne({ _id: doc._id, user: user.name }, { $set: toSeriesDocFields(next) })
  emitSeriesChanged(user.name)
  return next
})
```

`server/api/series/[id]/season-finished.post.ts`:
```ts
import { seasonFinished } from '#shared/series-actions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const doc = await findOwnSeries(event, user.name)
  const next = seasonFinished(toSeries(doc))
  if (!next) throw createError({ statusCode: 409, statusMessage: 'Only a running series can finish a season' })
  await seriesCollection().updateOne({ _id: doc._id, user: user.name }, { $set: toSeriesDocFields(next) })
  emitSeriesChanged(user.name)
  return next
})
```

`toSeriesDocFields(next)` receives a `Series`, which structurally satisfies `SeriesInput`; the extra `id` is not copied because the function picks fields explicitly.

- [ ] **Step 6: Create `server/api/events.get.ts`**

```ts
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const stream = createEventStream(event)
  const remove = addSeriesListener(user.name, stream)
  // keep-alive so proxies (Traefik) do not close idle connections
  const ping = setInterval(() => {
    stream.push({ event: 'ping', data: '' }).catch(() => {})
  }, 25_000)
  stream.onClosed(async () => {
    clearInterval(ping)
    remove()
    await stream.close()
  })
  return stream.send()
})
```

- [ ] **Step 7: Verify manually**

Log in as `testuser` first (Task 4, Step 6.3, which creates `/tmp/sp.jar`). Define `J='-s -b /tmp/sp.jar -c /tmp/sp.jar -H content-type:application/json -w \n%{http_code}\n'`.

1. Create: `curl $J -d '{"name":"Test Show","season":1,"episode":0,"runningDay":2,"startDate":"2026-01-01"}' localhost:3000/api/series`
   Expected: `201` and `"startDate":null`, because a running series has no start date. Note the `id`.
2. Stored shape: `docker exec sp-dev-mongo mongosh --quiet --eval 'printjson(db.getSiblingDB("SeriesPlaner2").Series.findOne({name:"Test Show"}))'`
   Expected: exactly `_id, name, season, episode, runningDay: 2, startDate: null, user: 'testuser'`.
3. Validation: `curl $J -d '{"name":"","season":-1,"episode":0,"runningDay":9,"startDate":null}' localhost:3000/api/series` → `400`.
4. Episode watched: `curl $J -X POST localhost:3000/api/series/<id>/episode-watched` → `200`, `"episode":1`.
5. Season finished: `curl $J -X POST localhost:3000/api/series/<id>/season-finished` → `"season":2,"episode":0,"runningDay":null`. Running it again → `409`.
6. Upcoming → Open End: `curl $J -X PUT -d '{"name":"Test Show","season":0,"episode":0,"runningDay":null,"startDate":"2026-10-01"}' localhost:3000/api/series/<id>`. Mongo shows `startDate: '2026-10-01T00:00:00.000Z'`. Then call episode-watched → `"runningDay":7,"season":1,"episode":1,"startDate":null`.
7. Isolation: find the `_id` of a series belonging to a real user (`mongosh … Series.findOne({user:{$ne:"testuser"}})._id`).
   - `curl $J -X PUT -d '{"name":"hacked","season":0,"episode":0,"runningDay":null,"startDate":null}' localhost:3000/api/series/<foreignId>` → `404`
   - `DELETE` on the same id → `404`
   - invalid id `localhost:3000/api/series/abc` with DELETE → `404`
   - check the foreign series is unchanged
8. List: `curl $J localhost:3000/api/series` → only `testuser`'s series.
9. No session: `curl -s -w '%{http_code}\n' localhost:3000/api/series` → `401`.
10. SSE: in terminal A, run `curl -N -b /tmp/sp.jar localhost:3000/api/events`. In terminal B, repeat an episode-watched call on a running series.
    Expected: terminal A prints `event: series-changed` and a `data:` line. After 25 seconds it prints `event: ping`.
11. Delete: `curl $J -X DELETE localhost:3000/api/series/<id>` → `204`.

Run: `npx nuxt typecheck` → exits 0.

- [ ] **Step 8: Commit**

```bash
git add server
git commit -m "feat: add user-scoped series API with server-side actions and SSE live sync

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Settings API

**Files:**
- Create: `server/api/settings.get.ts`, `server/api/settings.put.ts`

**Interfaces:**
- Consumes: `requireUser`, `usersCollection`, `parseSettings`.
- Produces: `GET /api/settings` → `Settings`; `PUT /api/settings` (body `Settings`) → `Settings`.

- [ ] **Step 1: Create both routes**

`server/api/settings.get.ts`:
```ts
import { ObjectId } from 'mongodb'
import type { Settings } from '#shared/types'

export default defineEventHandler(async (event): Promise<Settings> => {
  const user = await requireUser(event)
  const doc = await usersCollection().findOne({ _id: new ObjectId(user.id) }, { projection: { watchUrlTemplate: 1 } })
  return { watchUrlTemplate: doc?.watchUrlTemplate ?? null }
})
```

`server/api/settings.put.ts`:
```ts
import { ObjectId } from 'mongodb'
import { parseSettings } from '#shared/settings-schema'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const settings = await readValidatedBody(event, parseSettings)
  await usersCollection().updateOne({ _id: new ObjectId(user.id) }, { $set: { watchUrlTemplate: settings.watchUrlTemplate } })
  return settings
})
```

- [ ] **Step 2: Verify manually** (logged in as testuser, with `$J` from Task 5)

1. `curl $J localhost:3000/api/settings` → `{"watchUrlTemplate":null}`
2. `curl $J -X PUT -d '{"watchUrlTemplate":"https://example.com/{slug}/{season}"}' localhost:3000/api/settings` → `200` and the template echoed back.
3. `-d '{"watchUrlTemplate":"javascript:alert(1)"}'` → `400`.
4. `-d '{"watchUrlTemplate":"   "}'` → `{"watchUrlTemplate":null}`.
5. Mongo: `Users.findOne({name:"testuser"})` shows `watchUrlTemplate`, and `password` and `salt` are unchanged.

Run: `npx nuxt typecheck` → exits 0.

- [ ] **Step 3: Commit**

```bash
git add server/api/settings.get.ts server/api/settings.put.ts
git commit -m "feat: add per-user settings API for the watch URL template

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: App shell — layouts, auth middleware, login page, PWA assets

**Files:**
- Create: `app/layouts/default.vue`, `app/layouts/auth.vue`, `app/middleware/auth.global.ts`, `app/pages/login.vue`, `app/composables/useApiError.ts`, `app/composables/useSeriesForm.ts`, `public/manifest.webmanifest`, `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `public/apple-touch-icon.png`, `public/favicon.ico`
- Modify: `app/pages/index.vue` (stays a placeholder until Task 8)

**Interfaces:**
- Consumes: `GET /api/config`, `POST /api/auth/login`, `POST /api/auth/register`, `useUserSession()` (nuxt-auth-utils: `loggedIn`, `user`, `fetch`, `clear`).
- Produces:
  - `useApiError(): { toastError(e: unknown, title?: string): void, messageOf(e: unknown): string }`. On a 401 it clears the session and navigates to `/login` (Review Focus 3).
  - `useSeriesForm(): { state: Ref<{ open: boolean, series: Series | null, key: number }>, openCreate(): void, openEdit(s: Series): void, close(): void }`
  - The `default` layout mounts `<SeriesFormOverlay />`, which is created in Task 9. Until then, leave that line commented out with `<!-- Task 9 -->`.

- [ ] **Step 1: Create `app/composables/useApiError.ts`**

```ts
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
      toast.add({ title: 'Session expired', description: 'Please log in again.', color: 'warning', icon: 'i-lucide-log-in' })
      void clear().then(() => navigateTo('/login'))
      return
    }
    toast.add({ title, description: messageOf(e), color: 'error', icon: 'i-lucide-circle-alert' })
  }

  return { toastError, messageOf }
}
```

- [ ] **Step 2: Create `app/composables/useSeriesForm.ts`**

```ts
import type { Series } from '#shared/types'

export function useSeriesForm() {
  const state = useState('series-form', () => ({ open: false, series: null as Series | null, key: 0 }))
  return {
    state,
    openCreate: () => { state.value = { open: true, series: null, key: state.value.key + 1 } },
    openEdit: (series: Series) => { state.value = { open: true, series: { ...series }, key: state.value.key + 1 } },
    close: () => { state.value.open = false },
  }
}
```

- [ ] **Step 3: Create the middleware and layouts**

`app/middleware/auth.global.ts`:
```ts
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value && to.path !== '/login') return navigateTo('/login')
  if (loggedIn.value && to.path === '/login') return navigateTo('/')
})
```

`app/layouts/auth.vue`:
```vue
<template>
  <main class="flex min-h-dvh items-center justify-center bg-muted px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
    <slot />
  </main>
</template>
```

`app/layouts/default.vue`:
```vue
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
    { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
    {
      label: colorMode.value === 'dark' ? 'Light mode' : 'Dark mode',
      icon: colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon',
      class: 'sm:hidden',
      onSelect: () => { colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark' },
    },
  ],
  [{ label: 'Logout', icon: 'i-lucide-log-out', onSelect: logout }],
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
    <!-- Task 9: <SeriesFormOverlay /> -->
  </div>
</template>
```

- [ ] **Step 4: Create `app/pages/login.vue`**

```vue
<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })

const { fetch: refreshSession } = useUserSession()
const { toastError } = useApiError()
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
    await navigateTo('/')
  }
  catch (e) {
    toastError(e, mode.value === 'login' ? 'Login failed' : 'Could not create account')
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
        :label="mode === 'login' ? 'No account yet? Create one' : 'Already have an account? Log in'"
        @click="mode = mode === 'login' ? 'register' : 'login'"
      />
    </template>
  </UCard>
</template>
```

- [ ] **Step 5: Create the PWA assets**

`public/icon.svg` (a TV glyph on an indigo rounded square):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#4f46e5"/>
  <g fill="none" stroke="#fff" stroke-width="28" stroke-linecap="round" stroke-linejoin="round">
    <rect x="96" y="160" width="320" height="224" rx="32"/>
    <path d="M192 96l64 64 64-64"/>
  </g>
</svg>
```

Generate the PNGs from it in the scratchpad (sharp is not a project dependency):
```bash
S=/tmp/claude-1000/-home-sebastian-code-series-planner/88f4eb1b-6db9-497f-b859-65155f1ed142/scratchpad/icons
mkdir -p $S && cd $S && npm init -y >/dev/null && npm i --silent sharp
node -e '
const sharp = require("sharp"); const src = "/home/sebastian/code/series-planner/public/icon.svg"; const out = "/home/sebastian/code/series-planner/public/";
(async () => {
  await sharp(src).resize(192).png().toFile(out + "icon-192.png");
  await sharp(src).resize(512).png().toFile(out + "icon-512.png");
  await sharp(src).resize(180).png().toFile(out + "apple-touch-icon.png");
  // maskable: full-bleed background, glyph inside the 80% safe zone
  const glyph = await sharp(src).resize(360).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: "#4f46e5" } }).composite([{ input: glyph, gravity: "centre" }]).png().toFile(out + "icon-maskable-512.png");
})()'
cd /home/sebastian/code/series-planner && cp OLD/app/public/favicon.ico public/favicon.ico
```

`public/manifest.webmanifest`:
```json
{
  "name": "Series Planner",
  "short_name": "Series",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#18181b",
  "theme_color": "#4f46e5",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 6: Verify manually in the browser**

Use the Playwright MCP or a normal browser.

1. Open `localhost:3000/` while logged out → redirected to `/login`. The centered card shows no "Create account" link.
2. Wrong password → a red toast "Login failed — Invalid username or password".
3. Log in as `testuser` / `testpass123` → lands on `/` with the header visible. The account menu shows the name, Settings and Logout. Logout → back on `/login`.
4. While logged in, visiting `/login` redirects to `/`.
5. With `ALLOW_SIGNUP=true` (restart the dev server), the "Create account" link shows. Registering with mismatched passwords shows an inline error on "Repeat password". Revert to `false` afterwards.
6. At 375×812 (Playwright `browser_resize`): the header shows title plus account menu only, the round "+" FAB sits in the bottom-right corner, and the account menu contains "Dark mode". Toggling it switches the theme and updates the `theme-color` meta tag (check it in the DOM snapshot).
7. `curl -s localhost:3000/manifest.webmanifest` returns the JSON, and `/icon-192.png` returns 200.

Run: `npx nuxt typecheck` → exits 0.

- [ ] **Step 7: Commit**

```bash
git add app public
git commit -m "feat: add app shell with auth middleware, login page, responsive header and PWA assets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Series list page with live sync

**Files:**
- Create: `app/composables/useSeries.ts`, `app/composables/useSettings.ts`, `app/plugins/series-live.client.ts`, `app/components/SeriesStatusBadge.vue`, `app/components/SeriesRow.vue`
- Modify: `app/pages/index.vue` (replace the placeholder)

**Interfaces:**
- Consumes:
  - `useApiError`
  - `groupSeries`, `canWatchEpisode`, `episodeWatched`, `buildWatchUrl`, `formatDate`, `runningDayLabel`, `DAY_LABELS`
  - the API from Tasks 5 and 6
- Produces:
  - `useSeries(): { series: Ref<Series[]>, status, refresh }` (`useFetch` key `'series'`)
  - `useSeriesApi()`, which returns:
    - `create(input: SeriesInput): Promise<Series | undefined>`
    - `update(id: string, input: SeriesInput): Promise<Series | undefined>`
    - `remove(id: string): Promise<boolean>`
    - `watchEpisode(id: string): Promise<void>` (optimistic)
    - `finishSeason(id: string): Promise<void>`
  - `useSettings(): { settings: Ref<Settings>, refresh }` (key `'settings'`)
  - `<SeriesStatusBadge :series>` and `<SeriesRow :series :watch-template :highlight>`

- [ ] **Step 1: Create `app/composables/useSeries.ts` and `useSettings.ts`**

`app/composables/useSeries.ts`:
```ts
import type { Series, SeriesInput } from '#shared/types'
import { episodeWatched } from '#shared/series-actions'

export function useSeries() {
  const { data, status, refresh } = useFetch<Series[]>('/api/series', { key: 'series', default: () => [] })
  return { series: data, status, refresh }
}

/** Mutations. Call in setup. Every mutation refreshes the list; errors become toasts (401 → login). */
export function useSeriesApi() {
  const { toastError } = useApiError()
  const toast = useToast()
  const { data: cached } = useNuxtData<Series[]>('series')
  const refreshList = () => refreshNuxtData('series')

  async function run<T>(request: () => Promise<T>, errorTitle: string): Promise<T | undefined> {
    try {
      return await request()
    }
    catch (e) {
      toastError(e, errorTitle)
      return undefined
    }
    finally {
      await refreshList()
    }
  }

  return {
    create: async (input: SeriesInput) => {
      const created = await run(() => $fetch<Series>('/api/series', { method: 'POST', body: input }), 'Could not add series')
      if (created) toast.add({ title: `Added "${created.name}"`, color: 'success', icon: 'i-lucide-check' })
      return created
    },
    update: (id: string, input: SeriesInput) =>
      run(() => $fetch<Series>(`/api/series/${id}`, { method: 'PUT', body: input }), 'Could not save series'),
    remove: async (id: string) =>
      (await run(() => $fetch(`/api/series/${id}`, { method: 'DELETE' }).then(() => true), 'Could not delete series')) ?? false,
    watchEpisode: async (id: string) => {
      const previous = cached.value
      if (previous) cached.value = previous.map(s => (s.id === id ? (episodeWatched(s) ?? s) : s))
      const ok = await run(() => $fetch(`/api/series/${id}/episode-watched`, { method: 'POST' }).then(() => true), 'Could not mark episode')
      if (!ok && previous) cached.value = previous
    },
    finishSeason: async (id: string) => {
      await run(() => $fetch(`/api/series/${id}/season-finished`, { method: 'POST' }), 'Could not finish season')
    },
  }
}
```

`app/composables/useSettings.ts`:
```ts
import type { Settings } from '#shared/types'

export function useSettings() {
  const { data, refresh } = useFetch<Settings>('/api/settings', { key: 'settings', default: () => ({ watchUrlTemplate: null }) })
  return { settings: data, refresh }
}
```

- [ ] **Step 2: Create `app/plugins/series-live.client.ts`**

```ts
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
```

- [ ] **Step 3: Create `app/components/SeriesStatusBadge.vue`**

```vue
<script setup lang="ts">
import type { Series } from '#shared/types'
import { groupOf } from '#shared/sort'
import { formatDate, runningDayLabel } from '#shared/format'

const props = defineProps<{ series: Series }>()
const badge = computed(() => {
  switch (groupOf(props.series)) {
    case 'running': return { label: runningDayLabel(props.series.runningDay), color: 'success' as const, icon: 'i-lucide-play' }
    case 'upcoming': return { label: formatDate(props.series.startDate!), color: 'info' as const, icon: 'i-lucide-calendar' }
    case 'notStarted': return { label: 'Not started', color: 'neutral' as const, icon: 'i-lucide-circle-dashed' }
    default: return { label: 'Paused', color: 'warning' as const, icon: 'i-lucide-pause' }
  }
})
</script>

<template>
  <UBadge :label="badge.label" :color="badge.color" :icon="badge.icon" variant="subtle" />
</template>
```

- [ ] **Step 4: Create `app/components/SeriesRow.vue`**

This uses VueUse's `useSwipe`. On mobile, a left swipe reveals a labeled action tray. The icon buttons are always visible, so swiping is only a convenience.

```vue
<script setup lang="ts">
import { useSwipe } from '@vueuse/core'
import type { Series } from '#shared/types'
import { canWatchEpisode } from '#shared/series-actions'
import { buildWatchUrl } from '#shared/watch-url'

const props = defineProps<{ series: Series, watchTemplate: string | null, highlight?: boolean }>()
const api = useSeriesApi()

const watchUrl = computed(() => (props.watchTemplate ? buildWatchUrl(props.watchTemplate, props.series) : null))
const canPlusOne = computed(() => canWatchEpisode(props.series))

const rowEl = ref<HTMLElement | null>(null)
const revealed = ref(false)
useSwipe(rowEl, {
  passive: true,
  onSwipeEnd: (_e, direction) => {
    if (direction === 'left') revealed.value = true
    else if (direction === 'right') revealed.value = false
  },
})

function onRowClick(e: MouseEvent) {
  if (revealed.value) {
    e.preventDefault()
    revealed.value = false
  }
}
</script>

<template>
  <li
    :id="`s-${series.id}`"
    ref="rowEl"
    class="relative overflow-hidden rounded-lg border border-default transition-shadow"
    :class="highlight && 'ring-2 ring-primary'"
  >
    <!-- mobile swipe tray -->
    <div class="absolute inset-y-0 right-0 flex sm:hidden" aria-hidden="true">
      <button
        v-if="canPlusOne"
        type="button"
        tabindex="-1"
        class="flex w-24 flex-col items-center justify-center gap-1 bg-primary text-xs font-medium text-inverted"
        @click="api.watchEpisode(series.id); revealed = false"
      >
        <UIcon name="i-lucide-plus" class="size-5" /> Episode
      </button>
      <a
        v-if="watchUrl"
        :href="watchUrl"
        target="_blank"
        rel="noopener"
        tabindex="-1"
        class="flex w-24 flex-col items-center justify-center gap-1 bg-info text-xs font-medium text-inverted"
        @click="revealed = false"
      >
        <UIcon name="i-lucide-play" class="size-5" /> Watch
      </a>
    </div>

    <div
      class="relative flex items-center gap-2 bg-default p-2 pl-3 transition-transform duration-200"
      :style="revealed ? { transform: `translateX(-${(canPlusOne ? 96 : 0) + (watchUrl ? 96 : 0)}px)` } : undefined"
    >
      <NuxtLink :to="`/series/${series.id}`" class="flex min-h-11 min-w-0 flex-1 flex-col justify-center" @click="onRowClick">
        <span class="truncate font-medium">{{ series.name }}</span>
        <span class="flex flex-wrap items-center gap-2 text-sm text-muted">
          S{{ series.season }} · E{{ series.episode }}
          <SeriesStatusBadge :series="series" />
        </span>
      </NuxtLink>
      <UButton
        v-if="canPlusOne"
        icon="i-lucide-plus"
        color="primary"
        variant="soft"
        class="min-h-11 min-w-11 justify-center"
        :aria-label="`Mark next episode of ${series.name} as watched`"
        @click="api.watchEpisode(series.id)"
      />
      <UButton
        v-if="watchUrl"
        icon="i-lucide-play"
        color="neutral"
        variant="soft"
        :to="watchUrl"
        target="_blank"
        class="min-h-11 min-w-11 justify-center"
        :aria-label="`Watch ${series.name}`"
      />
      <UIcon name="i-lucide-chevron-right" class="hidden size-5 shrink-0 text-dimmed sm:block" />
    </div>
  </li>
</template>
```

- [ ] **Step 5: Replace `app/pages/index.vue`**

```vue
<script setup lang="ts">
import { groupSeries } from '#shared/sort'

const route = useRoute()
const { series, status } = useSeries()
const { settings } = useSettings()
const { openCreate } = useSeriesForm()

const search = ref('')
const searchInput = useTemplateRef('searchInput')
defineShortcuts({ '/': () => searchInput.value?.inputRef?.focus() })

const groups = computed(() => {
  const q = search.value.trim().toLowerCase()
  return groupSeries(q ? series.value.filter(s => s.name.toLowerCase().includes(q)) : series.value)
})

// "Back" from the detail page lands here with ?focus=<id>: scroll to it and flash a ring
const highlightId = ref<string | null>(null)
watch([() => route.query.focus, () => series.value.length], async ([focus]) => {
  if (typeof focus !== 'string' || !series.value.length) return
  await nextTick()
  document.getElementById(`s-${focus}`)?.scrollIntoView({ block: 'center' })
  highlightId.value = focus
  setTimeout(() => { highlightId.value = null }, 1600)
  await navigateTo({ query: {} }, { replace: true })
}, { immediate: true })
</script>

<template>
  <div class="space-y-6">
    <UInput
      ref="searchInput"
      v-model="search"
      icon="i-lucide-search"
      placeholder="Search series…"
      size="xl"
      class="w-full"
      :ui="{ trailing: 'pe-1' }"
    >
      <template #trailing>
        <UButton v-if="search" color="neutral" variant="link" icon="i-lucide-x" aria-label="Clear search" @click="search = ''" />
        <UKbd v-else value="/" class="hidden sm:inline-flex" />
      </template>
    </UInput>

    <div v-if="status === 'pending' && !series.length" class="space-y-2">
      <USkeleton v-for="i in 6" :key="i" class="h-16 w-full" />
    </div>

    <UEmpty
      v-else-if="!series.length"
      icon="i-lucide-tv"
      title="No series yet"
      description="Add the first series you want to keep track of."
      :actions="[{ label: 'Add series', icon: 'i-lucide-plus', onClick: () => openCreate() }]"
    />

    <p v-else-if="!groups.length" class="py-8 text-center text-muted">No series match “{{ search }}”.</p>

    <section v-for="group in groups" :key="group.key" class="space-y-2">
      <h2 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
        {{ group.label }} <UBadge :label="group.items.length" color="neutral" variant="subtle" size="sm" />
      </h2>
      <ul class="space-y-2">
        <SeriesRow
          v-for="s in group.items"
          :key="s.id"
          :series="s"
          :watch-template="settings.watchUrlTemplate"
          :highlight="highlightId === s.id"
        />
      </ul>
    </section>
  </div>
</template>
```

- [ ] **Step 6: Verify the list against real data**

Log in as a **real** user. Local only: if you don't know a password, set a temporary one for the **dev copy**, for example with `docker exec sp-dev-mongo mongosh --quiet --eval 'db.getSiblingDB("SeriesPlaner2").Users.updateOne({name:"<realName>"},{$set:{password:"'"$(printf 'devpass123' | sha256sum | cut -d' ' -f1)"'"},$unset:{passwordHash:1}})'`. This is the throwaway copy, never production.

1. Sections show in order: Running (weekday badges Mon…Sun, then Open End), Upcoming (dates `DD.MM.YYYY`), Not started, Paused. Each section header shows its count.
2. Naruto Shippuden shows "Open End" (the legacy `"7"` string).
3. Searching `shield` finds "Marvel's Agents of S.H.I.E.L.D." (case-insensitive). The `/` key focuses the search box. The ✕ button clears it.
4. "+" on a running series increments the episode instantly (optimistic), and the count stays after a reload.
5. With no watch template (default), no ▶ buttons are visible.

- [ ] **Step 7: Verify live sync and mobile**

1. Open two tabs as the same user. Click "+" in tab A; tab B updates within about 1 second, without being focused.
2. Run `curl`'s episode-watched call as that user (with its session cookie), then switch to the tab. It updates on focus.
3. At 375px: rows show name, "S·E", badge, "+" and no chevron. A left swipe on a row (Playwright `browser_drag` from right to left, or a real phone) reveals the "Episode" tray; a right swipe or tap closes it.

- [ ] **Step 8: Verify session expiry (Review Focus 3)**

With the list open, open `/api/_auth/session` in another tab through DevTools and `fetch('/api/_auth/session',{method:'DELETE'})` (or delete the `nuxt-session` cookie). Back in the first tab, click "+".
Expected: one "Session expired" toast, then a redirect to `/login`. There are no further error toasts.

Run: `npx nuxt typecheck` → exits 0.

- [ ] **Step 9: Commit**

```bash
git add app
git commit -m "feat: add grouped series list with search, quick actions, swipe tray and live sync

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Add/Edit series form (modal on desktop, bottom sheet on mobile)

**Files:**
- Create: `app/components/SeriesForm.vue`, `app/components/SeriesFormOverlay.vue`
- Modify: `app/layouts/default.vue` (uncomment/insert `<SeriesFormOverlay />`)

**Interfaces:**
- Consumes: `useSeriesForm()`, `useSeriesApi().create/update`, `seriesInputSchema`, `DAY_LABELS`, `formatDate`.
- Produces: `<SeriesForm :series="Series | null" @saved @cancel>` and `<SeriesFormOverlay />` (mounted once in the default layout).

- [ ] **Step 1: Create `app/components/SeriesForm.vue`**

```vue
<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { parseDate, type DateValue } from '@internationalized/date'
import { DAY_LABELS, type Series, type SeriesInput } from '#shared/types'
import { seriesInputSchema } from '#shared/series-schema'
import { formatDate } from '#shared/format'

const props = defineProps<{ series: Series | null }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()
const api = useSeriesApi()

const state = reactive<SeriesInput>({
  name: props.series?.name ?? '',
  season: props.series?.season ?? 0,
  episode: props.series?.episode ?? 0,
  runningDay: props.series?.runningDay ?? null,
  startDate: props.series?.startDate ?? null,
})

// Reka's Select cannot hold null values → map to string keys
const dayItems = [{ label: 'Not running', value: 'none' }, ...DAY_LABELS.map((label, i) => ({ label, value: String(i) }))]
const runningDayKey = computed({
  get: () => (state.runningDay === null ? 'none' : String(state.runningDay)),
  set: (v: string) => {
    state.runningDay = v === 'none' ? null : Number(v)
    if (state.runningDay !== null) state.startDate = null
  },
})

const datePickerOpen = ref(false)
const calendarValue = computed({
  get: () => (state.startDate ? parseDate(state.startDate) : undefined),
  set: (v: DateValue | undefined) => {
    state.startDate = v ? v.toString() : null
    datePickerOpen.value = false
  },
})

const saving = ref(false)
async function onSubmit(event: FormSubmitEvent<SeriesInput>) {
  saving.value = true
  const result = props.series ? await api.update(props.series.id, event.data) : await api.create(event.data)
  saving.value = false
  if (result) emit('saved')
}
</script>

<template>
  <UForm :schema="seriesInputSchema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField label="Name" name="name" required>
      <UInput v-model="state.name" size="xl" class="w-full" autofocus />
    </UFormField>

    <div class="grid grid-cols-2 gap-3">
      <UFormField label="Season" name="season">
        <UInputNumber v-model="state.season" :min="0" size="xl" class="w-full" />
      </UFormField>
      <UFormField label="Episode" name="episode">
        <UInputNumber v-model="state.episode" :min="0" size="xl" class="w-full" />
      </UFormField>
    </div>

    <UFormField label="Running day" name="runningDay">
      <USelect v-model="runningDayKey" :items="dayItems" size="xl" class="w-full" />
    </UFormField>

    <UFormField label="Start date" name="startDate" :help="state.runningDay !== null ? 'Only for series that are not running yet' : undefined">
      <div class="flex gap-2">
        <UPopover v-model:open="datePickerOpen" :content="{ align: 'start' }">
          <UButton
            color="neutral"
            variant="outline"
            size="xl"
            icon="i-lucide-calendar"
            class="flex-1"
            :disabled="state.runningDay !== null"
            :label="state.startDate ? formatDate(state.startDate) : 'Pick a date'"
          />
          <template #content>
            <UCalendar v-model="calendarValue" class="p-2" />
          </template>
        </UPopover>
        <UButton
          v-if="state.startDate"
          color="neutral"
          variant="ghost"
          size="xl"
          icon="i-lucide-x"
          aria-label="Clear start date"
          @click="state.startDate = null"
        />
      </div>
    </UFormField>

    <div class="flex justify-end gap-2 pt-2">
      <UButton color="neutral" variant="ghost" size="xl" label="Cancel" @click="emit('cancel')" />
      <UButton type="submit" size="xl" :loading="saving" :label="series ? 'Save' : 'Add series'" />
    </div>
  </UForm>
</template>
```

- [ ] **Step 2: Create `app/components/SeriesFormOverlay.vue`**

```vue
<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

const { state, close } = useSeriesForm()
const isDesktop = useMediaQuery('(min-width: 640px)')
const title = computed(() => (state.value.series ? 'Edit series' : 'Add series'))
const open = computed({ get: () => state.value.open, set: (v: boolean) => { state.value.open = v } })
</script>

<template>
  <UModal v-if="isDesktop" v-model:open="open" :title="title">
    <template #body>
      <SeriesForm :key="state.key" :series="state.series" @saved="close" @cancel="close" />
    </template>
  </UModal>
  <UDrawer v-else v-model:open="open" :title="title" :ui="{ content: 'max-h-[95dvh]', body: 'pb-[calc(1rem+env(safe-area-inset-bottom))]' }">
    <template #body>
      <SeriesForm :key="state.key" :series="state.series" @saved="close" @cancel="close" />
    </template>
  </UDrawer>
</template>
```

- [ ] **Step 3: Mount it in the layout**

In `app/layouts/default.vue`, replace `<!-- Task 9: <SeriesFormOverlay /> -->` with `<SeriesFormOverlay />`.

- [ ] **Step 4: Verify on desktop**

1. "Add series" opens a modal titled "Add series". Submitting with an empty name shows "Name is required" inline.
2. Add "Plan Test" with season 0, episode 0, not running, start date = today+7 (via calendar). A success toast appears, the modal closes, and "Plan Test" appears under Upcoming with the correct `DD.MM.YYYY` date.
3. Mongo: the doc has `startDate: '<date>T00:00:00.000Z'`, `runningDay: null`, `season: 0`. The date is **not** shifted by a day (timezone check).
4. Choosing "Wednesday" as the running day clears the date and disables the date button, which shows the help text.
5. Esc or Cancel closes without saving.

- [ ] **Step 5: Verify on mobile at 375×812 (Review Focus 5)**

1. The FAB opens a bottom sheet (drawer), not a centered modal.
2. The number inputs' +/- buttons work. Typing in Name raises the on-screen keyboard on a real device, and the sheet can scroll so "Add series" stays reachable.
3. The calendar popover opens inside the drawer, and picking a date closes it.
4. Save closes the drawer and the list updates.

Run: `npx nuxt typecheck` → exits 0.

- [ ] **Step 6: Commit**

```bash
git add app
git commit -m "feat: add series add/edit form as modal on desktop and bottom sheet on mobile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Series detail page

**Files:**
- Create: `app/pages/series/[id].vue`

**Interfaces:**
- Consumes:
  - `useSeries`, `useSettings`, `useSeriesApi` (`watchEpisode`, `finishSeason`, `remove`), `useSeriesForm().openEdit`
  - `canWatchEpisode`, `canFinishSeason`, `buildWatchUrl`, `formatDate`, `runningDayLabel`, `isRunning`
- Produces: the `/series/:id` route.

- [ ] **Step 1: Create `app/pages/series/[id].vue`**

```vue
<script setup lang="ts">
import { isRunning } from '#shared/types'
import { canFinishSeason, canWatchEpisode } from '#shared/series-actions'
import { buildWatchUrl } from '#shared/watch-url'
import { formatDate, runningDayLabel } from '#shared/format'

const route = useRoute()
const id = computed(() => String(route.params.id))
const { series, status } = useSeries()
const { settings } = useSettings()
const api = useSeriesApi()
const { openEdit } = useSeriesForm()

const item = computed(() => series.value.find(s => s.id === id.value) ?? null)
const watchUrl = computed(() => (item.value && settings.value.watchUrlTemplate ? buildWatchUrl(settings.value.watchUrlTemplate, item.value) : null))
useHead({ title: computed(() => (item.value ? `${item.value.name} · Series Planner` : 'Series Planner')) })

const back = () => navigateTo({ path: '/', query: { focus: id.value } })

const confirmDelete = ref(false)
const deleting = ref(false)
async function doDelete() {
  deleting.value = true
  const ok = await api.remove(id.value)
  deleting.value = false
  confirmDelete.value = false
  if (ok) await navigateTo('/')
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-6">
    <UButton color="neutral" variant="ghost" icon="i-lucide-arrow-left" label="Back" class="-ml-2 min-h-11" @click="back" />

    <USkeleton v-if="status === 'pending' && !item" class="h-64 w-full" />

    <UEmpty
      v-else-if="!item"
      icon="i-lucide-search-x"
      title="Series not found"
      description="It may have been deleted."
      :actions="[{ label: 'Back to list', icon: 'i-lucide-arrow-left', to: '/' }]"
    />

    <template v-else>
      <div class="space-y-3">
        <h1 class="text-2xl font-bold break-words">{{ item.name }}</h1>
        <SeriesStatusBadge :series="item" />
      </div>

      <UCard>
        <dl class="grid grid-cols-2 gap-4">
          <div>
            <dt class="text-sm text-muted">Season</dt>
            <dd class="text-2xl font-semibold">{{ item.season }}</dd>
          </div>
          <div>
            <dt class="text-sm text-muted">Episode</dt>
            <dd class="text-2xl font-semibold">{{ item.episode }}</dd>
          </div>
          <div class="col-span-2">
            <dt class="text-sm text-muted">{{ isRunning(item) ? 'Running day' : 'Start date' }}</dt>
            <dd class="font-medium">
              <template v-if="isRunning(item)">{{ runningDayLabel(item.runningDay) }}</template>
              <template v-else-if="item.startDate">Starts on {{ formatDate(item.startDate) }}</template>
              <template v-else>Not currently running</template>
            </dd>
          </div>
        </dl>
      </UCard>

      <div class="grid gap-2 sm:grid-cols-3">
        <UButton v-if="watchUrl" :to="watchUrl" target="_blank" icon="i-lucide-play" label="Watch" size="xl" block />
        <UButton
          icon="i-lucide-plus"
          label="Episode watched"
          size="xl"
          block
          variant="soft"
          :disabled="!canWatchEpisode(item)"
          @click="api.watchEpisode(item.id)"
        />
        <UButton
          icon="i-lucide-flag"
          label="Season finished"
          size="xl"
          block
          variant="soft"
          :disabled="!canFinishSeason(item)"
          @click="api.finishSeason(item.id)"
        />
      </div>

      <USeparator />

      <div class="flex gap-2">
        <UButton color="neutral" variant="outline" icon="i-lucide-pencil" label="Edit" size="lg" class="min-h-11" @click="openEdit(item)" />
        <UButton color="error" variant="ghost" icon="i-lucide-trash-2" label="Delete" size="lg" class="min-h-11" @click="confirmDelete = true" />
      </div>

      <UModal v-model:open="confirmDelete" title="Delete series?" :description="`“${item.name}” will be deleted. This cannot be undone.`">
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton color="neutral" variant="ghost" label="Cancel" @click="confirmDelete = false" />
            <UButton color="error" label="Delete" :loading="deleting" @click="doDelete" />
          </div>
        </template>
      </UModal>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Verify manually**

1. Clicking a running series opens the detail page, which shows season, episode and weekday. "Episode watched" increments the episode. "Season finished" gives season+1, episode 0, the "Paused" badge, and both action buttons become disabled.
2. On an upcoming series ("Plan Test" from Task 9), "Episode watched" makes it Open End, season 1, episode 1.
3. A paused series with season > 0 has both buttons disabled.
4. Edit opens the form prefilled; saving updates the page.
5. Back returns to the list, scrolled to this series, with a short ring highlight.
6. Delete → confirmation → list; the series is gone. Delete "Plan Test" and any other test series this way.
7. `/series/000000000000000000000000` shows "Series not found".
8. The browser tab title shows the series name.

Run: `npx nuxt typecheck` → exits 0.

- [ ] **Step 3: Commit**

```bash
git add app/pages/series
git commit -m "feat: add series detail page with watch, episode, season, edit and delete actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Settings page

**Files:**
- Create: `app/pages/settings.vue`

**Interfaces:**
- Consumes: `useSettings`, `useSeries`, `settingsSchema`, `BURNING_SERIES_PRESET`, `WATCH_PLACEHOLDERS`, `buildWatchUrl`, `useApiError`.
- Produces: the `/settings` route.

- [ ] **Step 1: Create `app/pages/settings.vue`**

```vue
<script setup lang="ts">
import { settingsSchema } from '#shared/settings-schema'
import { BURNING_SERIES_PRESET, WATCH_PLACEHOLDERS, buildWatchUrl } from '#shared/watch-url'

const { settings } = useSettings()
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

    <UCard>
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
          <UButton type="submit" label="Save" size="lg" :loading="saving" />
          <UButton color="neutral" variant="outline" label="Use burningseries preset" size="lg" @click="state.watchUrlTemplate = BURNING_SERIES_PRESET" />
          <UButton color="neutral" variant="ghost" label="Clear" size="lg" @click="state.watchUrlTemplate = ''" />
        </div>
      </UForm>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-semibold">Appearance</h2>
      </template>
      <UFormField label="Color mode">
        <UColorModeSelect size="xl" class="w-full sm:w-60" />
      </UFormField>
    </UCard>
  </div>
</template>
```

- [ ] **Step 2: Verify the watch-link flow**

1. Account menu → Settings. The template field is empty and no preview shows.
2. "Use burningseries preset" fills in the template, and the preview shows `http://burningseries.ac/serie/<slug>/<season>` for the first series. Click Save → toast.
3. The list now shows ▶ buttons, and the detail page shows "Watch". Clicking one opens a new tab with the expected URL.
4. Entering `ftp://x` and saving shows an inline error "Must start with http:// or https://".
5. Clear → Save → the ▶ buttons disappear.

- [ ] **Step 3: Verify colour mode**

1. Choose "Dark" in the select → dark theme. Reload → still dark with no light flash.
2. Choose "System", switch the OS/emulated preference (Playwright `browser_emulate_media` with `colorScheme: 'dark'`) → it follows.

- [ ] **Step 4: Verify special characters (Review Focus 2)**

1. Set the template `https://x.test/?q={name}&s={season}` and save.
2. Add a series named `Dark & Grüße: Teil 1`.
3. Its Watch URL is `https://x.test/?q=Dark%20%26%20Gr%C3%BC%C3%9Fe%3A%20Teil%201&s=0`.
4. Search `grüße` finds it.
5. Edit it, save without changes → the name is unchanged in Mongo.
6. Delete it and clear the template.

Run: `npx nuxt typecheck` → exits 0.

- [ ] **Step 5: Commit**

```bash
git add app/pages/settings.vue
git commit -m "feat: add settings page for watch URL template and color mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Docker image, GitHub release workflow, docs, private repo

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `.github/workflows/release.yml`, `README.md`, `docs/manual-test-checklist.md`

**Interfaces:**
- Consumes: `npm run build` output (`.output/`), `lib/password.mjs`, `scripts/create-user.mjs`.
- Produces:
  - image `ghcr.io/sebbi08/series-planner:{X.Y.Z, X.Y, X, latest}`, which listens on 3000, exposes `/api/health`, and contains `node .output/server/scripts/create-user.mjs`
  - private GitHub repo `sebbi08/series-planner`

- [ ] **Step 1: Create `Dockerfile` and `.dockerignore`**

`Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1
# Build once on the runner's native platform; .output is plain JS, so it runs on every target platform.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
ARG APP_VERSION=dev
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 APP_VERSION=$APP_VERSION
LABEL org.opencontainers.image.source="https://github.com/sebbi08/series-planner"
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
# CLI: lives next to .output/server/node_modules so `mongodb` resolves
COPY --from=build --chown=node:node /app/lib ./.output/server/lib
COPY --from=build --chown=node:node /app/scripts/create-user.mjs ./.output/server/scripts/create-user.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", ".output/server/index.mjs"]
```

`.dockerignore`:
```
node_modules
.nuxt
.output
.data
.env
.git
OLD
docs
.playwright-mcp
```

- [ ] **Step 2: Build and run the image locally**

```bash
docker build --build-arg APP_VERSION=0.0.0-local -t series-planner:local .
docker run --rm -d --name sp-local -p 3001:3000 --add-host=host.docker.internal:host-gateway \
  -e DB=host.docker.internal:27018/SeriesPlaner2 -e NUXT_SESSION_PASSWORD="$(openssl rand -base64 48)" series-planner:local
sleep 5
curl -s localhost:3001/api/health
docker exec sp-local find .output -name '*.node' | head
docker exec -it sp-local sh -c 'DB=host.docker.internal:27018/SeriesPlaner2 node .output/server/scripts/create-user.mjs dockertest'
docker inspect --format '{{.State.Health.Status}}' sp-local
```

Expected:
- health → `{"status":"ok","db":"up","version":"0.0.0-local"}`
- `find` prints nothing (no native addons, so the single-platform build is valid for arm64)
- `create-user` prompts twice and prints `Created user "dockertest"`
- health status is `healthy`, after up to 30 seconds

Then log in at `localhost:3001` as `dockertest` → the empty list shows. Clean up: `docker stop sp-local` and delete `dockertest` in mongosh.

If `find` prints any `.node` files, remove `--platform=$BUILDPLATFORM` from the Dockerfile so each platform builds natively under QEMU.

- [ ] **Step 3: Create `.github/workflows/release.yml`**

The action major versions below were checked on 2026-09-29.

```yaml
name: Release image

on:
  release:
    types: [published]

permissions:
  contents: read
  packages: write

jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: docker/setup-qemu-action@v4
      - uses: docker/setup-buildx-action@v4

      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - id: meta
        uses: docker/metadata-action@v6
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=semver,pattern={{major}}
            type=raw,value=latest

      - uses: docker/build-push-action@v7
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: APP_VERSION=${{ steps.meta.outputs.version }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 4: Create `docs/manual-test-checklist.md`**

```markdown
# Manual test checklist

Run against a COPY of production data (`npm run dev:db -- --reset`, then `npm run dev`), or against a release image on series-new.

## Auth
- [ ] Existing account logs in; afterwards `Users.<name>` has `passwordHash`, and `password`/`salt` are unchanged
- [ ] The same account still logs into the OLD app
- [ ] Wrong password and unknown user show the same "Invalid username or password"
- [ ] 11th failed attempt within 15 min → "Too many failed attempts"
- [ ] No "Create account" link while ALLOW_SIGNUP=false; `/api/auth/register` → 404
- [ ] Logout returns to /login; / redirects to /login when logged out
- [ ] Deleting the session cookie then clicking "+" → one "Session expired" toast → /login

## List
- [ ] Sections and order match the old app for every user (Running by weekday then name, Upcoming by date, Not started, Paused)
- [ ] Naruto Shippuden shows "Open End"; dates show as DD.MM.YYYY
- [ ] Search is case-insensitive and handles apostrophes/umlauts; "/" focuses the search box
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

## Appearance and mobile (375 × 812)
- [ ] Light / Dark / System; no wrong-theme flash on reload; theme-color meta follows the mode
- [ ] Header collapses to title + menu; FAB bottom-right respects the safe area
- [ ] Add/Edit opens as a bottom sheet; number steppers and the calendar work inside it
- [ ] Swipe left on a row reveals Episode/Watch; swipe right/tap closes it
- [ ] "Add to Home Screen" shows the icon and opens standalone

## Operations
- [ ] `/api/health` → ok / db up / correct version; 503 while Mongo is stopped; recovers when it starts again
- [ ] Container health status becomes `healthy`
- [ ] `node .output/server/scripts/create-user.mjs <name>` works inside the container
- [ ] Publishing a GitHub release pushes `ghcr.io/sebbi08/series-planner` for linux/amd64 and linux/arm64
```

- [ ] **Step 5: Create `README.md`**

````markdown
# Series Planner

Track which episode of which series you are on. Nuxt 4 + Nuxt UI rewrite of the old Angular app; it uses the same MongoDB database (`SeriesPlaner2`).

## Development

```bash
cp .env.example .env            # set NUXT_SESSION_PASSWORD (openssl rand -base64 48)
npm install
npm run dev:db                  # Mongo 8 on :27018 with a COPY of OLD/db (never the original)
npm run dev                     # http://localhost:3000
npx nuxt typecheck
```

`npm run dev:db -- --reset` throws the copy away and copies `OLD/db` again. Manual verification: [docs/manual-test-checklist.md](docs/manual-test-checklist.md).

## Configuration

| Variable | Description |
|---|---|
| `DB` | Mongo connection, e.g. `root:pw@mongo:27017/SeriesPlaner2?authSource=admin` (`mongodb://` optional) |
| `NUXT_SESSION_PASSWORD` | ≥ 32 random characters; changing it logs everyone out |
| `ALLOW_SIGNUP` | `true` enables self-registration (default: closed) |

## Users

Registration is closed by default. Create a user inside the container:

```bash
docker compose exec series-new node .output/server/scripts/create-user.mjs <name>
# add --legacy while the OLD app is still running, so the user can log in there too
```

Existing users keep their passwords: on first login the old unsalted SHA-256 hash is verified and an scrypt hash (`passwordHash`) is stored next to it.

## Releasing

```bash
gh release create v1.2.3 --generate-notes
```

Publishing a release runs `.github/workflows/release.yml`, which pushes `ghcr.io/sebbi08/series-planner:{1.2.3,1.2,1,latest}` for amd64 and arm64.

## Deployment (side by side, then cutover)

1. On the server, log in to GHCR once (PAT with `read:packages`): `docker login ghcr.io -u sebbi08`
2. Add to `.env`: `NUXT_SESSION_PASSWORD=...` and `ALLOW_SIGNUP=false`
3. Add the service to `docker-compose.yml`:

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
4. `docker compose up -d series-new`, then work through the manual checklist on `series-new.sebmahr.de`.
5. Cutover: change the router rule to ``Host(`series.sebmahr.de`)``, remove the old `app` service, `docker compose up -d --remove-orphans`.
6. Optional, once every user has logged in to the new app — drop the legacy hash fields:

   ```bash
   docker compose exec mongo mongosh -u root -p "$SERIES_PLANNER_DB_PW" --authenticationDatabase admin SeriesPlaner2 \
     --eval 'db.Users.updateMany({ passwordHash: { $exists: true } }, { $unset: { password: "", salt: "" } })'
   ```
````

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore .github README.md docs/manual-test-checklist.md
git commit -m "build: add Docker image, GHCR release workflow, README and manual test checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Create the private GitHub repo and push**

The user approved a **private** repo in the spec. Before running, re-check the commit list (`git log --oneline`) and make sure `git ls-files | grep -E '^(OLD|\.env$|\.data)'` prints nothing.

```bash
gh repo create sebbi08/series-planner --private --source=. --remote=origin --push
```

Expected: the repo is created and `main` is pushed. **Do not create a release yet**; that happens in Task 13 after verification, with the user's go-ahead.

---

### Task 13: Full verification against a copy of production data, then first release

**Files:** none created. Only fixes found during verification, each committed separately.

- [ ] **Step 1: Reset the dev data**

```bash
npm run dev:db -- --reset
npm run build && set -a && source .env && set +a && node .output/server/index.mjs
```

This runs the **production build**, not the dev server.

- [ ] **Step 2: Work through `docs/manual-test-checklist.md`**

Use the Playwright MCP against `http://localhost:3000`. Check each item as it passes. For any failure, use superpowers:systematic-debugging, fix it, commit, and re-run the affected items.

- [ ] **Step 3: Compare the order with the old app, for all 5 users**

Old order per user, using the old comparator logic in mongosh:
```bash
docker exec sp-dev-mongo mongosh --quiet --eval '
const S = db.getSiblingDB("SeriesPlaner2").Series;
const rd = v => (v === null || v === undefined || v === "") ? null : Number(v);
const g = s => rd(s.runningDay) !== null ? 0 : s.startDate ? 1 : s.season === 0 ? 2 : 3;
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
db.getSiblingDB("SeriesPlaner2").Users.find().forEach(u => {
  const list = S.find({ user: u.name }).toArray().sort((a, b) => g(a) - g(b)
    || (g(a) === 0 ? rd(a.runningDay) - rd(b.runningDay) : 0)
    || (g(a) === 1 ? cmp(String(a.startDate), String(b.startDate)) : 0)
    || cmp(a.name, b.name));
  print(u.name + ": " + list.map(s => s.name).join(" | "));
});'
```

Compare each line with the rendered list for that user (use a temporary dev-copy password as in Task 8, Step 6).
Expected: identical order.

- [ ] **Step 4: Check that the old app can still log in**

```bash
cd OLD/app && npm install --no-audit --no-fund && DB=localhost:27018/SeriesPlaner2 node app.js
```

The old server listens on `:8080`.
1. Log in as a user who has already logged in through the new app. It works, because `password` is untouched.
2. Log in as a `create-user --legacy` user. It works too.

- [ ] **Step 5: Check both apps editing the same data (Review Focus 4)**

1. In the old app (`:8080`), change a series' episode.
2. Switch to the new app's tab. It shows the change after focus.
3. In the new app, make a series upcoming with a date. The old app shows the same date in its list and detail page, with no off-by-one day.

Stop the old app afterwards (`Ctrl+C`), then remove only what Step 4 created. As of 2026-09-29, `OLD/app` contains no `node_modules` and no `package-lock.json`, so run `rm -rf OLD/app/node_modules OLD/app/package-lock.json`. Nothing else under `OLD/` may change.

- [ ] **Step 6: Clean up the test data in the dev copy**

Delete `testuser` and `dockertest` and all their series, or just run `npm run dev:db -- --reset`.

- [ ] **Step 7: Ask the user, then cut the first release**

Ask the user: "Everything on the checklist passes. Shall I publish release v1.0.0 (this pushes the image to GHCR)?" Only after a yes:

```bash
gh release create v1.0.0 --generate-notes --title "v1.0.0"
gh run watch --exit-status "$(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
docker buildx imagetools inspect ghcr.io/sebbi08/series-planner:1.0.0 | grep -E 'Platform:'
```

Expected: the workflow succeeds, and `inspect` lists `linux/amd64` and `linux/arm64`.

- [ ] **Step 8: Hand over the deployment**

Point the user to README "Deployment" steps 1–5. Those run on their server (GHCR login, `.env`, compose service, `series-new` DNS/Traefik rule) and are theirs to do.
