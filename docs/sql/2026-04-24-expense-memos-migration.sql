-- expense_memos: 지출 1건에 다수 비고 항목 지원
-- label: 항목명 (예: '식비', '생필품')
-- amount: NULL 허용 — 금액 없이 텍스트만 입력 가능
CREATE TABLE IF NOT EXISTS expense_memos (
  id         BIGSERIAL PRIMARY KEY,
  expense_id BIGINT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  amount     INTEGER,
  sort_order SMALLINT DEFAULT 0
);

