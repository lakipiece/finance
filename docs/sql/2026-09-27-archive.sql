-- 종목·계좌 보관(archive)
-- FK RESTRICT 도입 후 이력이 있는 종목·계좌는 삭제할 수 없다 → 다 팔았거나 해지한 것을
-- 목록·선택지에서만 숨긴다. 과거 스냅샷·배당·입출금 이력과 평가에는 그대로 쓰인다.
ALTER TABLE securities ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE accounts   ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN securities.archived_at IS '보관 시각 — NULL이 아니면 관리 목록·선택지에서 숨김 (이력·평가에는 유지)';
COMMENT ON COLUMN accounts.archived_at   IS '보관 시각 — NULL이 아니면 관리 목록·선택지에서 숨김 (이력·평가에는 유지)';
