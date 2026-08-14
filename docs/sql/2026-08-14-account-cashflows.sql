-- 계좌 입출금 원장: 실질 투자수익 산출용
-- 실질수익 = 평가액 + Σ출금 − Σ입금

CREATE TABLE IF NOT EXISTS account_cashflows (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  flow_date  date NOT NULL,
  type       text NOT NULL CHECK (type IN ('deposit','withdrawal','transfer_in','transfer_out','opening')),
  amount     numeric NOT NULL CHECK (amount > 0),   -- KRW, 항상 양수 (방향은 type이 결정)
  memo       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_cashflows_account_date
  ON account_cashflows (account_id, flow_date);
CREATE INDEX IF NOT EXISTS idx_account_cashflows_date
  ON account_cashflows (flow_date);
