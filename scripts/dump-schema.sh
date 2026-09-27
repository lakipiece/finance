#!/bin/bash
# 운영 DB 스키마를 docs/schema.sql로 다시 뜬다 (데이터 제외, 읽기 전용).
# 마이그레이션(docs/sql/*.sql)을 적용한 뒤 실행해 문서와 라이브 스키마를 맞춘다.
#   사용: scripts/dump-schema.sh
set -euo pipefail
cd "$(dirname "$0")/.."

{
  echo "-- Finance 운영 DB 스키마 (pg_dump --schema-only)"
  echo "-- 생성: $(date '+%Y-%m-%d %H:%M') · scripts/dump-schema.sh"
  echo
  # pg_dump 16.10+의 \restrict / \unrestrict 줄은 덤프마다 무작위 토큰이라 diff 노이즈 → 제거
  ssh ubuntu 'docker exec finance-db-1 pg_dump -U finance -d finance --schema-only --no-owner --no-privileges' \
    | grep -vE '^\\(un)?restrict '
} > docs/schema.sql

echo "docs/schema.sql 갱신 ($(wc -l < docs/schema.sql)줄)"
