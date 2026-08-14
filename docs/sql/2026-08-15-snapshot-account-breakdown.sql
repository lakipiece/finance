-- 스냅샷에 계좌별 분해값 저장: {account_id: {value: 평가액, cost: 평균매수금액}}
-- 원장 기록 계좌(누적입금 기준)와 미기록 계좌(매수원가 폴백)를 섞어서
-- 스냅샷 목록·차트의 투자원금/수익금액을 계좌 단위로 정확히 계산하기 위함.
-- 적용 후 스냅샷 페이지에서 '값 갱신' 1회 실행 필요.

ALTER TABLE snapshots
  ADD COLUMN IF NOT EXISTS account_breakdown jsonb NOT NULL DEFAULT '{}';
