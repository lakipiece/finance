-- Migration: option_list FK 도입
-- accounts.type, accounts.currency → type_id, currency_id (FK → option_list.id)
-- securities.asset_class, .country, .sector, .currency → *_id FK

-- ─── 1. 누락된 option_list 값 추가 ─────────────────────────────────────────

-- account_type
INSERT INTO option_list (type, label, value, sort_order)
VALUES ('account_type', '종합위탁', '종합위탁', 10)
ON CONFLICT (type, value) DO NOTHING;

-- asset_class
INSERT INTO option_list (type, label, value, sort_order)
VALUES ('asset_class', '대체자산', '대체자산', 10)
ON CONFLICT (type, value) DO NOTHING;

-- sector (securities에 있는 값 중 option_list에 없는 것들)
INSERT INTO option_list (type, label, value, sort_order) VALUES
  ('sector', '미국전체', '미국전체', 10),
  ('sector', '테크', '테크', 11),
  ('sector', '한국전체', '한국전체', 12),
  ('sector', '경기소비재', '경기소비재', 13),
  ('sector', '필수소비재', '필수소비재', 14),
  ('sector', '산업', '산업', 15),
  ('sector', '부동산', '부동산', 16),
  ('sector', '리츠', '리츠', 17),
  ('sector', '금', '금', 18),
  ('sector', '방산', '방산', 19),
  ('sector', '조선', '조선', 20),
  ('sector', '로봇', '로봇', 21),
  ('sector', '양자', '양자', 22),
  ('sector', '대체자산', '대체자산', 23),
  ('sector', '미국채권', '미국채권', 24),
  ('sector', '예금/CMA', '예금/CMA', 25),
  ('sector', '안전자산', '안전자산', 26)
ON CONFLICT (type, value) DO NOTHING;

-- ─── 2. FK 컬럼 추가 ─────────────────────────────────────────────────────────

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS type_id     uuid REFERENCES option_list(id);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency_id  uuid REFERENCES option_list(id);

ALTER TABLE securities ADD COLUMN IF NOT EXISTS asset_class_id uuid REFERENCES option_list(id);
ALTER TABLE securities ADD COLUMN IF NOT EXISTS country_id     uuid REFERENCES option_list(id);
ALTER TABLE securities ADD COLUMN IF NOT EXISTS sector_id      uuid REFERENCES option_list(id);
ALTER TABLE securities ADD COLUMN IF NOT EXISTS currency_id    uuid REFERENCES option_list(id);

-- ─── 3. 기존 텍스트 값 → FK 매핑 ──────────────────────────────────────────

UPDATE accounts a
SET type_id = o.id
FROM option_list o
WHERE o.type = 'account_type' AND o.value = a.type;

UPDATE accounts a
SET currency_id = o.id
FROM option_list o
WHERE o.type = 'currency' AND o.value = a.currency;

UPDATE securities s
SET asset_class_id = o.id
FROM option_list o
WHERE o.type = 'asset_class' AND o.value = s.asset_class;

UPDATE securities s
SET country_id = o.id
FROM option_list o
WHERE o.type = 'country' AND o.value = s.country;

UPDATE securities s
SET sector_id = o.id
FROM option_list o
WHERE o.type = 'sector' AND o.value = s.sector;

UPDATE securities s
SET currency_id = o.id
FROM option_list o
WHERE o.type = 'currency' AND o.value = s.currency;

-- ─── 4. 기존 텍스트 컬럼 삭제 ────────────────────────────────────────────────

ALTER TABLE accounts   DROP COLUMN IF EXISTS type;
ALTER TABLE accounts   DROP COLUMN IF EXISTS currency;

ALTER TABLE securities DROP COLUMN IF EXISTS asset_class;
ALTER TABLE securities DROP COLUMN IF EXISTS country;
ALTER TABLE securities DROP COLUMN IF EXISTS sector;
ALTER TABLE securities DROP COLUMN IF EXISTS currency;
