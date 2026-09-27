-- 미수이자(accrual): 예금·RP처럼 만기까지 이자가 쌓이는 종목의 평가단가를 경과일만큼 불린다.
-- 평가단가 = 고정단가 × (1 + annual_rate × 경과일 / 365)   ← 예금 관례대로 단리
-- 경과일 기산점 = max(accrual_start, 해당 종목의 마지막 이자 지급일)
--   → dividends에 이자를 기록하면 미수이자가 리셋되어 이중 계상되지 않는다.

ALTER TABLE securities ADD COLUMN IF NOT EXISTS annual_rate   numeric;  -- 연이율 (0.035 = 3.5%)
ALTER TABLE securities ADD COLUMN IF NOT EXISTS accrual_start date;     -- 이자 기산일
ALTER TABLE securities ADD COLUMN IF NOT EXISTS maturity_date date;     -- 만기일 (이후 이자 정지)

COMMENT ON COLUMN securities.annual_rate   IS '연이율 (0.035 = 3.5%) — NULL이면 미수이자 계산 안 함';
COMMENT ON COLUMN securities.accrual_start IS '이자 기산일 — 마지막 이자 지급 기록이 있으면 그쪽이 우선';
COMMENT ON COLUMN securities.maturity_date IS '만기일 — 이 날짜 이후로는 이자가 더 붙지 않음';
