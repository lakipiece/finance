-- incomes.category CHECK를 실제 사용 범위로 정리.
-- CHECK는 4종(급여/보너스/기타/급여 외)이지만 UI 상수(INCOME_CATEGORIES)와 실데이터는 2종(급여/기타)뿐.
-- 기존 데이터: 급여 335, 기타 287 (2026-09-27 실측) — 제약 교체로 깨지는 행 없음.
BEGIN;
ALTER TABLE incomes DROP CONSTRAINT IF EXISTS incomes_category_check;
ALTER TABLE incomes ADD CONSTRAINT incomes_category_check CHECK (category IN ('급여', '기타'));
COMMIT;
