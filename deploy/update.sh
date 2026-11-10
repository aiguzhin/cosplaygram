#!/usr/bin/env bash
# Подтягивает новую версию с GitHub и перезапускает сайт, только если что-то изменилось
set -euo pipefail
# Старый адрес cosplaygram.onrender.com больше не будим: круглосуточная работа съедала почти все
# бесплатные часы Render (750 в месяц на все сайты аккаунта). Он просыпается сам, когда кто-то
# открывает старую ссылку, и пересылает на cosplaygram.kz.
cd /opt/cosplaygram
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  git reset -q --hard origin/main
  chmod +x deploy/*.sh
  docker compose up -d --build
  docker image prune -f >/dev/null
  echo "$(date '+%F %T') обновлено до $(git rev-parse --short HEAD)"
fi
