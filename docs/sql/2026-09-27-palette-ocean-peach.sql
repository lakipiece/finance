-- 2026-09-27 색상 재정비 — F · 오션 & 피치 팔레트로 저장된 색 이전
-- 네이비 기준 10색: 네이비·오션·로즈·피스타치오·데님·크림옐로·슬레이트·피치·아쿠아·살몬
-- 10번째 이후 항목은 lib/palettes.ts chartSeriesColor 규칙대로 한 단 밝힌 색.

BEGIN;

-- 가계부 카테고리
UPDATE categories SET color = CASE name
  WHEN '고정비'     THEN '#1A237E'  -- 네이비
  WHEN '대출상환'   THEN '#4B6584'  -- 슬레이트
  WHEN '변동비'     THEN '#3A9AB2'  -- 오션
  WHEN '여행공연비' THEN '#C99BB5'  -- 로즈
  ELSE color END;

-- 세부 항목 점은 소속 카테고리 색을 따른다
UPDATE detail_options d SET color = c.color
  FROM categories c WHERE d.category = c.name;

-- 사용자
UPDATE members SET color = CASE code
  WHEN 'L' THEN '#C99BB5'  -- 로즈
  WHEN 'P' THEN '#6C8EBF'  -- 데님
  ELSE color END;

-- 결제수단 · 포트폴리오 옵션 — 표시 순서대로 팔레트 배정
WITH palette(idx, hex) AS (
  SELECT * FROM unnest(
    ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
    ARRAY['#1A237E','#3A9AB2','#C99BB5','#A9CFA6','#6C8EBF','#F2C57C','#4B6584','#F4A582','#8FBCD4','#E2786B',
          '#434B95','#5DACC0','#D3ADC2','#B8D8B6','#86A2CB','#F4CF94','#6B819A','#F6B599','#A3C8DC','#E79086']
  )
),
pm AS (
  SELECT id, ((ROW_NUMBER() OVER (ORDER BY order_idx, id) - 1) % 20) + 1 AS idx FROM payment_methods
)
UPDATE payment_methods p SET color = palette.hex
  FROM pm JOIN palette USING (idx) WHERE p.id = pm.id;

WITH palette(idx, hex) AS (
  SELECT * FROM unnest(
    ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
    ARRAY['#1A237E','#3A9AB2','#C99BB5','#A9CFA6','#6C8EBF','#F2C57C','#4B6584','#F4A582','#8FBCD4','#E2786B',
          '#434B95','#5DACC0','#D3ADC2','#B8D8B6','#86A2CB','#F4CF94','#6B819A','#F6B599','#A3C8DC','#E79086']
  )
),
ol AS (
  SELECT id, ((ROW_NUMBER() OVER (PARTITION BY type ORDER BY sort_order, created_at, id) - 1) % 20) + 1 AS idx FROM option_list
)
UPDATE option_list o SET color_hex = palette.hex
  FROM ol JOIN palette USING (idx) WHERE o.id = ol.id;

COMMIT;
