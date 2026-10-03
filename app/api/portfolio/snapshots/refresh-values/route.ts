export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import {
  costKrw, isKrwSecurity, priceLookupKeys, resolvePrice, resolveExchangeRate, toDateStr,
} from '@/lib/portfolio/valuation'
import { fetchInterestPayments, lastInterestMap } from '@/lib/portfolio/interest'

// 모든 스냅샷의 총평가액·투자원금·비중(breakdown)을 재계산한다.
// 가격: 스냅샷 날짜 이전 최신만 쓴다 (미래 가격으로 과거를 평가하지 않는다).
// 가격이 없으면 평균단가로 임시 평가하되 snapshots.unpriced_tickers에 남겨 화면에 노출한다.
// body.snapshot_id가 있으면 그 스냅샷만 (스냅샷 편집 저장 직후 호출).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { snapshot_id?: string }
  const onlyId = typeof body.snapshot_id === 'string' ? body.snapshot_id : null

  const sql = getSql()
  const [snapshots, securities] = await Promise.all([
    sql<{ id: string; date: unknown }[]>`
      SELECT id, date FROM snapshots
      ${onlyId ? sql`WHERE id = ${onlyId}` : sql``}
      ORDER BY date DESC
    `,
    sql<{
      id: string; ticker: string; currency: string; country: string | null
      sector: string | null; asset_class: string | null; tags: string[]
      fixed_price: string | null; annual_rate: string | null
      accrual_start: unknown; maturity_date: unknown
    }[]>`
      SELECT s.id, s.ticker, s.fixed_price, s.annual_rate, s.accrual_start, s.maturity_date,
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

  // 이자 지급 내역 — 스냅샷 날짜마다 그 이전 마지막 지급일을 기산점으로 쓴다
  const interestPayments = await fetchInterestPayments()

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
      ? sql<{ snapshot_id: string; account_id: string; security_id: string; quantity: number; avg_price: number | null; avg_fx_rate: number | null }[]>`
          SELECT snapshot_id, account_id, security_id, quantity, avg_price, avg_fx_rate FROM holdings
          WHERE snapshot_id = ANY(${snapshotIds}) AND quantity > 0
        `
      : Promise.resolve([]),
  ])

  const holdingsBySnapshot: Record<string, { account_id: string; security_id: string; quantity: number; avg_price: number | null; avg_fx_rate: number | null }[]> = {}
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
            unpriced_tickers = '{}',
            value_updated_at = NOW()
        WHERE id = ${snap.id}
      `
      continue
    }

    // 해당 날짜까지의 최신 가격 (allPrices는 date DESC → 처음 만나는 값이 최신)
    const priceMap: Record<string, number> = {}
    for (const p of allPrices) {
      if (toDateStr(p.date) <= snapDate && !priceMap[p.ticker]) {
        priceMap[p.ticker] = Number(p.price)
      }
    }
    const { rate: exchangeRate } = resolveExchangeRate(priceMap)
    const priceCtx = { asOf: snapDate, lastInterestBySecurity: lastInterestMap(interestPayments, snapDate) }

    let totalMarketValue = 0
    let totalInvested = 0
    const assetClassAgg: Record<string, number> = {}
    const sectorAgg: Record<string, number> = {}
    const tagAgg: Record<string, number> = {}
    // 계좌별 {평가액, 평균매수금액} — 목록·차트의 원장/원가 하이브리드 계산용
    const accountAgg: Record<string, { value: number; cost: number }> = {}
    const unpriced = new Set<string>()

    for (const h of holdings) {
      const sec = secMap[h.security_id]
      if (!sec) continue
      const qty = Number(h.quantity)
      const isKrw = isKrwSecurity(sec)
      const cost = costKrw({ avgPrice: h.avg_price, quantity: qty, isKrw, fxRate: exchangeRate, avgFxRate: h.avg_fx_rate })
      const price = resolvePrice(priceMap, sec, priceCtx)
      // 가격이 없으면 원가로 임시 평가(손익 0) — 대신 목록에 남겨 조용히 넘어가지 않는다
      if (price === null) unpriced.add(sec.ticker)
      const value = price === null ? cost : (isKrw ? price : price * exchangeRate) * qty

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

    // 분해는 금액(KRW, 원 단위)으로 저장하고 비중은 화면에서 계산한다 (breakdownToPct).
    const toAmounts = (agg: Record<string, number>) =>
      Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, Math.round(v)]))

    const accountBreakdown: Record<string, { value: number; cost: number }> = {}
    for (const [id, v] of Object.entries(accountAgg)) {
      accountBreakdown[id] = { value: Math.round(v.value), cost: Math.round(v.cost) }
    }

    await sql`
      UPDATE snapshots
      SET total_market_value = ${totalMarketValue},
          total_invested = ${totalInvested},
          -- sql.json: 객체 그대로 jsonb로 (JSON.stringify를 넘기면 문자열 스칼라로 이중 인코딩된다)
          sector_breakdown = ${sql.json(toAmounts(sectorAgg))},
          asset_class_breakdown = ${sql.json(toAmounts(assetClassAgg))},
          tag_breakdown = ${sql.json(toAmounts(tagAgg))},
          account_breakdown = ${sql.json(accountBreakdown)},
          unpriced_tickers = ${[...unpriced].sort()},
          value_updated_at = NOW()
      WHERE id = ${snap.id}
    `
  }

  return NextResponse.json({ ok: true, count: snapshots.length })
}
