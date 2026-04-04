-- docs/portfolio-schema.sql
-- Supabase SQL Editor에서 실행

-- 계좌
CREATE TABLE accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  broker     text NOT NULL,
  owner      text,
  type       text,        -- 종합위탁 / 연금저축 / ISA
  currency   text NOT NULL DEFAULT 'KRW',
  created_at timestamptz DEFAULT now()
);

-- 종목 마스터
CREATE TABLE securities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker      text UNIQUE NOT NULL,
  name        text NOT NULL,
  asset_class text,    -- 주식 / 채권 / 대체자산
  country     text,    -- US / KR
  style       text,    -- 성장 / 인컴 / 안전
  sector      text,
  currency    text NOT NULL DEFAULT 'USD',
  created_at  timestamptz DEFAULT now()
);

-- 현재 포지션 스냅샷 (holdings = source of truth)
CREATE TABLE holdings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid REFERENCES accounts(id) ON DELETE CASCADE,
  security_id    uuid REFERENCES securities(id) ON DELETE CASCADE,
  quantity       numeric NOT NULL DEFAULT 0,
  avg_price      numeric,        -- 평균매입가
  total_invested numeric,        -- 투자원금 (KRW)
  snapshot_date  date NOT NULL DEFAULT CURRENT_DATE,
  source         text DEFAULT 'manual',  -- manual / calculated
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(account_id, security_id)
);

-- 매수/매도 이력
CREATE TABLE portfolio_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid REFERENCES accounts(id) ON DELETE CASCADE,
  security_id    uuid REFERENCES securities(id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('buy', 'sell')),
  date           date NOT NULL,
  quantity       numeric NOT NULL,
  price_per_unit numeric NOT NULL,
  currency       text NOT NULL DEFAULT 'USD',
  exchange_rate  numeric NOT NULL DEFAULT 1,
  fees           numeric DEFAULT 0,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- 분배금/배당 이력
CREATE TABLE dividends (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid REFERENCES accounts(id) ON DELETE CASCADE,
  security_id   uuid REFERENCES securities(id) ON DELETE CASCADE,
  date          date NOT NULL,
  amount        numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'USD',
  exchange_rate numeric NOT NULL DEFAULT 1,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- 목표 비율
CREATE TABLE target_allocations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level      text NOT NULL CHECK (level IN ('asset_class', 'sector', 'ticker')),
  key        text NOT NULL,       -- "주식", "테크", "SCHD"
  target_pct numeric NOT NULL,   -- 0.0 ~ 1.0
  UNIQUE(level, key)
);

-- 현재가 캐시 (TTL: 1시간)
CREATE TABLE price_cache (
  ticker     text PRIMARY KEY,
  price      numeric NOT NULL,
  currency   text NOT NULL DEFAULT 'USD',
  fetched_at timestamptz DEFAULT now()
);

-- RLS: 공개 읽기 허용 (기존 expenses 테이블과 동일 패턴)
ALTER TABLE accounts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE securities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividends              ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_allocations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_cache            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read accounts"               ON accounts              FOR SELECT TO anon USING (true);
CREATE POLICY "public read securities"             ON securities            FOR SELECT TO anon USING (true);
CREATE POLICY "public read holdings"               ON holdings              FOR SELECT TO anon USING (true);
CREATE POLICY "public read portfolio_transactions" ON portfolio_transactions FOR SELECT TO anon USING (true);
CREATE POLICY "public read dividends"              ON dividends             FOR SELECT TO anon USING (true);
CREATE POLICY "public read target_allocations"     ON target_allocations    FOR SELECT TO anon USING (true);
CREATE POLICY "public read price_cache"            ON price_cache           FOR SELECT TO anon USING (true);
