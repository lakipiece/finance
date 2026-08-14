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

/** Date | string → 'YYYY-MM-DD' */
export function toDateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v ?? '').slice(0, 10)
}
