export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

const EXCHANGE_RATE_FALLBACK = 1350

type HoldingRow = {
  quantity: number
  avg_price: number | null
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
  const sql = getSql()

  const snapRows = await sql<{ date: unknown }[]>`
    SELECT date FROM snapshots WHERE id = ${params.id}
  `
  if (snapRows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const snapDate = (snapRows[0].date as unknown) instanceof Date
    ? (snapRows[0].date as unknown as Date).toISOString().slice(0, 10)
    : String(snapRows[0].date).slice(0, 10)

  const holdings = await sql<HoldingRow[]>`
    SELECT h.quantity, h.avg_price,
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

  // 가격: 스냅샷 날짜 기준 최신값 (없으면 가장 가까운 미래 가격 fallback) — refresh-values 로직과 동일
  const tickers: string[] = []
  for (const h of holdings) {
    const clean = h.ticker.startsWith('KRX:') ? h.ticker.slice(4) : h.ticker
    if (clean.includes('.')) { tickers.push(clean); continue }
    if (h.country === '국내') {
      tickers.push(`${clean}.KS`)
      tickers.push(clean)
    } else {
      tickers.push(clean)
    }
  }
  tickers.push('USDKRW=X')
  const uniqueTickers = [...new Set(tickers)]

  const allPrices = uniqueTickers.length > 0
    ? await sql<{ ticker: string; price: number; date: unknown }[]>`
        SELECT ticker, price, date FROM price_history
        WHERE ticker = ANY(${uniqueTickers})
        ORDER BY ticker, date DESC
      `
    : []

  const priceMap: Record<string, number> = {}
  const fallbackMap: Record<string, number> = {}
  for (const p of allPrices) {
    const pDate = (p.date as unknown) instanceof Date
      ? (p.date as unknown as Date).toISOString().slice(0, 10)
      : String(p.date).slice(0, 10)
    if (pDate <= snapDate && !priceMap[p.ticker]) priceMap[p.ticker] = Number(p.price)
    if (pDate > snapDate) fallbackMap[p.ticker] = Number(p.price)
  }
  for (const [t, fb] of Object.entries(fallbackMap)) {
    if (!priceMap[t]) priceMap[t] = fb
  }
  const exchangeRate = priceMap['USDKRW=X'] ?? EXCHANGE_RATE_FALLBACK

  type Computed = HoldingRow & {
    priceKrw: number
    investedKrw: number
    marketValue: number
  }
  const computed: Computed[] = holdings.map(h => {
    const clean = h.ticker.startsWith('KRX:') ? h.ticker.slice(4) : h.ticker
    const isKrx = h.country === '국내'
    const avgPrice = Number(h.avg_price ?? 0)
    const rawPrice = isKrx
      ? (priceMap[`${clean}.KS`] ?? priceMap[clean] ?? avgPrice)
      : (priceMap[clean] ?? avgPrice)
    const isKrw = isKrx || h.currency === 'KRW'
    const priceKrw = isKrw ? rawPrice : rawPrice * exchangeRate
    const qty = Number(h.quantity)
    return {
      ...h,
      priceKrw,
      investedKrw: (isKrw ? avgPrice : avgPrice * exchangeRate) * qty,
      marketValue: priceKrw * qty,
    }
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
