-- 월별 에너지 지출관리: 한 행 = (year, month) 단위 4종 에너지 항목 묶음
-- 단위:
--   electricity: kWh
--   water:       m3
--   hot_water:   m3
--   heating:     Gcal

CREATE TABLE IF NOT EXISTS energy_records (
  id                       BIGSERIAL PRIMARY KEY,
  year                     SMALLINT NOT NULL,
  month                    SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),

  electricity_amount       INTEGER NOT NULL DEFAULT 0,
  electricity_prev_reading NUMERIC(12,2) NOT NULL DEFAULT 0,
  electricity_curr_reading NUMERIC(12,2) NOT NULL DEFAULT 0,
  electricity_usage        NUMERIC(12,2) NOT NULL DEFAULT 0,

  water_amount             INTEGER NOT NULL DEFAULT 0,
  water_prev_reading       NUMERIC(12,2) NOT NULL DEFAULT 0,
  water_curr_reading       NUMERIC(12,2) NOT NULL DEFAULT 0,
  water_usage              NUMERIC(12,2) NOT NULL DEFAULT 0,

  hot_water_amount         INTEGER NOT NULL DEFAULT 0,
  hot_water_prev_reading   NUMERIC(12,2) NOT NULL DEFAULT 0,
  hot_water_curr_reading   NUMERIC(12,2) NOT NULL DEFAULT 0,
  hot_water_usage          NUMERIC(12,2) NOT NULL DEFAULT 0,

  heating_amount           INTEGER NOT NULL DEFAULT 0,
  heating_prev_reading     NUMERIC(12,3) NOT NULL DEFAULT 0,
  heating_curr_reading     NUMERIC(12,3) NOT NULL DEFAULT 0,
  heating_usage            NUMERIC(12,3) NOT NULL DEFAULT 0,

  memo                     TEXT NOT NULL DEFAULT '',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (year, month)
);

CREATE INDEX IF NOT EXISTS idx_energy_records_year_month ON energy_records (year, month);
