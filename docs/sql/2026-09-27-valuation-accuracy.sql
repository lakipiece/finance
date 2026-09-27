-- 평가 정확성 개선
--
-- 1) holdings.avg_fx_rate — USD 종목의 평균 매입환율.
--    지금까지 USD 종목의 평균매수금액은 "조회 시점 환율"로 환산돼 환율만 움직여도 원가가 변했다.
--    값이 있으면 avg_price × avg_fx_rate 로 원가를 고정하고, 없으면 기존처럼 조회 시점 환율로 폴백.
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS avg_fx_rate numeric;
COMMENT ON COLUMN holdings.avg_fx_rate IS 'USD 종목 평균 매입환율 (KRW/USD) — NULL이면 평가 시점 환율로 원가 환산';

-- 2) snapshots.unpriced_tickers — 값 갱신 시 가격을 찾지 못한 종목.
--    미래 가격 fallback을 제거했으므로, 가격이 없는 종목은 평균단가로 임시 평가하되
--    조용히 넘어가지 않고 목록을 남겨 화면에 "미평가 N종목"으로 노출한다.
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS unpriced_tickers text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN snapshots.unpriced_tickers IS '값 갱신 시 스냅샷 날짜 이전 가격이 없어 평균단가로 임시 평가한 종목 티커';
