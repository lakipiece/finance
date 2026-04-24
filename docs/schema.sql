-- 가계부 기본 스키마

CREATE TABLE expenses (
  id        BIGSERIAL PRIMARY KEY,
  expense_date DATE,
  month     SMALLINT NOT NULL,      -- 1~12
  year      SMALLINT NOT NULL DEFAULT 2022,
  category  TEXT NOT NULL,          -- 고정비 | 대출상환 | 변동비 | 여행공연비
  detail    TEXT DEFAULT '',
  method    TEXT DEFAULT '',        -- 현금 | 카드
  amount    INTEGER NOT NULL
);
