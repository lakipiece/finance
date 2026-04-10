// lib/portfolio/fetch.ts
import 'server-only'
import { getSql } from '@/lib/db'
import { getPrices, isKrxTicker, toYahooTicker } from './prices'
import type { Account, Security, Holding, PortfolioSummary, PortfolioPosition, TargetAllocation } from './types'

export async function fetchAccounts(): Promise<Account[]> {
  const sql = getSql()
  const data = await sql<Account[]>`SELECT * FROM accounts ORDER BY name`
  return data ?? []
}

export async function fetchSecurities(): Promise<Security[]> {
  const sql = getSql()
  const data = await sql<Security[]>`SELECT * FROM securities ORDER BY ticker`
  return data ?? []
}

export async function fetchTargetAllocations(): Promise<TargetAllocation[]> {
  const sql = getSql()
  const data = await sql<TargetAllocation[]>`SELECT * FROM target_allocations`
  return data ?? []
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  const sql = getSql()

  // 조인 대신 별도 쿼리 후 코드에서 합침
  const [latestSnaps, accountsRaw, securitiesRaw] = await Promise.all([
    sql<{ id: number }[]>`SELECT id FROM snapshots ORDER BY date DESC LIMIT 1`,
    sql<Account[]>`SELECT * FROM accounts`,
    sql<Security[]>`SELECT * FROM securities`,
  ])

  const latestSnap = latestSnaps[0] ?? null

  const holdingsRaw = latestSnap
    ? await sql<Holding[]>`
        SELECT * FROM holdings
        WHERE snapshot_id = ${latestSnap.id}
          AND quantity > 0
      `
    : []

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
      last_price_updated_at: null,
    }
  }

  const tickers = holdings.map(h => toYahooTicker(h.security.ticker))
  tickers.push('KRW=X')

  const uniqueTickers = [...new Set(tickers)]
  let prices: Record<string, { price: number; currency: string }> = {}
  try {
    prices = await getPrices(uniqueTickers)
  } catch {
    // 가격 조회 실패 시 투자원금 기준으로만 표시
  }
  const exchangeRate = prices['KRW=X']?.price ?? 1350

  const dividendRows = await sql<{ security_id: number; account_id: number; amount: number; currency: string; exchange_rate: number | null }[]>`
    SELECT security_id, account_id, amount, currency, exchange_rate
    FROM dividends
  `

  const positions: PortfolioPosition[] = holdings.map(h => {
    const yahooTicker = toYahooTicker(h.security.ticker)
    const rawPrice = prices[yahooTicker]?.price ?? 0

    // KRX 6자리 숫자 티커 = 한국 상장 → KRW, 그 외 currency 필드 따름
    const isKrw = isKrxTicker(h.security.ticker) || h.security.currency === 'KRW'
    const isUSD = !isKrw
    const currentPriceKRW = isUSD ? rawPrice * exchangeRate : rawPrice

    const quantity = h.quantity

    // avg_price: USD 종목은 USD로 저장됨 → KRW 환산
    // avg_price: KRX 종목은 KRW, 해외 종목은 USD → KRW 환산
    const avgPriceRaw = h.avg_price ?? 0
    const avgPriceKRW = isUSD ? avgPriceRaw * exchangeRate : avgPriceRaw

    // total_invested: 항상 KRW 기준 (import 시 M열 = 총매수금액(KRW))
    const totalInvested = h.total_invested ?? avgPriceKRW * quantity

    const marketValue = currentPriceKRW * quantity
    const unrealizedPnl = marketValue - totalInvested
    const unrealizedPct = totalInvested > 0 ? unrealizedPnl / totalInvested : 0

    const divs = (dividendRows ?? []).filter(
      d => String(d.security_id) === h.security_id && String(d.account_id) === h.account_id
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

  const latestPrices = await sql<{ date: string }[]>`
    SELECT date FROM price_history ORDER BY date DESC LIMIT 1
  `
  const latestPrice = latestPrices[0] ?? null

  const rawDate = latestPrice?.date ?? null
  const last_price_updated_at = rawDate
    ? (rawDate as unknown) instanceof Date
      ? (rawDate as unknown as Date).toISOString().slice(0, 10)
      : String(rawDate).slice(0, 10)
    : null

  return {
    total_market_value,
    total_invested,
    total_unrealized_pnl,
    total_unrealized_pct,
    total_dividends,
    positions,
    last_price_updated_at,
  }
}
