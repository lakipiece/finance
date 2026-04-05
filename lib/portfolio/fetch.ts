// lib/portfolio/fetch.ts
import 'server-only'
import { supabase } from '@/lib/supabase'
import { getPrices } from './prices'
import type { Account, Security, Holding, PortfolioSummary, PortfolioPosition, TargetAllocation } from './types'

export async function fetchAccounts(): Promise<Account[]> {
  const { data } = await supabase.from('accounts').select('*').order('name')
  return data ?? []
}

export async function fetchSecurities(): Promise<Security[]> {
  const { data } = await supabase.from('securities').select('*').order('ticker')
  return data ?? []
}

export async function fetchTargetAllocations(): Promise<TargetAllocation[]> {
  const { data } = await supabase.from('target_allocations').select('*')
  return data ?? []
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  // 조인 대신 별도 쿼리 후 코드에서 합침 (PostgREST 스키마 캐시 의존성 제거)
  const [{ data: holdingsRaw }, { data: accountsRaw }, { data: securitiesRaw }] = await Promise.all([
    supabase.from('holdings').select('*').gt('quantity', 0),
    supabase.from('accounts').select('*'),
    supabase.from('securities').select('*'),
  ])

  const accountMap = Object.fromEntries((accountsRaw ?? []).map(a => [a.id, a as Account]))
  const securityMap = Object.fromEntries((securitiesRaw ?? []).map(s => [s.id, s as Security]))

  const holdings = (holdingsRaw ?? [])
    .map(h => ({
      ...h,
      account: accountMap[h.account_id],
      security: securityMap[h.security_id],
    }))
    .filter(h => h.account && h.security) as (Holding & { account: Account; security: Security })[]

  if (holdings.length === 0) {
    return {
      total_market_value: 0,
      total_invested: 0,
      total_unrealized_pnl: 0,
      total_unrealized_pct: 0,
      total_dividends: 0,
      positions: [],
    }
  }

  // 한국 종목 판별 (DB에 한글 또는 영문 코드 혼재)
  function isKorean(country: string | null): boolean {
    return country === 'KR' || country === '국내' || country === '한국'
  }

  // Yahoo Finance 티커 정규화
  // KRX:XXXXXX → XXXXXX.KS, 6자리 한국 코드 → XXXXXX.KS
  function toYahooTicker(ticker: string, country: string | null): string {
    if (!isKorean(country)) return ticker
    const clean = ticker.startsWith('KRX:') ? ticker.slice(4) : ticker
    if (!clean.includes('.')) return `${clean}.KS`
    return clean
  }

  const tickers = holdings.map(h => toYahooTicker(h.security.ticker, h.security.country))
  tickers.push('KRW=X')

  const uniqueTickers = [...new Set(tickers)]
  let prices: Record<string, { price: number; currency: string }> = {}
  try {
    prices = await getPrices(uniqueTickers)
  } catch {
    // 가격 조회 실패 시 투자원금 기준으로만 표시
  }
  const exchangeRate = prices['KRW=X']?.price ?? 1350

  const { data: dividendRows } = await supabase
    .from('dividends')
    .select('security_id, account_id, amount, currency, exchange_rate')

  const positions: PortfolioPosition[] = holdings.map(h => {
    const yahooTicker = toYahooTicker(h.security.ticker, h.security.country)

    const rawPrice = prices[yahooTicker]?.price ?? 0
    // currency 필드 오류 가능성 있으므로 country로 우선 판단
    const isUSD = !isKorean(h.security.country) && h.security.currency === 'USD'
    const currentPriceKRW = isUSD ? rawPrice * exchangeRate : rawPrice

    const quantity = h.quantity

    // avg_price: USD 종목은 USD로 저장됨 → KRW 환산
    const avgPriceRaw = h.avg_price ?? 0
    const avgPriceKRW = isUSD ? avgPriceRaw * exchangeRate : avgPriceRaw

    // total_invested: 항상 KRW 기준 (import 시 M열 = 총매수금액(KRW))
    const totalInvested = h.total_invested ?? avgPriceKRW * quantity

    const marketValue = currentPriceKRW * quantity
    const unrealizedPnl = marketValue - totalInvested
    const unrealizedPct = totalInvested > 0 ? unrealizedPnl / totalInvested : 0

    const divs = (dividendRows ?? []).filter(
      d => d.security_id === h.security_id && d.account_id === h.account_id
    )
    const totalDividends = divs.reduce((sum, d) => {
      const amt = d.currency === 'USD' ? d.amount * (d.exchange_rate ?? exchangeRate) : d.amount
      return sum + amt
    }, 0)

    return {
      security: h.security,
      account: h.account,
      quantity,
      avg_price: avgPriceKRW,
      avg_price_usd: isUSD ? avgPriceRaw : null,
      current_price_usd: isUSD ? rawPrice : null,
      total_invested: totalInvested,
      current_price: currentPriceKRW,
      market_value: marketValue,
      unrealized_pnl: unrealizedPnl,
      unrealized_pct: unrealizedPct,
      total_dividends: totalDividends,
    }
  })

  const total_market_value = positions.reduce((s, p) => s + p.market_value, 0)
  const total_invested = positions.reduce((s, p) => s + p.total_invested, 0)
  const total_unrealized_pnl = total_market_value - total_invested
  const total_unrealized_pct = total_invested > 0 ? total_unrealized_pnl / total_invested : 0
  const total_dividends = positions.reduce((s, p) => s + p.total_dividends, 0)

  return {
    total_market_value,
    total_invested,
    total_unrealized_pnl,
    total_unrealized_pct,
    total_dividends,
    positions,
  }
}
