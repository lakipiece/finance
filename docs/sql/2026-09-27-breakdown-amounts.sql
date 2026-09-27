-- 스냅샷 분해값 정리
--
-- 1) 이중 인코딩 해제: 값 갱신이 JSON.stringify 결과를 jsonb 컬럼에 넣어
--    객체가 아니라 JSON 문자열 스칼라("{\"현금\":30.81,...}")로 저장돼 있었다.
--    → 실제 jsonb 객체로 풀어 둔다 (DB에서 키로 조회 가능).
-- 2) 섹터·자산군·태그 분해를 비중(%)에서 금액(KRW)으로.
--    %로만 저장하면 금액을 정확히 되살릴 수 없고 반올림 오차가 쌓인다.
--    화면은 읽을 때 breakdownToPct로 %를 계산한다 (lib/portfolio/metrics.ts).
--    기존 행은 % × 총평가액으로 환산 — 값 갱신을 한 번 누르면 정확한 금액으로 다시 채워진다.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.unwrap(j jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(j) = 'string' THEN (j #>> '{}')::jsonb ELSE j END
$$;

CREATE OR REPLACE FUNCTION pg_temp.pct_to_amount(j jsonb, total numeric) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_object_agg(key, round(value::numeric / 100 * total)), '{}'::jsonb)
  FROM jsonb_each_text(pg_temp.unwrap(j))
$$;

UPDATE snapshots SET
  sector_breakdown      = pg_temp.pct_to_amount(sector_breakdown, total_market_value),
  asset_class_breakdown = pg_temp.pct_to_amount(asset_class_breakdown, total_market_value),
  tag_breakdown         = pg_temp.pct_to_amount(tag_breakdown, total_market_value),
  account_breakdown     = pg_temp.unwrap(account_breakdown)
WHERE total_market_value IS NOT NULL;

COMMENT ON COLUMN snapshots.sector_breakdown      IS '섹터별 평가액 (KRW) — 비중은 화면에서 계산';
COMMENT ON COLUMN snapshots.asset_class_breakdown IS '자산군별 평가액 (KRW) — 비중은 화면에서 계산';
COMMENT ON COLUMN snapshots.tag_breakdown         IS '태그별 평가액 (KRW, 태그 중복 가능) — 비중은 화면에서 계산';

COMMIT;
