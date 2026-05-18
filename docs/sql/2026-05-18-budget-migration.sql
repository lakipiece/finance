-- 예산관리: 연도별 카테고리×세부유형 단위 연간 계획 + 변동비 주단위 기준금액
-- 누적 사용금액·잔액·비율은 expenses 테이블에서 SUM으로 계산하므로 별도 컬럼 없음

CREATE TABLE IF NOT EXISTS budget_items (
  id          BIGSERIAL PRIMARY KEY,
  year        SMALLINT NOT NULL,
  category    TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  annual_plan INTEGER NOT NULL DEFAULT 0,
  sort_order  INT NOT NULL DEFAULT 0,
  note        TEXT NOT NULL DEFAULT '',
  UNIQUE (year, category, detail)
);

CREATE INDEX IF NOT EXISTS idx_budget_items_year ON budget_items (year);

CREATE TABLE IF NOT EXISTS budget_weekly (
  year           SMALLINT PRIMARY KEY,
  weekly_amount  INTEGER NOT NULL DEFAULT 0
);
