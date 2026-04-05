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
  const { data: holdingsRaw } = await supabase
    .from('holdings')
    .select(`
      *,
      account:accounts(*),
      security:securities(*)
    `)
    .gt('quantity', 0)

  const holdings = (holdingsRaw ?? []) as (Holding & { account: Account; security: Security })[]

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

  const tickers = holdings.map(h => {
    const ticker = h.security.ticker
    if (h.security.country === 'KR' && !ticker.includes('.')) return `${ticker}.KS`
    return ticker
  })
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
    const yahooTicker = h.security.country === 'KR' && !h.security.ticker.includes('.')
      ? `${h.security.ticker}.KS`
      : h.security.ticker

    const rawPrice = prices[yahooTicker]?.price ?? 0
    const currentPriceKRW = h.security.currency === 'USD' ? rawPrice * exchangeRate : rawPrice

    const quantity = h.quantity
    const avgPriceKRW = h.avg_price ?? 0
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
