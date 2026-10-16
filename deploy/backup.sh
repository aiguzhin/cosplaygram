#!/usr/bin/env bash
# Ночная копия базы в /opt/backups, старше 14 дней удаляются
set -euo pipefail
mkdir -p /opt/backups
cd /opt/cosplaygram
docker compose exec -T db pg_dump -U cosplaygram cosplaygram | gzip > "/opt/backups/cosplaygram-$(date +%F).sql.gz"
find /opt/backups -name 'cosplaygram-*.sql.gz' -mtime +14 -delete
echo "$(date '+%F %T') копия готова"
