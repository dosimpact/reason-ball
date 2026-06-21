#!/bin/sh
set -eu

container_name="${1:-sec-filings-postgres}"
host_port="${POSTGRES_PORT:-55432}"

docker exec "$container_name" sh -lc "
  attempts=0
  until psql -U postgres -h 127.0.0.1 -d sec_collector -c 'select 1' >/dev/null 2>&1; do
    attempts=\$((attempts + 1))
    if [ \$attempts -ge 30 ]; then
      echo 'Postgres did not become ready in time' >&2
      exit 1
    fi
    sleep 1
  done

  psql -U postgres -h 127.0.0.1 -d sec_collector <<'SQL'
ALTER USER postgres WITH PASSWORD 'postgres';
SELECT 'CREATE DATABASE chat_bot'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'chat_bot')\\gexec
SQL
"

host_attempts=0
until nc -z 127.0.0.1 "$host_port" >/dev/null 2>&1; do
  host_attempts=$((host_attempts + 1))
  if [ "$host_attempts" -ge 30 ]; then
    echo "Postgres host port $host_port did not become ready in time" >&2
    exit 1
  fi
  sleep 1
done
