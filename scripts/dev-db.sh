#!/usr/bin/env bash
# Local MongoDB for development, data kept in .data/db (gitignored).
# Starts empty on first run; create a login with scripts/create-user.mjs.
# Usage: scripts/dev-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=sp-dev-mongo
IMAGE=mongo:8.3.13

docker rm -f "$NAME" >/dev/null 2>&1 || true
mkdir -p .data/db

docker run -d --name "$NAME" -p 27018:27017 -v "$PWD/.data/db:/data/db" "$IMAGE" >/dev/null
echo "Mongo on mongodb://localhost:27018/SeriesPlaner2 (data in .data/db)"
