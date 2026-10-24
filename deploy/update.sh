#!/usr/bin/env bash
# Подтягивает новую версию с GitHub и перезапускает сайт, только если что-то изменилось
set -euo pipefail
# Старый адрес cosplaygram.onrender.com на бесплатном Render засыпает через 15 минут тишины,
# и тогда люди по старым ссылкам видят экран «Загрузка приложения» вместо сайта.
# Этот скрипт запускается каждые 5 минут — заодно «будим» Render, чтобы он не успевал уснуть
# и сразу пересылал на cosplaygram.kz.
curl -fsS -m 25 -o /dev/null https://cosplaygram.onrender.com/healthz || true
cd /opt/cosplaygram
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  git reset -q --hard origin/main
  chmod +x deploy/*.sh
  docker compose up -d --build
  docker image prune -f >/dev/null
  echo "$(date '+%F %T') обновлено до $(git rev-parse --short HEAD)"
fi
