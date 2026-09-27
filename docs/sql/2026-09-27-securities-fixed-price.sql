-- 고정단가: 티커가 실재하지 않는 종목(원화 RP, 예수금, 비상장 등)의 평가단가를 고정한다.
-- NULL이면 기존대로 Yahoo/CoinGecko 시세를 조회하고,
-- 값이 있으면 시세 조회를 건너뛰고 항상 이 단가로 평가한다.
-- 단위는 해당 종목의 통화 기준 (KRW 종목이면 원, USD 종목이면 달러 → 환율 환산).

ALTER TABLE securities ADD COLUMN IF NOT EXISTS fixed_price numeric;

COMMENT ON COLUMN securities.fixed_price IS
  '고정단가 — NULL이면 시세 조회, 값이 있으면 시세 조회 없이 이 단가로 평가 (종목 통화 기준)';
