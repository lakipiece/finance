-- tangible_assets: 부동산·연금·차량 등 유형자산 마스터
-- asset_valuations: 시세 이력 (UNIQUE(asset_id, val_date) — 같은 날 재평가 시 UPSERT)
CREATE TABLE IF NOT EXISTS tangible_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  asset_type        TEXT NOT NULL DEFAULT '부동산',  -- '부동산'|'연금'|'차량'|'기타'
  description       TEXT NOT NULL DEFAULT '',
  acquired_at       DATE,
  acquisition_price BIGINT,
  acquisition_note  TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_valuations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   UUID NOT NULL REFERENCES tangible_assets(id) ON DELETE CASCADE,
  val_date   DATE NOT NULL,
  amount     BIGINT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id, val_date)
);

ALTER TABLE tangible_assets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_valuations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tangible_assets"  ON tangible_assets  FOR SELECT TO anon USING (true);
CREATE POLICY "public read asset_valuations" ON asset_valuations FOR SELECT TO anon USING (true);
