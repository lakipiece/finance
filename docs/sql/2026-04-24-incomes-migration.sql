-- incomes: 급여·보너스·기타 수입 관리
-- member: 'L' | 'P' — expenses 테이블과 동일 패턴
CREATE TABLE IF NOT EXISTS incomes (
  id           BIGSERIAL PRIMARY KEY,
  income_date  DATE NOT NULL,
  year         SMALLINT NOT NULL,
  month        SMALLINT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('급여', '보너스', '기타')),
  description  TEXT NOT NULL DEFAULT '',
  amount       INTEGER NOT NULL,
  member       TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

