-- 포트폴리오 분류 체계 재설계: 5차원 모델
-- asset_class / country / style(신규) / sector(GICS만) / tags
-- 2026-04-26

-- ─── 1. option_list: is_hidden 컬럼 추가 ─────────────────────────────────────
ALTER TABLE option_list ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- ─── 2. option_list: style 차원 추가 ─────────────────────────────────────────
INSERT INTO option_list (type, label, value, sort_order) VALUES
  ('style', '단일종목',  '단일종목',  1),
  ('style', '광범위지수','광범위지수', 2),
  ('style', '섹터테마',  '섹터테마',  3),
  ('style', '배당',      '배당',      4),
  ('style', '커버드콜',  '커버드콜',  5),
  ('style', '채권',      '채권',      6),
  ('style', '리츠',      '리츠',      7),
  ('style', '원자재',    '원자재',    8),
  ('style', '현금성',    '현금성',    9),
  ('style', '코인',      '코인',      10)
ON CONFLICT (type, value) DO NOTHING;

-- ─── 3. securities: style_id FK 컬럼 추가 ────────────────────────────────────
ALTER TABLE securities ADD COLUMN IF NOT EXISTS style_id UUID REFERENCES option_list(id);

-- ─── 4. sector: GICS 누락 값 추가 ────────────────────────────────────────────
INSERT INTO option_list (type, label, value, sort_order) VALUES
  ('sector', '통신',    '통신',    27),
  ('sector', '유틸리티','유틸리티', 28),
  ('sector', '소재',    '소재',    29)
ON CONFLICT (type, value) DO NOTHING;

-- ─── 5. sector: 비-GICS 값 is_hidden 처리 (FK 유지, UI에서 비노출) ───────────
UPDATE option_list
SET is_hidden = true
WHERE type = 'sector'
  AND value IN (
    '미국전체','한국전체','S&P500','KOSPI','미국채권',
    '예금/CMA','대체자산','금','방산','조선','로봇',
    '양자','리츠','안전자산','IT','소비재','산업재'
  );

-- ─── 6. target_allocations: level CHECK 확장 ─────────────────────────────────
ALTER TABLE target_allocations
  DROP CONSTRAINT IF EXISTS target_allocations_level_check;
ALTER TABLE target_allocations
  ADD CONSTRAINT target_allocations_level_check
  CHECK (level IN ('asset_class','country','style','sector','ticker'));

-- ─── 7. 64종목 자산군(asset_class) 교정 ──────────────────────────────────────

-- 코인
UPDATE securities SET asset_class_id = (
  SELECT id FROM option_list WHERE type = 'asset_class' AND value = '코인'
) WHERE ticker IN ('DOGECOIN','RIPPLE','BITCOIN','SOLANA','ETHEREUM');

-- 채권
UPDATE securities SET asset_class_id = (
  SELECT id FROM option_list WHERE type = 'asset_class' AND value = '채권'
) WHERE ticker IN ('0085P0','453850','TLTW');

-- 대체자산
UPDATE securities SET asset_class_id = (
  SELECT id FROM option_list WHERE type = 'asset_class' AND value = '대체자산'
) WHERE ticker IN ('411060','261220','GLD');

-- 현금
UPDATE securities SET asset_class_id = (
  SELECT id FROM option_list WHERE type = 'asset_class' AND value = '현금'
) WHERE ticker IN ('KRW','USD','497880');

-- ─── 8. 64종목 섹터(GICS) 교정 ───────────────────────────────────────────────
-- ETF/코인/현금/채권/대체자산은 sector null
UPDATE securities SET sector_id = NULL
WHERE ticker IN (
  'DOGECOIN','RIPPLE','BITCOIN','SOLANA','ETHEREUM',
  'KRW','USD','497880',
  '0085P0','453850','TLTW',
  '411060','261220','GLD',
  '360200','069500','379800','102110','360750','461490','SPYM','QQQ',
  '402970','161510','458730','SCHD',
  '490590','476800','JEPI','JEPQ','QQQI',
  '487230','0035T0','0023A0','466920','494840','0053L0','0148J0'
);
-- 453650 KODEX 미국S&P500금융 → 금융 섹터 단일섹터 ETF라 유지
UPDATE securities SET sector_id = (
  SELECT id FROM option_list WHERE type = 'sector' AND value = '금융'
) WHERE ticker = '453650';
-- 381170 TIGER 미국테크TOP10 → 테크 단일섹터 ETF
UPDATE securities SET sector_id = (
  SELECT id FROM option_list WHERE type = 'sector' AND value = '테크'
) WHERE ticker = '381170';

-- 개별주 GICS 섹터
UPDATE securities SET sector_id = (
  SELECT id FROM option_list WHERE type = 'sector' AND value = '테크'
) WHERE ticker IN ('005935','NFLX','RGTI','META','IONQ','GOOGL','AAPL','NVDA','PLTR','AMD');

UPDATE securities SET sector_id = (
  SELECT id FROM option_list WHERE type = 'sector' AND value = '금융'
) WHERE ticker IN ('316140');

UPDATE securities SET sector_id = (
  SELECT id FROM option_list WHERE type = 'sector' AND value = '경기소비재'
) WHERE ticker IN ('005380','005385','AMZN','TSLA');

UPDATE securities SET sector_id = (
  SELECT id FROM option_list WHERE type = 'sector' AND value = '필수소비재'
) WHERE ticker IN ('WMT','PG');

UPDATE securities SET sector_id = (
  SELECT id FROM option_list WHERE type = 'sector' AND value = '헬스케어'
) WHERE ticker IN ('UNH','JNJ','PFE');

UPDATE securities SET sector_id = (
  SELECT id FROM option_list WHERE type = 'sector' AND value = '산업'
) WHERE ticker IN ('UBER','GEV');

UPDATE securities SET sector_id = (
  SELECT id FROM option_list WHERE type = 'sector' AND value = '에너지'
) WHERE ticker IN ('CVX');

UPDATE securities SET sector_id = (
  SELECT id FROM option_list WHERE type = 'sector' AND value = '부동산'
) WHERE ticker IN ('O');

-- ─── 9. 64종목 style 분류 ────────────────────────────────────────────────────

-- 코인
UPDATE securities SET style_id = (
  SELECT id FROM option_list WHERE type = 'style' AND value = '코인'
) WHERE ticker IN ('DOGECOIN','RIPPLE','BITCOIN','SOLANA','ETHEREUM');

-- 현금성
UPDATE securities SET style_id = (
  SELECT id FROM option_list WHERE type = 'style' AND value = '현금성'
) WHERE ticker IN ('KRW','USD','497880');

-- 채권 ETF
UPDATE securities SET style_id = (
  SELECT id FROM option_list WHERE type = 'style' AND value = '채권'
) WHERE ticker IN ('0085P0','453850');

-- 원자재
UPDATE securities SET style_id = (
  SELECT id FROM option_list WHERE type = 'style' AND value = '원자재'
) WHERE ticker IN ('411060','261220','GLD');

-- 광범위지수
UPDATE securities SET style_id = (
  SELECT id FROM option_list WHERE type = 'style' AND value = '광범위지수'
) WHERE ticker IN ('360200','069500','379800','102110','360750','461490','SPYM','QQQ');

-- 배당
UPDATE securities SET style_id = (
  SELECT id FROM option_list WHERE type = 'style' AND value = '배당'
) WHERE ticker IN ('402970','161510','458730','SCHD');

-- 커버드콜 (TLTW: 채권 커버드콜)
UPDATE securities SET style_id = (
  SELECT id FROM option_list WHERE type = 'style' AND value = '커버드콜'
) WHERE ticker IN ('490590','JEPI','JEPQ','QQQI','TLTW');

-- 리츠
UPDATE securities SET style_id = (
  SELECT id FROM option_list WHERE type = 'style' AND value = '리츠'
) WHERE ticker IN ('476800','O');

-- 섹터테마
UPDATE securities SET style_id = (
  SELECT id FROM option_list WHERE type = 'style' AND value = '섹터테마'
) WHERE ticker IN (
  '487230','0035T0','0023A0','466920','494840',
  '0053L0','0148J0','453650','381170'
);

-- 단일종목
UPDATE securities SET style_id = (
  SELECT id FROM option_list WHERE type = 'style' AND value = '단일종목'
) WHERE ticker IN (
  '005935','316140','005380','005385',
  'NFLX','RGTI','META','CVX','AMZN','IONQ','GOOGL','AAPL',
  'NVDA','UBER','WMT','UNH','JNJ','TSLA','PLTR','PFE','AMD','GEV','PG'
);

-- ─── 10. 태그 업데이트 ────────────────────────────────────────────────────────
-- 기존 태그 모두 초기화 후 새 분류 기준으로 재설정
DELETE FROM security_tags
WHERE security_id IN (SELECT id FROM securities);

-- 지수 추종
INSERT INTO security_tags (security_id, tag)
SELECT s.id, 'S&P500' FROM securities s
WHERE s.ticker IN ('360200','379800','360750','SPYM','JEPI','453650')
ON CONFLICT (security_id, tag) DO NOTHING;

INSERT INTO security_tags (security_id, tag)
SELECT s.id, 'NASDAQ100' FROM securities s
WHERE s.ticker IN ('QQQ','JEPQ','QQQI','381170')
ON CONFLICT (security_id, tag) DO NOTHING;

INSERT INTO security_tags (security_id, tag)
SELECT s.id, 'KOSPI' FROM securities s
WHERE s.ticker IN ('069500','102110')
ON CONFLICT (security_id, tag) DO NOTHING;

INSERT INTO security_tags (security_id, tag)
SELECT s.id, '다우' FROM securities s
WHERE s.ticker IN ('402970','458730','SCHD')
ON CONFLICT (security_id, tag) DO NOTHING;

-- 테마
INSERT INTO security_tags (security_id, tag)
SELECT s.id, 'AI' FROM securities s
WHERE s.ticker IN ('487230','490590','NVDA','PLTR','AMD')
ON CONFLICT (security_id, tag) DO NOTHING;

INSERT INTO security_tags (security_id, tag)
SELECT s.id, '양자' FROM securities s
WHERE s.ticker IN ('0023A0','RGTI','IONQ')
ON CONFLICT (security_id, tag) DO NOTHING;

INSERT INTO security_tags (security_id, tag)
SELECT s.id, '로봇' FROM securities s
WHERE s.ticker IN ('0035T0','0053L0','0148J0')
ON CONFLICT (security_id, tag) DO NOTHING;

INSERT INTO security_tags (security_id, tag)
SELECT s.id, '조선' FROM securities s
WHERE s.ticker IN ('466920')
ON CONFLICT (security_id, tag) DO NOTHING;

INSERT INTO security_tags (security_id, tag)
SELECT s.id, '방산' FROM securities s
WHERE s.ticker IN ('494840')
ON CONFLICT (security_id, tag) DO NOTHING;

INSERT INTO security_tags (security_id, tag)
SELECT s.id, '반도체' FROM securities s
WHERE s.ticker IN ('NVDA','AMD')
ON CONFLICT (security_id, tag) DO NOTHING;

-- 원자재 세부
INSERT INTO security_tags (security_id, tag)
SELECT s.id, '금' FROM securities s
WHERE s.ticker IN ('411060','GLD')
ON CONFLICT (security_id, tag) DO NOTHING;

INSERT INTO security_tags (security_id, tag)
SELECT s.id, '원유' FROM securities s
WHERE s.ticker IN ('261220')
ON CONFLICT (security_id, tag) DO NOTHING;

-- 채권 세부
INSERT INTO security_tags (security_id, tag)
SELECT s.id, '국채' FROM securities s
WHERE s.ticker IN ('0085P0','453850','TLTW')
ON CONFLICT (security_id, tag) DO NOTHING;

INSERT INTO security_tags (security_id, tag)
SELECT s.id, '장기' FROM securities s
WHERE s.ticker IN ('453850','TLTW')
ON CONFLICT (security_id, tag) DO NOTHING;

INSERT INTO security_tags (security_id, tag)
SELECT s.id, '중기' FROM securities s
WHERE s.ticker IN ('0085P0')
ON CONFLICT (security_id, tag) DO NOTHING;

-- 운용 특성
INSERT INTO security_tags (security_id, tag)
SELECT s.id, 'H' FROM securities s
WHERE s.ticker IN ('453850','261220')
ON CONFLICT (security_id, tag) DO NOTHING;

-- 에너지 (섹터 태그)
INSERT INTO security_tags (security_id, tag)
SELECT s.id, '에너지' FROM securities s
WHERE s.ticker IN ('261220','CVX')
ON CONFLICT (security_id, tag) DO NOTHING;

-- 전력인프라
INSERT INTO security_tags (security_id, tag)
SELECT s.id, '전력' FROM securities s
WHERE s.ticker IN ('487230')
ON CONFLICT (security_id, tag) DO NOTHING;
