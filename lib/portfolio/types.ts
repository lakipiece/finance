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
  style_id: string | null
  currency_id: string | null
  style: string | null
  url: string | null
  memo: string | null
  // resolved via JOIN from option_list
  asset_class: string | null
  country: string | null
  sector: string | null
  etf_style: string | null  // style 차원 (style 텍스트 필드와 구분)
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

export type CashflowType = 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'opening'

export interface Cashflow {
  id: string
  account_id: string
  flow_date: string
  type: CashflowType
  amount: number
  memo: string
  account?: Pick<Account, 'name' | 'broker' | 'owner'>
}

/** type별 집계 방향: 입금(+) / 출금(−) */
export const CASHFLOW_INFLOW_TYPES: CashflowType[] = ['deposit', 'transfer_in', 'opening']

export const CASHFLOW_TYPE_LABELS: Record<CashflowType, string> = {
  deposit: '입금',
  withdrawal: '출금',
  transfer_in: '이체입금',
  transfer_out: '이체출금',
  opening: '기초잔액',
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
  level: 'asset_class' | 'country' | 'style' | 'sector' | 'ticker'
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

export interface SnapshotWithStats {
  snapshot: Snapshot
  total_market_value: number
  prev_market_value: number | null
}
