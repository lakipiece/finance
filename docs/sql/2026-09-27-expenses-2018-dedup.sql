-- ⚠ 수동 적용 전용 — 라이브 지출 데이터를 삭제한다. 아래 백업 명령을 먼저 실행할 것.
--
-- 2018 가계부 시트는 2018-04-05 ~ 2019-04 까지 이어져 있었고, 그 2019년 1~4월분이
-- 2019 시트와 이중으로 가져와졌다 (year=2018 라벨 + 2019년 날짜, 415건 · 약 6천만 원).
--   413건: 2019 시트에 같은 날짜·금액 행이 존재 (그중 353건은 카테고리까지 동일)
--     2건: 같은 날 2019 시트에 할인 후 금액으로 기록 (573,500→483,000, 1,495,000→1,440,000)
-- 원인: app/api/sheets 의 fallback 날짜 파싱이 시트 연도를 검증하지 않음 (같은 커밋에서 수정).
--
-- 적용 전 백업 (서버에서):
--   docker exec -i finance-db-1 psql -U finance -d finance -c "\copy (SELECT * FROM expenses WHERE year = 2018 AND EXTRACT(year FROM expense_date) = 2019 ORDER BY expense_date, id) TO STDOUT WITH CSV HEADER" > ~/backup/expenses_2018_dup_20260927.csv

BEGIN;

DELETE FROM expenses
WHERE year = 2018 AND EXTRACT(year FROM expense_date) = 2019;

-- 2021년 12월 라벨인데 날짜만 2022-12-28로 오기된 1건 → 2021-12-28
UPDATE expenses SET expense_date = '2021-12-28'
WHERE id = 21915 AND year = 2021 AND month = 12 AND expense_date = '2022-12-28';

COMMIT;
