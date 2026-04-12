// lib/portfolio/fetch.ts
import 'server-only'
import { getSql } from '@/lib/db'
import { getPrices, isKrxTicker, toYahooTicker } from './prices'
import type { Account, Security, Holding, PortfolioSummary, PortfolioPosition, TargetAllocation } from './types'

export async function fetchAccounts(): Promise<Account[]> {
  const sql = getSql()
  const data = await sql<Account[]>`
    SELECT a.id, a.name, a.broker, a.owner, a.created_at, a.sort_order,
           a.type_id, a.currency_id,
           t.value AS type, cu.value AS currency
    FROM accounts a
    LEFT JOIN option_list t  ON a.type_id    = t.id
    LEFT JOIN option_list cu ON a.currency_id = cu.id
    ORDER BY a.sort_order ASC, a.created_at ASC
  `
  return data ?? []
}

export async function fetchSecurities(): Promise<Security[]> {
  const sql = getSql()
  const data = await sql<Security[]>`
    SELECT s.id, s.ticker, s.name, s.style, s.url, s.memo, s.created_at,
           s.asset_class_id, s.country_id, s.sector_id, s.currency_id,
           ac.value AS asset_class, co.value AS country,
           se.value AS sector,      cu.value AS currency
    FROM securities s
    LEFT JOIN option_list ac ON s.asset_class_id = ac.id
    LEFT JOIN option_list co ON s.country_id      = co.id
    LEFT JOIN option_list se ON s.sector_id       = se.id
    LEFT JOIN option_list cu ON s.currency_id     = cu.id
    ORDER BY s.ticker
  `
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
    sql<Account[]>`
      SELECT a.id, a.name, a.broker, a.owner, a.created_at, a.sort_order,
             a.type_id, a.currency_id,
             t.value AS type, cu.value AS currency
      FROM accounts a
      LEFT JOIN option_list t  ON a.type_id    = t.id
      LEFT JOIN option_list cu ON a.currency_id = cu.id
    `,
    sql<Security[]>`
      SELECT s.id, s.ticker, s.name, s.style, s.url, s.memo, s.created_at,
             s.asset_class_id, s.country_id, s.sector_id, s.currency_id,
             ac.value AS asset_class, co.value AS country,
             se.value AS sector,      cu.value AS currency
      FROM securities s
      LEFT JOIN option_list ac ON s.asset_class_id = ac.id
      LEFT JOIN option_list co ON s.country_id      = co.id
      LEFT JOIN option_list se ON s.sector_id       = se.id
      LEFT JOIN option_list cu ON s.currency_id     = cu.id
    `,
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

    const quantity = Number(h.quantity)

    // avg_price: USD 종목은 USD로 저장됨 → KRW 환산
    // avg_price: KRX 종목은 KRW, 해외 종목은 USD → KRW 환산
    const avgPriceRaw = Number(h.avg_price ?? 0)
    const avgPriceKRW = isUSD ? avgPriceRaw * exchangeRate : avgPriceRaw

    // total_invested: USD 종목은 USD로 저장되어 있으므로 KRW 환산 필요
    // KRW 종목은 KRW 그대로 사용
    const totalInvestedRaw = Number(h.total_invested ?? 0)
    const totalInvested = totalInvestedRaw > 0
      ? (isUSD ? totalInvestedRaw * exchangeRate : totalInvestedRaw)
      : avgPriceKRW * quantity

    const marketValue = currentPriceKRW * quantity
    const unrealizedPnl = marketValue - totalInvested
    const unrealizedPct = totalInvested > 0 ? unrealizedPnl / totalInvested : 0

    const divs = (dividendRows ?? []).filter(
      d => String(d.security_id) === h.security_id && String(d.account_id) === h.account_id
    )
    const totalDividends = divs.reduce((sum, d) => {
      const rate = Number(d.exchange_rate) || 1
      const amt = d.currency === 'KRW' ? Number(d.amount) : Number(d.amount) * rate
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

  const latestPrices = await sql<{ date: string; created_at: string }[]>`
    SELECT date, created_at FROM price_history ORDER BY created_at DESC LIMIT 1
  `
  const latestPrice = latestPrices[0] ?? null

  let last_price_updated_at: string | null = null
  if (latestPrice?.created_at) {
    const d = (latestPrice.created_at as unknown) instanceof Date
      ? (latestPrice.created_at as unknown as Date)
      : new Date(String(latestPrice.created_at))
    const pad = (n: number) => String(n).padStart(2, '0')
    last_price_updated_at = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } else if (latestPrice?.date) {
    const raw = String(latestPrice.date)
    last_price_updated_at = raw.slice(0, 10)
  }

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
