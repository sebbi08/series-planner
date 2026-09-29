# Series Planner

Track which episode of which series you are on. Nuxt 4 + Nuxt UI rewrite of the old Angular app; it uses the same MongoDB database (`SeriesPlaner2`).

## Development

```bash
cp .env.example .env            # set NUXT_SESSION_PASSWORD (openssl rand -base64 48)
npm install
npm run dev:db                  # Mongo 8 on :27018, data in .data/db (empty on first run)
npm run dev                     # http://localhost:3000
npx nuxt typecheck
```

On a fresh database, create a login with `set -a; source .env; set +a; node scripts/create-user.mjs <name>`. To start over, stop the container (`docker rm -f sp-dev-mongo`) and delete `.data/` (its files belong to the container's mongodb user, so remove them via `docker run --rm -v "$PWD/.data:/d" mongo:8.0.32 rm -rf /d/db`). Manual verification: [docs/manual-test-checklist.md](docs/manual-test-checklist.md).

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

The CLI prompts for the password twice (hidden on a TTY). It also accepts piped input, two lines: `printf 'pw\npw\n' | docker compose exec -T series-new node .output/server/scripts/create-user.mjs <name>`.

Existing users keep their passwords: on first login the old unsalted SHA-256 hash is verified and an scrypt hash (`passwordHash`) is stored next to it.

## Releasing

```bash
gh release create v1.2.3 --generate-notes
```

Publishing a release runs `.github/workflows/release.yml`, which pushes `ghcr.io/sebbi08/series-planner:{1.2.3,1.2,1,latest}` for amd64 and arm64.

## Deployment (side by side, then cutover)

The login rate limit keys on the right-most `X-Forwarded-For` entry, which is the one Traefik appends. The app must therefore only be reachable through Traefik: the compose service uses `expose`, not `ports`. Publishing port 3000 directly would let clients spoof the header and bypass the limit.

1. On the server, log in to GHCR once (PAT with `read:packages`): `docker login ghcr.io -u sebbi08`
2. Add to the `.env` **next to `docker-compose.yml`** (Compose reads `${...}` from there and silently substitutes an empty string if a variable is missing): `NUXT_SESSION_PASSWORD=<at least 32 random characters>` (e.g. append it with `echo "NUXT_SESSION_PASSWORD=$(openssl rand -base64 48)" >> .env`) and `ALLOW_SIGNUP=false`. After changing it, recreate the container with `docker compose up -d series-new` (`restart` keeps the old environment).
   If logins fail with a 500, check `docker compose logs series-new | grep '\[config\]'` or `/api/health` (`session: misconfigured`); the length inside the container: `docker compose exec series-new sh -c 'echo ${#NUXT_SESSION_PASSWORD}'`.
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
