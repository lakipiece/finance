-- 인컴 종류: 배당 / 이자 / 분배금
-- 예금·RP의 이자를 배당과 같은 원장(dividends)에 기록하되 성격을 구분한다.
-- dividends.security_id는 이미 nullable — 종목 없는 계좌 단위 이자도 기록 가능.

INSERT INTO option_list (type, label, value, sort_order, color_hex)
VALUES ('income_type', '배당',   '배당',   10, NULL),
       ('income_type', '이자',   '이자',   20, NULL),
       ('income_type', '분배금', '분배금', 30, NULL)
ON CONFLICT (type, value) DO NOTHING;

ALTER TABLE dividends ADD COLUMN IF NOT EXISTS income_type_id uuid REFERENCES option_list(id);

-- 기존 데이터는 전부 배당
UPDATE dividends
SET income_type_id = (SELECT id FROM option_list WHERE type = 'income_type' AND value = '배당')
WHERE income_type_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_dividends_income_type ON dividends (income_type_id);
