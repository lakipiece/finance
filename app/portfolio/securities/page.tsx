import { fetchSecurities } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import { toDateStr } from '@/lib/portfolio/valuation'
import SecuritiesManager from '@/components/portfolio/SecuritiesManager'

export const dynamic = 'force-dynamic'

type OptionRow = { id: string; type: string; label: string; value: string; color_hex: string | null; sort_order: number }

type HoldingRow = {
  security_id: string
  account_id: string
  account_name: string
  account_broker: string
  quantity: number
  avg_price: number | null
  avg_fx_rate: number | null
}

export default async function SecuritiesPage() {
  const sql = getSql()
  type PriceRow = { ticker: string; price: number; currency: string; date: unknown; change_pct: number | null; exchange: string | null }
  const [securities, latestRows, prices, optionRows, latestSnap] = await Promise.all([
    fetchSecurities(),
    // 종목별 최신가 1건 — 오래전에 수집이 멈춘 종목도 포함
    sql<PriceRow[]>`
      SELECT DISTINCT ON (ticker) ticker, price, currency, date, change_pct, exchange
      FROM price_history ORDER BY ticker, date DESC
    `,
    // 미니차트·상세 차트(최근 90거래일)용 — 가격 이력 전량 대신 최근 180일만
    sql<Pick<PriceRow, 'ticker' | 'price' | 'date'>[]>`
      SELECT ticker, price, date FROM price_history
      WHERE date >= CURRENT_DATE - 180
      ORDER BY date ASC
    `,
    sql<OptionRow[]>`SELECT * FROM option_list ORDER BY type, sort_order, label`,
    sql<{ id: string }[]>`SELECT id FROM snapshots ORDER BY date DESC LIMIT 1`,
  ])

  const optionsGrouped: Record<string, OptionRow[]> = {}
  for (const r of optionRows) {
    if (!optionsGrouped[r.type]) optionsGrouped[r.type] = []
    optionsGrouped[r.type].push(r)
  }

  const latestPrices: Record<string, { price: number; currency: string; date: string; change_pct: number | null; exchange: string | null }> = {}
  const priceHistory: Record<string, { price: number; date: string }[]> = {}

  for (const row of prices) {
    const p = { price: Number(row.price), date: toDateStr(row.date) }
    const keys = [row.ticker]
    if (row.ticker.endsWith('.KS')) keys.push(row.ticker.slice(0, -3))
    for (const key of keys) {
      if (!priceHistory[key]) priceHistory[key] = []
      priceHistory[key].push(p)
    }
  }
  for (const row of latestRows) {
    const date = toDateStr(row.date)
    const keys = [row.ticker]
    if (row.ticker.endsWith('.KS')) keys.push(row.ticker.slice(0, -3))
    for (const key of keys) {
      const prev = latestPrices[key]
      // bare·.KS 두 키가 같은 종목을 가리키면 더 최근 것을 쓴다
      if (prev && prev.date >= date) continue
      latestPrices[key] = {
        price: Number(row.price), currency: row.currency, date,
        change_pct: row.change_pct != null ? Number(row.change_pct) : null,
        exchange: row.exchange ?? null,
      }
    }
  }

  // 최근 스냅샷 보유 현황
  const holdingsMap: Record<string, HoldingRow[]> = {}
  if (latestSnap[0]) {
    const rows = await sql<HoldingRow[]>`
      SELECT h.security_id, h.account_id, a.name AS account_name, a.broker AS account_broker,
             h.quantity, h.avg_price, h.avg_fx_rate
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      WHERE h.snapshot_id = ${latestSnap[0].id} AND h.quantity > 0
      ORDER BY a.sort_order ASC, a.created_at ASC
    `
    for (const r of rows) {
      if (!holdingsMap[r.security_id]) holdingsMap[r.security_id] = []
      holdingsMap[r.security_id].push({
        ...r,
        quantity: Number(r.quantity),
        avg_price: r.avg_price != null ? Number(r.avg_price) : null,
        avg_fx_rate: r.avg_fx_rate != null ? Number(r.avg_fx_rate) : null,
      })
    }
  }

  return <SecuritiesManager securities={securities} latestPrices={latestPrices} priceHistory={priceHistory} options={optionsGrouped} holdingsMap={holdingsMap} />
}
