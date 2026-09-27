export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import {
  costKrw, isKrwSecurity, priceLookupKeys, resolvePrice, resolveExchangeRate, toDateStr,
} from '@/lib/portfolio/valuation'
import { fetchInterestPayments, lastInterestMap } from '@/lib/portfolio/interest'

type HoldingRow = {
  security_id: string
  quantity: number
  avg_price: number | null
  avg_fx_rate: number | null
  fixed_price: string | null
  annual_rate: string | null
  accrual_start: unknown
  maturity_date: unknown
  owner: string | null
  account_name: string
  broker: string | null
  ticker: string
  security_name: string
  currency: string | null
  country: string | null
  sector: string | null
  asset_class: string | null
  tags: string[]
}

function csvField(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = getSql()

  const snapRows = await sql<{ date: unknown }[]>`
    SELECT date FROM snapshots WHERE id = ${params.id}
  `
  if (snapRows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const snapDate = toDateStr(snapRows[0].date)

  const holdings = await sql<HoldingRow[]>`
    SELECT h.security_id, h.quantity, h.avg_price, h.avg_fx_rate,
           s.fixed_price, s.annual_rate, s.accrual_start, s.maturity_date,
           a.owner, a.name AS account_name, a.broker,
           s.ticker, s.name AS security_name,
           cu.value AS currency, co.value AS country,
           se.value AS sector,   ac.value AS asset_class,
           COALESCE(tg.tags, '{}') AS tags
    FROM holdings h
    JOIN securities s ON s.id = h.security_id
    JOIN accounts a   ON a.id = h.account_id
    LEFT JOIN option_list cu ON s.currency_id     = cu.id
    LEFT JOIN option_list co ON s.country_id       = co.id
    LEFT JOIN option_list se ON s.sector_id        = se.id
    LEFT JOIN option_list ac ON s.asset_class_id   = ac.id
    LEFT JOIN (
      SELECT security_id, array_agg(tag ORDER BY tag) AS tags
      FROM security_tags GROUP BY security_id
    ) tg ON tg.security_id = s.id
    WHERE h.snapshot_id = ${params.id} AND h.quantity > 0
    ORDER BY a.owner NULLS LAST, a.name, s.ticker
  `

  // 가격·환산은 valuation.ts 단일 규칙 — 대시보드·스냅샷 값 갱신과 같은 숫자가 나와야 한다.
  // 스냅샷 날짜 이전 가격만 쓰고(미래 가격 금지), 없으면 원가로 임시 평가.
  const uniqueTickers = [...new Set([
    ...holdings.flatMap(h => priceLookupKeys(h.ticker, h.country)),
    'USDKRW=X', 'KRW=X',
  ])]
  const prices = await sql<{ ticker: string; price: number }[]>`
    SELECT DISTINCT ON (ticker) ticker, price FROM price_history
    WHERE ticker = ANY(${uniqueTickers}) AND date <= ${snapDate}
    ORDER BY ticker, date DESC
  `
  const priceMap: Record<string, number> = {}
  for (const p of prices) priceMap[p.ticker] = Number(p.price)
  const { rate: exchangeRate } = resolveExchangeRate(priceMap)
  const priceCtx = { asOf: snapDate, lastInterestBySecurity: lastInterestMap(await fetchInterestPayments(), snapDate) }

  type Computed = HoldingRow & {
    priceKrw: number
    investedKrw: number
    marketValue: number
  }
  const computed: Computed[] = holdings.map(h => {
    const qty = Number(h.quantity)
    const isKrw = isKrwSecurity(h)
    const investedKrw = costKrw({ avgPrice: h.avg_price, quantity: qty, isKrw, fxRate: exchangeRate, avgFxRate: h.avg_fx_rate })
    const price = resolvePrice(priceMap, { ...h, id: h.security_id }, priceCtx)
    const priceKrw = price === null
      ? (qty > 0 ? investedKrw / qty : 0)
      : isKrw ? price : price * exchangeRate
    return { ...h, priceKrw, investedKrw, marketValue: priceKrw * qty }
  })

  const totalMarketValue = computed.reduce((sum, c) => sum + c.marketValue, 0)

  const headers = [
    '사용자', '계좌', '증권사', '티커', '종목명', '자산군', '분야', '태그',
    '통화', '국가', '수량', '평균매수단가', '총매수금액(원)', '현재가(원)',
    '평가금액(원)', '평가손익(원)', '수익률(%)', '비중(%)',
  ]

  const lines = [headers.map(csvField).join(',')]
  for (const c of computed) {
    const pnl = c.marketValue - c.investedKrw
    const pnlPct = c.investedKrw > 0 ? (pnl / c.investedKrw) * 100 : null
    const weight = totalMarketValue > 0 ? (c.marketValue / totalMarketValue) * 100 : 0
    lines.push([
      c.owner ?? '',
      c.account_name,
      c.broker ?? '',
      c.ticker,
      c.security_name,
      c.asset_class ?? '',
      c.sector ?? '',
      (c.tags ?? []).join('; '),
      c.currency ?? '',
      c.country ?? '',
      Number(c.quantity),
      c.avg_price != null ? Number(c.avg_price) : '',
      Math.round(c.investedKrw),
      Math.round(c.priceKrw),
      Math.round(c.marketValue),
      Math.round(pnl),
      pnlPct != null ? pnlPct.toFixed(2) : '',
      weight.toFixed(2),
    ].map(csvField).join(','))
  }

  // 합계 행
  const totalInvested = computed.reduce((s, c) => s + c.investedKrw, 0)
  const totalPnl = totalMarketValue - totalInvested
  lines.push([
    '합계', '', '', '', '', '', '', '', '', '', '', '',
    Math.round(totalInvested),
    '',
    Math.round(totalMarketValue),
    Math.round(totalPnl),
    totalInvested > 0 ? ((totalPnl / totalInvested) * 100).toFixed(2) : '',
    '100.00',
  ].map(csvField).join(','))

  const csv = '﻿' + lines.join('\r\n')
  const filename = `snapshot-${snapDate}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
