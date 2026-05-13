-- 스냅샷에 자산군/태그 비중 컬럼 분리 추가
-- 2026-05-13
--
-- 기존 sector_breakdown은 자산군과 섹터를 혼합 저장(폴백 키)했음. 차원 분리 위해:
--   asset_class_breakdown : 자산군별 비중 (주식/채권/현금/코인/대체자산/부동산)
--   sector_breakdown      : GICS 섹터 비중만 (개별 주식 한정, 합계 != 100)
--   tag_breakdown         : 태그별 비중 (한 종목이 여러 태그 가능, 합계 >= 100)
--
-- 본 마이그레이션은 컬럼만 추가하고 데이터 채움은 refresh-values API 호출로 처리.

ALTER TABLE snapshots
  ADD COLUMN IF NOT EXISTS asset_class_breakdown jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tag_breakdown jsonb DEFAULT '{}'::jsonb;
