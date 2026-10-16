#!/usr/bin/env bash
# Подключить домен: sudo /opt/cosplaygram/deploy/set-domain.sh cosplaygram.kz
set -euo pipefail
D="${1:?Укажите домен, например cosplaygram.kz}"
cd /opt/cosplaygram
IP=$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
if grep -q '^DOMAIN=' .env; then sed -i "s|^DOMAIN=.*|DOMAIN=$D, www.$D, http://$IP|" .env; else echo "DOMAIN=$D, www.$D, http://$IP" >> .env; fi
[ "${2:-}" = "--no-restart" ] || docker compose up -d caddy --force-recreate
echo "Домен $D подключён. Проверьте, что A-записи @ и www указывают на IP этого сервера."
