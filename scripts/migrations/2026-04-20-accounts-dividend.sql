-- 2026-04-20 accounts 테이블에 배당 관련 컬럼 추가
-- idempotent: 여러 번 실행해도 안전

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS dividend_eligible  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dividend_tax_rate  numeric(5,2);

-- 유형/브로커 기반 초기 세율
-- option_list 에서 type_id 로 '연금저축', 'ISA' 를 역조회
UPDATE accounts a
SET dividend_tax_rate = 5.50
FROM option_list o
WHERE a.type_id = o.id AND o.value = '연금저축' AND a.dividend_tax_rate IS NULL;

UPDATE accounts a
SET dividend_tax_rate = 9.90
FROM option_list o
WHERE a.type_id = o.id AND o.value = 'ISA' AND a.dividend_tax_rate IS NULL;

UPDATE accounts
SET dividend_tax_rate = 15.00
WHERE broker = '카카오페이' AND dividend_tax_rate IS NULL;

UPDATE accounts
SET dividend_tax_rate = 15.40
WHERE dividend_tax_rate IS NULL;
