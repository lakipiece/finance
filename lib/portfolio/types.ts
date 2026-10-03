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
  /** 보관 시각 — 있으면 관리 목록·선택지에서 숨김 (이력·평가에는 유지) */
  archived_at?: string | null
  /** 계좌 메모 — 계좌명 툴팁으로 표시 */
  memo?: string | null
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
  /** 고정단가 — 설정 시 시세를 조회하지 않고 항상 이 단가로 평가 (종목 통화 기준) */
  fixed_price: number | null
  /** 연이율 (0.035 = 3.5%) — 설정 시 경과일만큼 미수이자를 평가단가에 얹는다 */
  annual_rate: number | null
  /** 이자 기산일 */
  accrual_start: string | null
  /** 만기일 — 이후로는 이자가 붙지 않는다 */
  maturity_date: string | null
  /** 보관 시각 — 있으면 관리 목록·선택지에서 숨김 (이력·평가에는 유지) */
  archived_at?: string | null
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
  /** USD 종목 평균 매입환율 — 있으면 원가를 이 환율로 고정 */
  avg_fx_rate: number | null
  total_invested: number | null
  snapshot_date: string
  source: string
  snapshot_id?: string | null
  account?: Account
  security?: Security
}

export type CashflowType = 'deposit' | 'withdrawal' | 'opening'

export interface Cashflow {
  id: string
  account_id: string
  flow_date: string
  type: CashflowType
  amount: number
  memo: string
  account?: Pick<Account, 'name' | 'broker' | 'owner'>
}

/** type별 집계 방향: 입금(+) / 출금(−). 계좌 간 이체는 출금+입금 쌍으로 기록. */
export const CASHFLOW_INFLOW_TYPES: CashflowType[] = ['deposit', 'opening']

export const CASHFLOW_TYPE_LABELS: Record<CashflowType, string> = {
  deposit: '입금',
  withdrawal: '출금',
  opening: '기초잔액',
}

export interface Dividend {
  id: string
  /** 계좌 단위 이자는 종목 없이 기록될 수 있다 */
  security_id: string | null
  income_type_id: string | null
  /** option_list에서 JOIN — 배당 / 이자 / 분배금 */
  income_type: string | null
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

/**
 * 계좌별 입출금 원장 합계.
 * 지표 흐름 (docs/plans/2026-08-14-account-cashflows-design.md):
 *   투자원금     = 누적입금 (inflow)
 *   평균매수금액 = Σ(수량 × 평균매수단가)  ← positions의 total_invested
 *   평가손익     = 평가금액 − 평균매수금액
 *   수익금액     = 평가금액 + 누적출금 − 누적입금
 */
export interface AccountCashflowSum {
  account_id: string
  inflow: number   // 입금 + 이체입금 + 기초잔액
  outflow: number  // 출금 + 이체출금 (배당 인출 포함)
}

export interface PortfolioSummary {
  total_market_value: number
  /** 평균매수금액 합계 (Σ 수량×평균매수단가, KRW) — 평가손익의 기준 */
  total_invested: number
  total_unrealized_pnl: number
  total_unrealized_pct: number
  total_dividends: number
  /** 입출금 원장이 기록된 계좌들의 합계 (없으면 빈 배열) */
  cashflow_sums: AccountCashflowSum[]
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

/**
 * 투자 성향 (securities.style) — ETF 유형(style_id: 단일종목·커버드콜…)과는 다른 차원.
 * 값은 자유 텍스트로 저장돼 있으며, 폼에서는 이 목록에서 고른다.
 */
export const INVESTMENT_STYLES = ['성장', '가치', '퀄리티', '인컴', '안전', '코어지수', '테마'] as const
