-- holdings unique 제약을 스냅샷 단위로 확장
-- 라이브 DB에는 이미 수동 적용된 상태(holdings_account_security_snapshot_key,
-- UNIQUE NULLS NOT DISTINCT (account_id, security_id, snapshot_id))를 리포에 기록.
-- snapshot 마이그레이션(2026-04-05)에서 snapshot_id 컬럼만 추가하고 제약을 갱신하지 않아
-- portfolio-schema.sql의 2컬럼 UNIQUE와 코드의 3컬럼 ON CONFLICT가 어긋났던 것을 정합화.
-- (PostgreSQL 15+ 필요 — NULLS NOT DISTINCT)

-- 1. 기존 2컬럼 제약 제거 (portfolio-schema.sql: UNIQUE(account_id, security_id))
ALTER TABLE holdings DROP CONSTRAINT IF EXISTS holdings_account_id_security_id_key;

-- 2. 3컬럼 제약 추가 (없을 때만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'holdings'::regclass
      AND conname = 'holdings_account_security_snapshot_key'
  ) THEN
    ALTER TABLE holdings
      ADD CONSTRAINT holdings_account_security_snapshot_key
      UNIQUE NULLS NOT DISTINCT (account_id, security_id, snapshot_id);
  END IF;
END $$;
