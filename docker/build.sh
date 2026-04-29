#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== 1/2 构建前端（打入镜像的静态资源）==="
(cd "$ROOT/web" && npm run build)

echo "=== 2/2 构建 Docker 镜像（镜像内 bun compile → Linux ELF）==="
docker compose -f "$ROOT/docker/docker-compose.yml" build

echo "✅ 构建完成，运行: docker compose -f docker/docker-compose.yml up -d"
