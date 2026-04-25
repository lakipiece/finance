-- detail_options에 order_idx 컬럼 추가
ALTER TABLE detail_options ADD COLUMN IF NOT EXISTS order_idx INT NOT NULL DEFAULT 0;

-- 기존 데이터 초기화 (카테고리 내 이름 순으로 번호 부여)
UPDATE detail_options d
SET order_idx = (sub.rn - 1)
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY category ORDER BY name) AS rn
  FROM detail_options
) sub
WHERE d.id = sub.id;
