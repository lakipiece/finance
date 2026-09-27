-- 스냅샷에 첨부하는 HTML 보고서 (Claude로 생성한 가계 점검 보고서 등)
-- 원문을 DB에 저장해 기존 Postgres 백업에 함께 포함되게 한다.
-- 스냅샷을 지우면 보고서도 함께 지운다.
CREATE TABLE IF NOT EXISTS snapshot_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  title       text NOT NULL,
  filename    text NOT NULL,
  html        text NOT NULL,
  size        integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snapshot_reports_snapshot
  ON snapshot_reports (snapshot_id, created_at DESC);
