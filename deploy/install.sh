#!/usr/bin/env bash
# Установка Cosplaygram на сервер Ubuntu/Debian одной командой:
#   curl -fsSL https://raw.githubusercontent.com/aiguzhin/cosplaygram/main/deploy/install.sh | sudo bash -s cosplaygram.kz
# Домен можно не указывать — тогда сайт откроется по IP, домен добавите потом: sudo /opt/cosplaygram/deploy/set-domain.sh cosplaygram.kz
set -euo pipefail
DOMAIN_ARG="${1:-}"
DIR=/opt/cosplaygram
say() { printf '\n\033[1;33m== %s\033[0m\n' "$*"; }

say "1/5 Устанавливаю Docker и git"
command -v git >/dev/null || (apt-get update -qq && apt-get install -y -qq git)
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

say "2/5 Скачиваю Cosplaygram"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull -q; else git clone -q https://github.com/aiguzhin/cosplaygram.git "$DIR"; fi
cd "$DIR"

say "3/5 Настройки"
if [ ! -f .env ]; then
  DBP=$(openssl rand -hex 16)
  OLD=""
  if [ -r /dev/tty ]; then
    echo "Чтобы перенести всех участников и посты со старого сайта, вставьте адрес старой базы:"
    echo "Render → cosplaygram-db → Connect → External Database URL (начинается с postgresql://)."
    read -r -p "Адрес (или просто Enter, чтобы начать с пустого сайта): " OLD < /dev/tty || true
  fi
  if [ -n "$DOMAIN_ARG" ]; then DOMAIN="$DOMAIN_ARG, www.$DOMAIN_ARG"; else DOMAIN=":80"; fi
  umask 077
  cat > .env <<ENV
DOMAIN=$DOMAIN
DB_PASSWORD=$DBP
NEW_DATABASE_URL=postgres://cosplaygram:$DBP@db:5432/cosplaygram
DATABASE_URL=$OLD
ENV
else
  echo "Файл .env уже есть — оставляю как есть"
  [ -n "$DOMAIN_ARG" ] && "$DIR/deploy/set-domain.sh" "$DOMAIN_ARG" --no-restart
fi

say "4/5 Запускаю сайт, базу и https"
docker compose up -d --build

say "5/5 Автообновление с GitHub и ежедневные резервные копии"
cat > /etc/cron.d/cosplaygram <<'CRON'
SHELL=/bin/bash
*/5 * * * * root /opt/cosplaygram/deploy/update.sh >> /var/log/cosplaygram-update.log 2>&1
30 3 * * * root /opt/cosplaygram/deploy/backup.sh >> /var/log/cosplaygram-backup.log 2>&1
CRON
chmod +x deploy/*.sh

IP=$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
say "Готово!"
echo "Сайт: http://$IP  (через минуту, пока собирается)"
[ -n "$DOMAIN_ARG" ] && echo "Домен: https://$DOMAIN_ARG — в настройках DNS домена укажите A-записи @ и www → $IP"
echo "Резервные копии базы: /opt/backups (каждую ночь, хранятся 14 дней)"
