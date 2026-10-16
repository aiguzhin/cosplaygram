#!/usr/bin/env bash
# Подтягивает новую версию с GitHub и перезапускает сайт, только если что-то изменилось
set -euo pipefail
cd /opt/cosplaygram
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  git reset -q --hard origin/main
  chmod +x deploy/*.sh
  docker compose up -d --build
  docker image prune -f >/dev/null
  echo "$(date '+%F %T') обновлено до $(git rev-parse --short HEAD)"
fi
