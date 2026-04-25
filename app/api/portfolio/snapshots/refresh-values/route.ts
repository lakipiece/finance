export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

const EXCHANGE_RATE_FALLBACK = 1350

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = getSql()
  const snapshots = await sql<{ id: string; date: unknown }[]>`
    SELECT id, date FROM snapshots ORDER BY date DESC
  `
  const securities = await sql<{
    id: string; ticker: string; currency: string; country: string | null
    sector: string | null; asset_class: string | null
  }[]>`
    SELECT s.id, s.ticker,
           cu.value AS currency,
           co.value AS country,
           se.value AS sector,
           ac.value AS asset_class
    FROM securities s
    LEFT JOIN option_list cu ON s.currency_id     = cu.id
    LEFT JOIN option_list co ON s.country_id      = co.id
    LEFT JOIN option_list se ON s.sector_id       = se.id
    LEFT JOIN option_list ac ON s.asset_class_id  = ac.id
  `

  const secMap = Object.fromEntries(securities.map(s => [s.id, s]))

  // Yahoo ticker 목록 (국내 종목은 .KS와 bare 모두 포함 — 코인/현금 등은 bare로 저장됨)
  const tickers: string[] = []
  for (const s of securities) {
    const clean = s.ticker.startsWith('KRX:') ? s.ticker.slice(4) : s.ticker
    if (clean.includes('.')) { tickers.push(clean); continue }
    if (s.country === '국내') {
      tickers.push(`${clean}.KS`)
      tickers.push(clean) // fallback for crypto/cash stored without .KS
    } else {
      tickers.push(clean)
    }
  }
  tickers.push('USDKRW=X')
  const uniqueTickers = [...new Set(tickers)]

  // 전체 price_history 한번에 로드 (최적화)
  const allPrices = await sql<{ ticker: string; price: number; date: unknown }[]>`
    SELECT ticker, price, date FROM price_history
    WHERE ticker = ANY(${uniqueTickers})
    ORDER BY ticker, date DESC
  `

  for (const snap of snapshots) {
    const snapDate = (snap.date as unknown) instanceof Date
      ? (snap.date as unknown as Date).toISOString().slice(0, 10)
      : String(snap.date).slice(0, 10)

    const holdings = await sql<{ security_id: string; quantity: number; avg_price: number | null }[]>`
      SELECT security_id, quantity, avg_price FROM holdings
      WHERE snapshot_id = ${snap.id} AND quantity > 0
    `
    if (holdings.length === 0) {
      await sql`
        UPDATE snapshots
        SET total_market_value = 0, total_invested = 0, sector_breakdown = '{}', value_updated_at = NOW()
        WHERE id = ${snap.id}
      `
      continue
    }

    // 해당 날짜까지의 최신 가격 찾기 (없으면 가장 가까운 미래 가격 fallback)
    const priceMap: Record<string, number> = {}
    const fallbackMap: Record<string, { price: number; date: string }> = {}
    for (const p of allPrices) {
      const pDate = (p.date as unknown) instanceof Date
        ? (p.date as unknown as Date).toISOString().slice(0, 10)
        : String(p.date).slice(0, 10)
      if (pDate <= snapDate && !priceMap[p.ticker]) {
        priceMap[p.ticker] = Number(p.price)
      }
      // 미래 가격 중 가장 가까운 것 (allPrices는 date DESC이므로 마지막에 남는 게 가장 가까운 미래)
      if (pDate > snapDate) {
        fallbackMap[p.ticker] = { price: Number(p.price), date: pDate }
      }
    }
    // fallback 적용
    for (const [ticker, fb] of Object.entries(fallbackMap)) {
      if (!priceMap[ticker]) priceMap[ticker] = fb.price
    }
    const exchangeRate = priceMap['USDKRW=X'] ?? EXCHANGE_RATE_FALLBACK

    let totalMarketValue = 0
    let totalInvested = 0
    const sectorAgg: Record<string, number> = {}

    for (const h of holdings) {
      const sec = secMap[h.security_id]
      if (!sec) continue
      const clean = sec.ticker.startsWith('KRX:') ? sec.ticker.slice(4) : sec.ticker
      const isKrx = sec.country === '국내'
      const avgPrice = Number(h.avg_price ?? 0)
      // 국내 종목은 .KS 우선, 없으면 bare; 가격 없으면 avg_price 폴백 (코인 등)
      const rawPrice = isKrx
        ? (priceMap[`${clean}.KS`] ?? priceMap[clean] ?? avgPrice)
        : (priceMap[clean] ?? avgPrice)
      const isKrw = isKrx || sec.currency === 'KRW'
      const priceKrw = isKrw ? rawPrice : rawPrice * exchangeRate

      const qty = Number(h.quantity)
      totalMarketValue += priceKrw * qty

      totalInvested += isKrw ? avgPrice * qty : avgPrice * exchangeRate * qty

      const key = sec.sector || sec.asset_class || '기타'
      sectorAgg[key] = (sectorAgg[key] ?? 0) + priceKrw * qty
    }

    const sectorBreakdown: Record<string, number> = {}
    for (const [k, v] of Object.entries(sectorAgg)) {
      sectorBreakdown[k] = totalMarketValue > 0 ? Math.round((v / totalMarketValue) * 1000) / 10 : 0
    }

    await sql`
      UPDATE snapshots
      SET total_market_value = ${totalMarketValue},
          total_invested = ${totalInvested},
          sector_breakdown = ${JSON.stringify(sectorBreakdown)},
          value_updated_at = NOW()
      WHERE id = ${snap.id}
    `
  }

  return NextResponse.json({ ok: true, count: snapshots.length })
}
