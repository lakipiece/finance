// lib/portfolio/types.ts

export interface Account {
  id: string
  name: string
  broker: string
  owner: string | null
  type_id: string | null
  currency_id: string | null
  dividend_eligible: boolean
  dividend_tax_rate: number | null
  // resolved via JOIN from option_list
  type: string | null
  currency: string
}

export interface Security {
  id: string
  ticker: string
  name: string
  asset_class_id: string | null
  country_id: string | null
  sector_id: string | null
  currency_id: string | null
  style: string | null
  url: string | null
  memo: string | null
  // resolved via JOIN from option_list
  asset_class: string | null
  country: string | null
  sector: string | null
  currency: string
  tags?: string[]
}

export interface Holding {
  id: string
  account_id: string
  security_id: string
  quantity: number
  avg_price: number | null
  total_invested: number | null
  snapshot_date: string
  source: string
  snapshot_id?: string | null
  account?: Account
  security?: Security
}

export interface PortfolioTransaction {
  id: string
  account_id: string
  security_id: string
  type: 'buy' | 'sell'
  date: string
  quantity: number
  price_per_unit: number
  currency: string
  exchange_rate: number
  fees: number
  notes: string | null
}

export interface Dividend {
  id: string
  security_id: string
  account_id: string
  paid_at: string
  amount: number
  currency: string
  exchange_rate: number
  tax: number
  memo: string | null
  security?: Security
  account?: Account
}

export interface TargetAllocation {
  id: string
  level: 'asset_class' | 'sector' | 'ticker'
  key: string
  target_pct: number
}

export interface PortfolioPosition {
  security: Security
  account: Account
  quantity: number
  avg_price: number        // KRW 환산
  avg_price_usd: number | null  // USD 원본 (US 종목만)
  current_price_usd: number | null  // USD 현재가 (US 종목만)
  total_invested: number   // KRW
  current_price: number    // KRW 환산
  market_value: number
  unrealized_pnl: number
  unrealized_pct: number
  total_dividends: number
}

export interface PortfolioSummary {
  total_market_value: number
  total_invested: number
  total_unrealized_pnl: number
  total_unrealized_pct: number
  total_dividends: number
  positions: PortfolioPosition[]
  last_price_updated_at: string | null  // price_history 최신 레코드의 date
}

export interface Snapshot {
  id: string
  date: string
  memo: string | null
  created_at: string
}

export interface Sell {
  id: string
  snapshot_id: string | null
  security_id: string
  account_id: string
  sold_at: string
  quantity: number
  avg_cost_krw: number | null
  sell_price_krw: number | null
  realized_pnl_krw: number | null
  memo: string | null
  security?: Security
  account?: Account
}

export interface SnapshotWithStats {
  snapshot: Snapshot
  total_market_value: number
  prev_market_value: number | null
}
