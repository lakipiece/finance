-- 가계부 옵션 테이블: 사용자, 결제수단, 세부유형
CREATE TABLE IF NOT EXISTS members (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b'
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  order_idx INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS detail_options (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(name, category)
);

INSERT INTO members (code, display_name, color) VALUES
  ('L', 'L', '#1565C0'),
  ('P', 'P', '#AD1457')
ON CONFLICT (code) DO NOTHING;

INSERT INTO payment_methods (name, order_idx) VALUES
  ('카드', 1), ('현금', 2), ('지역화폐', 3)
ON CONFLICT (name) DO NOTHING;
