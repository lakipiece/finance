-- 조회 성능 인덱스 (project-overview.md 개선점 #16)

CREATE INDEX IF NOT EXISTS idx_expenses_year_month ON expenses (year, month);
CREATE INDEX IF NOT EXISTS idx_expenses_category   ON expenses (category);
CREATE INDEX IF NOT EXISTS idx_incomes_year_month  ON incomes (year, month);
CREATE INDEX IF NOT EXISTS idx_holdings_snapshot   ON holdings (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_price_history_ticker_date_desc ON price_history (ticker, date DESC);
CREATE INDEX IF NOT EXISTS idx_dividends_paid_at   ON dividends (paid_at);
