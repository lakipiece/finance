-- option_list: 드롭다운 옵션 관리
CREATE TABLE IF NOT EXISTS option_list (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL,
  label      text NOT NULL,
  value      text NOT NULL,
  color_hex  text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (type, value)
);

INSERT INTO option_list (type, label, value, color_hex, sort_order) VALUES
  ('account_type', 'CMA',    'CMA',    '#10b981', 0),
  ('account_type', 'ISA',    'ISA',    '#3b82f6', 1),
  ('account_type', 'IRP',    'IRP',    '#8b5cf6', 2),
  ('account_type', '증권',   '증권',   '#f59e0b', 3),
  ('account_type', '은행',   '은행',   '#64748b', 4),
  ('account_type', '연금저축','연금저축','#ec4899', 5),
  ('country', '국내',   '국내',   '#10b981', 0),
  ('country', '미국',   '미국',   '#3b82f6', 1),
  ('country', '글로벌', '글로벌', '#f59e0b', 2),
  ('country', '기타',   '기타',   '#94a3b8', 3),
  ('currency', 'KRW', 'KRW', '#10b981', 0),
  ('currency', 'USD', 'USD', '#3b82f6', 1),
  ('asset_class', '주식', '주식', '#3b82f6', 0),
  ('asset_class', '채권', '채권', '#8b5cf6', 1),
  ('asset_class', '현금', '현금', '#14b8a6', 2),
  ('asset_class', '코인', '코인', '#f97316', 3),
  ('sector', 'IT',      'IT',      '#6366f1', 0),
  ('sector', '금융',    '금융',    '#f59e0b', 1),
  ('sector', '헬스케어','헬스케어','#10b981', 2),
  ('sector', '소비재',  '소비재',  '#ec4899', 3),
  ('sector', '에너지',  '에너지',  '#ef4444', 4),
  ('sector', '산업재',  '산업재',  '#64748b', 5),
  ('sector', '기타',    '기타',    '#94a3b8', 6)
ON CONFLICT (type, value) DO NOTHING;

-- 계좌 표시 순서
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

-- 스냅샷 평가액 캐시
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS total_market_value numeric;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS total_invested     numeric;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS sector_breakdown   jsonb;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS value_updated_at   timestamptz;
