-- 포트폴리오 태그/섹터 일괄 정리
-- 2026-05-13
--
-- 정책:
--   1. 섹터: GICS 11 표준 (정보기술/커뮤니케이션서비스/금융/헬스케어/경기소비재/필수소비재/산업재/에너지/소재/유틸리티/부동산)
--   2. 개별 주식만 섹터 부여, ETF/채권/현금/코인은 sector=NULL → 태그로 분류
--   3. 태그는 평면(flat). 컨벤션: 인덱스(S&P500, NASDAQ100, 다우존스, KOSPI200), 테마(AI, 양자, 로봇, 휴머노이드, 반도체, 방산, 조선, 전력), 특성(국채, 단기/중기/장기, 헤지, 커버드콜, 배당), 원자재(금, 원유), 지역(미국, 한국, 글로벌, 중국), 자산종류(리츠, 현금, 코인, 혼합, 현금성)
--
-- 본 스크립트는 멱등하게 동작하도록 작성됨.

BEGIN;

-- ─── 1. sector 옵션 표준화 ────────────────────────────────────────────────
-- 1-1. 커뮤니케이션서비스 추가
INSERT INTO option_list (type, label, value, sort_order) VALUES
  ('sector', '커뮤니케이션서비스', '커뮤니케이션서비스', 12)
ON CONFLICT (type, value) DO NOTHING;

-- 1-2. 정보기술 추가 (없으면)
INSERT INTO option_list (type, label, value, sort_order) VALUES
  ('sector', '정보기술', '정보기술', 8)
ON CONFLICT (type, value) DO NOTHING;

-- 1-3. "테크" → "정보기술"로 이전 후 "테크" 삭제
UPDATE securities SET sector_id = (SELECT id FROM option_list WHERE type='sector' AND value='정보기술')
  WHERE sector_id IN (SELECT id FROM option_list WHERE type='sector' AND value='테크');
DELETE FROM option_list WHERE type='sector' AND value='테크';

-- 1-4. "산업" → "산업재"로 이전 후 "산업" 삭제
UPDATE securities SET sector_id = (SELECT id FROM option_list WHERE type='sector' AND value='산업재')
  WHERE sector_id IN (SELECT id FROM option_list WHERE type='sector' AND value='산업');
DELETE FROM option_list WHERE type='sector' AND value='산업';

-- 1-5. 사실상 태그/자산군에 속하는 잘못된 섹터 일괄 삭제 (모두 미사용)
DELETE FROM option_list WHERE type='sector' AND value IN (
  '리츠','예금/CMA','미국채권','소비재','대체자산','양자','IT','통신',
  'S&P500','안전자산','KOSPI','기타','로봇','조선','한국전체','방산','금','미국전체'
);

-- 1-6. GICS 누락 섹터 추가 + 정렬 정리
INSERT INTO option_list (type, label, value, sort_order) VALUES
  ('sector', '에너지',           '에너지',           1),
  ('sector', '소재',             '소재',             2),
  ('sector', '산업재',           '산업재',           3),
  ('sector', '경기소비재',       '경기소비재',       4),
  ('sector', '필수소비재',       '필수소비재',       5),
  ('sector', '헬스케어',         '헬스케어',         6),
  ('sector', '금융',             '금융',             7),
  ('sector', '정보기술',         '정보기술',         8),
  ('sector', '커뮤니케이션서비스','커뮤니케이션서비스',9),
  ('sector', '유틸리티',         '유틸리티',         10),
  ('sector', '부동산',           '부동산',           11)
ON CONFLICT (type, value) DO UPDATE SET sort_order = EXCLUDED.sort_order, label = EXCLUDED.label;

-- ─── 2. 개별 주식 섹터 재지정 (GICS 정확화) ────────────────────────────────
-- GOOGL/META/NFLX는 GICS상 커뮤니케이션서비스
UPDATE securities SET sector_id = (SELECT id FROM option_list WHERE type='sector' AND value='커뮤니케이션서비스')
  WHERE ticker IN ('GOOGL','META','NFLX');

-- 인덱스/테마 ETF의 sector는 NULL로 통일 (예외: 명시적 섹터 ETF는 보존)
UPDATE securities SET sector_id = NULL WHERE ticker IN ('381170');

-- ─── 3. 태그 일괄 재설정 ──────────────────────────────────────────────────
DELETE FROM security_tags
  WHERE security_id IN (SELECT id FROM securities);

WITH new_tags(ticker, tag) AS (VALUES
  -- 한국 ETF
  ('0023A0', '양자'), ('0023A0', '미국'),
  ('0035T0', '로봇'), ('0035T0', '휴머노이드'), ('0035T0', '글로벌'),
  ('0053L0', '로봇'), ('0053L0', '휴머노이드'), ('0053L0', '중국'),
  ('0085P0', '국채'), ('0085P0', '중기'), ('0085P0', '미국'),
  ('0148J0', '로봇'), ('0148J0', '휴머노이드'), ('0148J0', '한국'),
  ('069500', 'KOSPI200'), ('069500', '한국'),
  ('102110', 'KOSPI200'), ('102110', '한국'),
  ('161510', '배당'), ('161510', '한국'),
  ('261220', '원유'), ('261220', '헤지'),
  ('360200', 'S&P500'), ('360200', '미국'),
  ('360750', 'S&P500'), ('360750', '미국'),
  ('379800', 'S&P500'), ('379800', '미국'),
  ('381170', 'NASDAQ100'), ('381170', '미국'), ('381170', '정보기술'),
  ('402970', '다우존스'), ('402970', '미국'), ('402970', '배당'),
  ('411060', '금'),
  ('453650', 'S&P500'), ('453650', '미국'), ('453650', '금융'),
  ('453850', '국채'), ('453850', '장기'), ('453850', '헤지'), ('453850', '미국'),
  ('458730', '다우존스'), ('458730', '미국'), ('458730', '배당'),
  ('461490', '글로벌'), ('461490', '혼합'),
  ('466920', '조선'), ('466920', '한국'),
  ('476800', '리츠'), ('476800', '한국'),
  ('487230', 'AI'), ('487230', '전력'), ('487230', '미국'),
  ('490590', 'AI'), ('490590', '미국'), ('490590', '커버드콜'),
  ('494840', '방산'), ('494840', '미국'),
  ('497880', '현금성'), ('497880', '한국'),
  -- 미국 ETF
  ('GLD',   '금'),
  ('JEPI',  'S&P500'), ('JEPI', '미국'), ('JEPI', '커버드콜'), ('JEPI', '배당'),
  ('JEPQ',  'NASDAQ100'), ('JEPQ', '미국'), ('JEPQ', '커버드콜'), ('JEPQ', '배당'),
  ('QQQ',   'NASDAQ100'), ('QQQ', '미국'),
  ('QQQI',  'NASDAQ100'), ('QQQI', '미국'), ('QQQI', '커버드콜'), ('QQQI', '배당'),
  ('SCHD',  '다우존스'), ('SCHD', '미국'), ('SCHD', '배당'),
  ('SPYM',  'S&P500'), ('SPYM', '미국'),
  ('TLTW',  '국채'), ('TLTW', '장기'), ('TLTW', '미국'), ('TLTW', '커버드콜'),
  -- 미국 개별 주식
  ('AAPL',  '미국'),
  ('AMD',   'AI'), ('AMD', '반도체'), ('AMD', '미국'),
  ('AMZN',  '미국'),
  ('CVX',   '미국'),
  ('GEV',   '전력'), ('GEV', '미국'),
  ('GOOGL', '미국'),
  ('IONQ',  '양자'), ('IONQ', '미국'),
  ('JNJ',   '미국'),
  ('META',  '미국'),
  ('NFLX',  '미국'),
  ('NVDA',  'AI'), ('NVDA', '반도체'), ('NVDA', '미국'),
  ('O',     '미국'), ('O', '리츠'), ('O', '배당'),
  ('PFE',   '미국'),
  ('PG',    '미국'),
  ('PLTR',  'AI'), ('PLTR', '미국'),
  ('RGTI',  '양자'), ('RGTI', '미국'),
  ('TSLA',  '미국'),
  ('UBER',  '미국'),
  ('UNH',   '미국'),
  ('WMT',   '미국'),
  -- 한국 개별 주식
  ('005380', '한국'),
  ('005385', '한국'),
  ('005935', '반도체'), ('005935', '한국'),
  ('316140', '한국'),
  -- 코인
  ('BITCOIN',  '코인'),
  ('DOGECOIN', '코인'),
  ('ETHEREUM', '코인'),
  ('RIPPLE',   '코인'),
  ('SOLANA',   '코인'),
  -- 현금
  ('KRW', '현금'),
  ('USD', '현금')
)
INSERT INTO security_tags (security_id, tag)
SELECT s.id, nt.tag
FROM new_tags nt
JOIN securities s ON s.ticker = nt.ticker
ON CONFLICT (security_id, tag) DO NOTHING;

COMMIT;

-- 검증 쿼리 (실행 후 확인용):
-- SELECT s.ticker, s.name, o.value AS sector,
--   (SELECT string_agg(tag, ',' ORDER BY tag) FROM security_tags WHERE security_id=s.id) AS tags
-- FROM securities s LEFT JOIN option_list o ON s.sector_id=o.id
-- ORDER BY s.ticker;
