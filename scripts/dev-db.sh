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
