-- 미사용 스키마 정리 (실행 전 반드시 내용 확인!)
-- 근거: docs/project-overview.md 8.2절 + 입출금 원장 설계(2026-08-14-account-cashflows-design.md)
-- 2026-08-14 기준 전부 0행 확인 완료.

-- 1) 건별 매도 실현손익 (입출금 원장으로 대체, UI 없음, 0행)
DROP TABLE IF EXISTS sells;

-- 2) 매수/매도 원장 (한 번도 사용 안 됨, 0행)
DROP TABLE IF EXISTS portfolio_transactions;

-- 3) 구 가격 캐시 (price_history로 대체, 0행)
DROP TABLE IF EXISTS price_cache;

-- 4) 지출 세부 메모 (UI 미연결, 0행) — API의 memos 처리 로직도 함께 제거됨
DROP TABLE IF EXISTS expense_memos;

-- 5) snapshot_id 없는 고아 holdings (구 import 기능의 잔재, 어떤 화면에도 표시 안 됨)
--    2026-08-14 기준 60행. 필요하면 아래 SELECT로 먼저 확인:
--    SELECT count(*) FROM holdings WHERE snapshot_id IS NULL;
DELETE FROM holdings WHERE snapshot_id IS NULL;
