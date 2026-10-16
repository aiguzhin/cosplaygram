#!/usr/bin/env bash
# Установка Cosplaygram на сервер Ubuntu/Debian одной командой:
#   curl -sL cosplaygram.onrender.com/i | bash
# (под root). Домен по умолчанию cosplaygram.kz; другой: ... | bash -s example.kz
set -euo pipefail
DOMAIN_ARG="${1:-cosplaygram.kz}"
DIR=/opt/cosplaygram
say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }

say "1/5 Устанавливаю Docker и git"
command -v git >/dev/null || (apt-get update -qq && apt-get install -y -qq git)
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

say "2/5 Скачиваю Cosplaygram"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull -q; else git clone -q https://github.com/aiguzhin/cosplaygram.git "$DIR"; fi
cd "$DIR"

say "3/5 Настройки"
IP=$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
if [ ! -f .env ]; then
  DBP=$(openssl rand -hex 16)
  CODE=$(shuf -i 100000-999999 -n 1)
  umask 077
  cat > .env <<ENV
DOMAIN=$DOMAIN_ARG, www.$DOMAIN_ARG, http://$IP
DB_PASSWORD=$DBP
NEW_DATABASE_URL=postgres://cosplaygram:$DBP@db:5432/cosplaygram
DATABASE_URL=
MIGRATE_CODE=$CODE
ENV
else
  echo "Файл .env уже есть — оставляю как есть"
  if [ -n "$DOMAIN_ARG" ]; then bash "$DIR/deploy/set-domain.sh" "$DOMAIN_ARG" --no-restart; fi
fi

chmod +x deploy/*.sh
say "4/5 Запускаю сайт, базу и https"
docker compose up -d --build

say "5/5 Автообновление с GitHub и ежедневные резервные копии"
cat > /etc/cron.d/cosplaygram <<'CRON'
SHELL=/bin/bash
*/5 * * * * root /opt/cosplaygram/deploy/update.sh >> /var/log/cosplaygram-update.log 2>&1
30 3 * * * root /opt/cosplaygram/deploy/backup.sh >> /var/log/cosplaygram-backup.log 2>&1
CRON
chmod +x deploy/*.sh

CODE=$(grep '^MIGRATE_CODE=' .env | cut -d= -f2)
say "Готово!"
echo "Сайт: http://$IP  (через 2–3 минуты, пока собирается)"
echo ""
echo "   IP сервера:     $IP"
echo "   КОД ПЕРЕЕЗДА:   $CODE"
echo ""
if [ -n "$DOMAIN_ARG" ]; then echo "Домен: https://$DOMAIN_ARG — в настройках DNS домена укажите A-записи @ и www → $IP"; fi
echo "Резервные копии базы: /opt/backups (каждую ночь, хранятся 14 дней)"
