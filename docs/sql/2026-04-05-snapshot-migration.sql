-- 1. 스냅샷 그룹 테이블
CREATE TABLE IF NOT EXISTS snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 2. 매도 기록
CREATE TABLE IF NOT EXISTS sells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES snapshots(id),
  security_id uuid REFERENCES securities(id) NOT NULL,
  account_id uuid REFERENCES accounts(id) NOT NULL,
  sold_at date NOT NULL,
  quantity numeric NOT NULL,
  avg_cost_krw numeric,
  sell_price_krw numeric,
  realized_pnl_krw numeric,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 3. 배당/분배금 (기존 테이블에 누락 컬럼 추가)
CREATE TABLE IF NOT EXISTS dividends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id uuid REFERENCES securities(id) NOT NULL,
  account_id uuid REFERENCES accounts(id) NOT NULL,
  paid_at date NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  tax numeric NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 기존 dividends 테이블에 tax 컬럼이 없을 수 있으므로 추가
ALTER TABLE dividends ADD COLUMN IF NOT EXISTS tax numeric NOT NULL DEFAULT 0;
ALTER TABLE dividends ADD COLUMN IF NOT EXISTS memo text;

-- 4. holdings에 snapshot_id 추가
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS snapshot_id uuid REFERENCES snapshots(id);

-- 5. 기존 holdings → 초기 스냅샷으로 마이그레이션
-- (이미 snapshot_id가 채워진 게 없을 때만 실행)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM holdings WHERE snapshot_id IS NOT NULL LIMIT 1) THEN
    WITH initial AS (
      INSERT INTO snapshots (date, memo)
      SELECT MAX(snapshot_date), '초기 마이그레이션'
      FROM holdings
      RETURNING id
    )
    UPDATE holdings
    SET snapshot_id = (SELECT id FROM initial)
    WHERE snapshot_id IS NULL;
  END IF;
END $$;
