-- 전월/당월 지침 컬럼 제거 (사용량만 직접 입력)
ALTER TABLE energy_records
  DROP COLUMN IF EXISTS electricity_prev_reading,
  DROP COLUMN IF EXISTS electricity_curr_reading,
  DROP COLUMN IF EXISTS water_prev_reading,
  DROP COLUMN IF EXISTS water_curr_reading,
  DROP COLUMN IF EXISTS hot_water_prev_reading,
  DROP COLUMN IF EXISTS hot_water_curr_reading,
  DROP COLUMN IF EXISTS heating_prev_reading,
  DROP COLUMN IF EXISTS heating_curr_reading;
