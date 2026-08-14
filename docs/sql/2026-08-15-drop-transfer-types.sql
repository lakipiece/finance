-- 이체입금/이체출금 유형 제거 — 계좌 간 이동은 출금+입금으로 기록 (계산 동일)
-- 기존 이체 행은 입금/출금으로 전환 후 CHECK 제약을 3종으로 축소.

UPDATE account_cashflows SET type = 'deposit'    WHERE type = 'transfer_in';
UPDATE account_cashflows SET type = 'withdrawal' WHERE type = 'transfer_out';

ALTER TABLE account_cashflows DROP CONSTRAINT account_cashflows_type_check;
ALTER TABLE account_cashflows ADD CONSTRAINT account_cashflows_type_check
  CHECK (type IN ('deposit', 'withdrawal', 'opening'));
