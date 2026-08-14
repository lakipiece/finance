export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import {
  isKrwSecurity, lookupPrice, priceLookupKeys, resolveExchangeRate, toDateStr,
} from '@/lib/portfolio/valuation'

// 모든 스냅샷의 총평가액·투자원금·비중(breakdown)을 재계산한다.
// 가격: 스냅샷 날짜 이전 최신 → 없으면 가장 가까운 미래 가격 → 최후에 avg_price(손익 0 처리).
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = getSql()
  const [snapshots, securities] = await Promise.all([
    sql<{ id: string; date: unknown }[]>`
      SELECT id, date FROM snapshots ORDER BY date DESC
    `,
    sql<{
      id: string; ticker: string; currency: string; country: string | null
      sector: string | null; asset_class: string | null; tags: string[]
    }[]>`
      SELECT s.id, s.ticker,
             cu.value AS currency,
             co.value AS country,
             se.value AS sector,
             ac.value AS asset_class,
             COALESCE(tg.tags, '{}') AS tags
      FROM securities s
      LEFT JOIN option_list cu ON s.currency_id     = cu.id
      LEFT JOIN option_list co ON s.country_id      = co.id
      LEFT JOIN option_list se ON s.sector_id       = se.id
      LEFT JOIN option_list ac ON s.asset_class_id  = ac.id
      LEFT JOIN (
        SELECT security_id, array_agg(tag ORDER BY tag) AS tags
        FROM security_tags GROUP BY security_id
      ) tg ON tg.security_id = s.id
    `,
  ])

  const secMap = Object.fromEntries(securities.map(s => [s.id, s]))

  const uniqueTickers = [
    ...new Set([
      ...securities.flatMap(s => priceLookupKeys(s.ticker, s.country)),
      'USDKRW=X',
      'KRW=X',
    ]),
  ]

  // 가격 이력 + 전체 holdings를 한 번에 로드 (스냅샷별 N+1 제거)
  const snapshotIds = snapshots.map(s => s.id)
  const [allPrices, allHoldings] = await Promise.all([
    sql<{ ticker: string; price: number; date: unknown }[]>`
      SELECT ticker, price, date FROM price_history
      WHERE ticker = ANY(${uniqueTickers})
      ORDER BY ticker, date DESC
    `,
    snapshotIds.length > 0
      ? sql<{ snapshot_id: string; account_id: string; security_id: string; quantity: number; avg_price: number | null }[]>`
          SELECT snapshot_id, account_id, security_id, quantity, avg_price FROM holdings
          WHERE snapshot_id = ANY(${snapshotIds}) AND quantity > 0
        `
      : Promise.resolve([]),
  ])

  const holdingsBySnapshot: Record<string, { account_id: string; security_id: string; quantity: number; avg_price: number | null }[]> = {}
  for (const h of allHoldings) {
    ;(holdingsBySnapshot[h.snapshot_id] ??= []).push(h)
  }

  for (const snap of snapshots) {
    const snapDate = toDateStr(snap.date)
    const holdings = holdingsBySnapshot[snap.id] ?? []

    if (holdings.length === 0) {
      await sql`
        UPDATE snapshots
        SET total_market_value = 0, total_invested = 0,
            sector_breakdown = '{}',
            asset_class_breakdown = '{}',
            tag_breakdown = '{}',
            account_breakdown = '{}',
            value_updated_at = NOW()
        WHERE id = ${snap.id}
      `
      continue
    }

    // 해당 날짜까지의 최신 가격 (없으면 가장 가까운 미래 가격 fallback)
    const priceMap: Record<string, number> = {}
    const fallbackMap: Record<string, number> = {}
    for (const p of allPrices) {
      const pDate = toDateStr(p.date)
      if (pDate <= snapDate && !priceMap[p.ticker]) {
        priceMap[p.ticker] = Number(p.price)
      }
      // allPrices는 date DESC → 마지막에 남는 값이 가장 가까운 미래
      if (pDate > snapDate) {
        fallbackMap[p.ticker] = Number(p.price)
      }
    }
    for (const [ticker, price] of Object.entries(fallbackMap)) {
      if (!priceMap[ticker]) priceMap[ticker] = price
    }
    const { rate: exchangeRate } = resolveExchangeRate(priceMap)

    let totalMarketValue = 0
    let totalInvested = 0
    const assetClassAgg: Record<string, number> = {}
    const sectorAgg: Record<string, number> = {}
    const tagAgg: Record<string, number> = {}
    // 계좌별 {평가액, 평균매수금액} — 목록·차트의 원장/원가 하이브리드 계산용
    const accountAgg: Record<string, { value: number; cost: number }> = {}

    for (const h of holdings) {
      const sec = secMap[h.security_id]
      if (!sec) continue
      const avgPrice = Number(h.avg_price ?? 0)
      // 가격 미존재 시 avg_price 사용 → 해당 종목 손익 0으로 계산됨 (가격 수집으로 해소)
      const rawPrice = lookupPrice(priceMap, sec.ticker, sec.country) ?? avgPrice
      const isKrw = isKrwSecurity(sec)
      const priceKrw = isKrw ? rawPrice : rawPrice * exchangeRate
      const qty = Number(h.quantity)
      const value = priceKrw * qty
      const cost = isKrw ? avgPrice * qty : avgPrice * exchangeRate * qty

      totalMarketValue += value
      totalInvested += cost

      const acc = (accountAgg[h.account_id] ??= { value: 0, cost: 0 })
      acc.value += value
      acc.cost += cost

      const assetKey = sec.asset_class || '기타'
      assetClassAgg[assetKey] = (assetClassAgg[assetKey] ?? 0) + value

      if (sec.sector) {
        sectorAgg[sec.sector] = (sectorAgg[sec.sector] ?? 0) + value
      }

      for (const tag of sec.tags ?? []) {
        tagAgg[tag] = (tagAgg[tag] ?? 0) + value
      }
    }

    const toPct = (agg: Record<string, number>) => {
      const out: Record<string, number> = {}
      for (const [k, v] of Object.entries(agg)) {
        out[k] = totalMarketValue > 0 ? Math.round((v / totalMarketValue) * 1000) / 10 : 0
      }
      return out
    }

    const accountBreakdown: Record<string, { value: number; cost: number }> = {}
    for (const [id, v] of Object.entries(accountAgg)) {
      accountBreakdown[id] = { value: Math.round(v.value), cost: Math.round(v.cost) }
    }

    await sql`
      UPDATE snapshots
      SET total_market_value = ${totalMarketValue},
          total_invested = ${totalInvested},
          sector_breakdown = ${JSON.stringify(toPct(sectorAgg))},
          asset_class_breakdown = ${JSON.stringify(toPct(assetClassAgg))},
          tag_breakdown = ${JSON.stringify(toPct(tagAgg))},
          account_breakdown = ${JSON.stringify(accountBreakdown)},
          value_updated_at = NOW()
      WHERE id = ${snap.id}
    `
  }

  return NextResponse.json({ ok: true, count: snapshots.length })
}
