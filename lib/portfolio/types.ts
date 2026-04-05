// lib/portfolio/types.ts

export interface Account {
  id: string
  name: string
  broker: string
  owner: string | null
  type: string | null
  currency: string
}

export interface Security {
  id: string
  ticker: string
  name: string
  asset_class: string | null
  country: string | null
  style: string | null
  sector: string | null
  currency: string
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
  account_id: string
  security_id: string
  date: string
  amount: number
  currency: string
  exchange_rate: number
  notes: string | null
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
}
