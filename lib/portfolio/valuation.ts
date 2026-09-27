// lib/portfolio/valuation.ts
// 평가·환산 규칙의 단일 소스 (Single Source of Truth).
// 대시보드(fetch.ts) / 스냅샷 값 갱신(refresh-values) / 스냅샷 편집(prices-at)이
// 서로 다른 환율 티커·KRW 판정·fallback을 쓰던 것을 여기로 통일한다.
// 순수 함수만 포함 — 클라이언트/서버 공용.

import { isKrxTicker } from './ticker-utils'

/** 환율 조회 실패 시 마지막 수단. 사용 시 호출부에서 경고를 남길 것. */
export const EXCHANGE_RATE_FALLBACK = 1350

export interface SecurityLike {
  ticker: string
  currency?: string | null
  country?: string | null
  /** 고정단가 — numeric 컬럼이라 postgres.js가 문자열로 줄 수 있다 */
  fixed_price?: number | string | null
  /** 연이율 (0.035 = 3.5%) — 미수이자 계산용 */
  annual_rate?: number | string | null
  /** 이자 기산일 */
  accrual_start?: unknown
  /** 만기일 — 이후로는 이자가 붙지 않는다 */
  maturity_date?: unknown
}

/** KRX: 접두어 제거 */
export function cleanTicker(ticker: string): string {
  return ticker.startsWith('KRX:') ? ticker.slice(4) : ticker
}

/**
 * 원화 표시 종목 여부 — 통일 규칙:
 * country가 '국내'거나, currency가 KRW거나, KRX 티커 패턴이면 KRW.
 */
export function isKrwSecurity(sec: SecurityLike): boolean {
  return sec.country === '국내' || sec.currency === 'KRW' || isKrxTicker(sec.ticker)
}

/**
 * price_history 조회 키 후보 (우선순위 순).
 * 국내 종목은 `005930.KS`로 저장되지만 코인/현금 등은 bare로 저장되므로 둘 다 반환.
 */
export function priceLookupKeys(ticker: string, country?: string | null): string[] {
  const clean = cleanTicker(ticker)
  if (clean.includes('.')) return [clean]
  const isKrx = country === '국내' || (!country && isKrxTicker(clean))
  return isKrx ? [`${clean}.KS`, clean] : [clean]
}

/** priceMap에서 후보 키 순서대로 가격을 찾는다. 없으면 null. */
export function lookupPrice(
  priceMap: Record<string, number>,
  ticker: string,
  country?: string | null,
): number | null {
  for (const key of priceLookupKeys(ticker, country)) {
    const p = priceMap[key]
    if (p != null && p > 0) return p
  }
  return null
}

/** 고정단가를 숫자로 정규화. 미설정이면 null. */
export function fixedPriceOf(sec: SecurityLike): number | null {
  if (sec.fixed_price == null) return null
  const n = Number(sec.fixed_price)
  return Number.isFinite(n) ? n : null
}

/** 'YYYY-MM-DD' 두 날짜 사이의 일수. 음수면 0. */
function daysBetween(from: string, to: string): number {
  if (!from || !to) return 0
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  if (!Number.isFinite(ms)) return 0
  return Math.max(0, Math.round(ms / 86400000))
}

/**
 * 미수이자 배수 — 평가단가에 곱할 값. 이자 설정이 없으면 1.
 *
 *   배수 = 1 + 연이율 × 경과일 / 365            (예금 관례대로 단리)
 *   경과일 = min(asOf, 만기일) − max(기산일, 마지막 이자 지급일)
 *
 * 마지막 이자 지급일을 기산점으로 당기므로, dividends에 이자를 기록하면
 * 그만큼의 미수이자가 사라져 이중 계상되지 않는다.
 */
export function accrualFactor(
  sec: SecurityLike,
  asOf: string,
  lastInterestAt?: string | null,
): number {
  const rate = sec.annual_rate == null ? null : Number(sec.annual_rate)
  if (rate === null || !Number.isFinite(rate) || rate === 0) return 1

  const start = toDateStr(sec.accrual_start)
  const from = lastInterestAt && lastInterestAt > start ? lastInterestAt : start
  if (!from) return 1

  const maturity = toDateStr(sec.maturity_date)
  const to = maturity && maturity < asOf ? maturity : asOf

  return 1 + rate * (daysBetween(from, to) / 365)
}

/** 미수이자 계산에 필요한 부가 정보 — 없으면 이자를 반영하지 않는다. */
export interface PriceContext {
  /** 평가 기준일 'YYYY-MM-DD' */
  asOf: string
  /** security_id → 기준일 이전 마지막 이자 지급일 */
  lastInterestBySecurity?: Record<string, string>
}

/**
 * 종목 단가 해석 — 고정단가가 있으면 시세를 무시하고 그 값을 쓴다.
 * 티커가 실재하지 않는 종목(원화 RP, 예수금 등)의 단일 진입점.
 * ctx를 주면 연이율 설정이 있는 종목에 미수이자를 얹는다.
 */
export function resolvePrice(
  priceMap: Record<string, number>,
  sec: SecurityLike & { id?: string },
  ctx?: PriceContext,
): number | null {
  const fixed = fixedPriceOf(sec)
  const base = fixed !== null ? fixed : lookupPrice(priceMap, sec.ticker, sec.country)
  if (base === null) return null
  if (!ctx) return base

  const lastInterest = sec.id ? ctx.lastInterestBySecurity?.[sec.id] : null
  return base * accrualFactor(sec, ctx.asOf, lastInterest)
}

/**
 * 평균매수금액(원가) KRW 환산 — 원가 계산의 단일 진입점.
 *   KRW 종목: 평균단가 × 수량
 *   USD 종목: 평균단가 × 수량 × (평균 매입환율 ?? 평가 시점 환율)
 * 평균 매입환율이 없으면 환율 변동에 따라 원가가 흔들린다 — 입력을 권장.
 */
export function costKrw(args: {
  avgPrice: number | string | null | undefined
  quantity: number | string
  isKrw: boolean
  fxRate: number
  avgFxRate?: number | string | null
}): number {
  const avg = Number(args.avgPrice ?? 0)
  const qty = Number(args.quantity)
  if (!avg || !qty) return 0
  if (args.isKrw) return avg * qty
  const fixed = args.avgFxRate == null ? NaN : Number(args.avgFxRate)
  const rate = Number.isFinite(fixed) && fixed > 0 ? fixed : args.fxRate
  return avg * qty * rate
}

/**
 * 환율 해석 — USDKRW=X(수집 원본)와 KRW=X(alias)를 모두 시도.
 * fallback 사용 여부를 함께 반환하므로 호출부는 경고를 노출할 수 있다.
 */
export function resolveExchangeRate(
  priceMap: Record<string, number>,
): { rate: number; isFallback: boolean } {
  const rate = priceMap['USDKRW=X'] ?? priceMap['KRW=X']
  if (rate != null && rate > 0) return { rate, isFallback: false }
  return { rate: EXCHANGE_RATE_FALLBACK, isFallback: true }
}

/**
 * KST 기준 거래일 (가격 수집·저장 공용).
 * KST 12시 이전(새벽) = 미국장 마감 직후이므로 전날을 거래일로 본다.
 */
export function kstTradingDate(now: Date = new Date()): string {
  const nowKst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const kstHour = nowKst.getUTCHours()
  const tradingDate = new Date(nowKst)
  if (kstHour < 12) tradingDate.setUTCDate(tradingDate.getUTCDate() - 1)
  return tradingDate.toISOString().slice(0, 10)
}

/** KST 기준 오늘 날짜 'YYYY-MM-DD' — 미수이자 경과일 계산용 (거래일 보정 없음) */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

/** Date | string → 'YYYY-MM-DD' */
export function toDateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v ?? '').slice(0, 10)
}
