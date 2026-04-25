CREATE TABLE IF NOT EXISTS pension_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pension_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pension_asset_id UUID NOT NULL REFERENCES pension_assets(id) ON DELETE CASCADE,
  snapshot_date    DATE NOT NULL,
  amount           BIGINT NOT NULL,
  note             TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pension_asset_id, snapshot_date)
);
