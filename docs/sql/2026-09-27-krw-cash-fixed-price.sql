-- 현금 자산군 가격 규칙 정리
--
-- 기존: 자산군이 '현금'이고 통화가 KRW면 Yahoo 조회를 건너뛰고 매일 1원으로 기록했다.
--   → 현금성 ETF(497880 SOL CD금리&머니마켓액티브)까지 1원으로 기록되고,
--     실제 평가는 '.KS' 키의 2026-05-01 가격에 5개월간 멈춰 있었다.
-- 변경: 실제 원화 현금(ticker 'KRW')만 고정단가 1원. 자산군은 가격 규칙에 관여하지 않는다.
--   USD 현금은 기존대로 'USD' 티커에 환율을 기록하는 alias로 평가.

UPDATE securities SET fixed_price = 1 WHERE ticker = 'KRW' AND fixed_price IS NULL;

-- 현금성 ETF에 잘못 기록된 1원 행 제거 (bare 티커로 저장된 값). 이후 '.KS'로 재수집한다.
DELETE FROM price_history WHERE ticker = '497880' AND price = 1;
