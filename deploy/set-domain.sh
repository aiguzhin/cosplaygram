#!/usr/bin/env bash
# Подключить домен: sudo /opt/cosplaygram/deploy/set-domain.sh cosplaygram.kz
set -euo pipefail
D="${1:?Укажите домен, например cosplaygram.kz}"
cd /opt/cosplaygram
if grep -q '^DOMAIN=' .env; then sed -i "s|^DOMAIN=.*|DOMAIN=$D, www.$D|" .env; else echo "DOMAIN=$D, www.$D" >> .env; fi
[ "${2:-}" = "--no-restart" ] || docker compose up -d caddy --force-recreate
echo "Домен $D подключён. Проверьте, что A-записи @ и www указывают на IP этого сервера."
