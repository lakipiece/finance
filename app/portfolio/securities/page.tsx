import { fetchSecurities } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
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
}

export default async function SecuritiesPage() {
  const sql = getSql()
  const [securities, prices, optionRows, latestSnap] = await Promise.all([
    fetchSecurities(),
    sql<{ ticker: string; price: number; currency: string; date: unknown; change_pct: number | null; exchange: string | null }[]>`
      SELECT ticker, price, currency, date, change_pct, exchange FROM price_history ORDER BY date ASC
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
    const rawDate = row.date
    const dateStr = (rawDate as unknown) instanceof Date
      ? (rawDate as unknown as Date).toISOString().slice(0, 10)
      : String(rawDate).slice(0, 10)
    const p = { price: Number(row.price), date: dateStr }
    const changePct = row.change_pct != null ? Number(row.change_pct) : null
    const keys = [row.ticker]
    if (row.ticker.endsWith('.KS')) keys.push(row.ticker.slice(0, -3))
    for (const key of keys) {
      if (!priceHistory[key]) priceHistory[key] = []
      priceHistory[key].push(p)
      latestPrices[key] = { price: p.price, currency: row.currency, date: p.date, change_pct: changePct, exchange: row.exchange ?? null }
    }
  }

  // 최근 스냅샷 보유 현황
  const holdingsMap: Record<string, HoldingRow[]> = {}
  if (latestSnap[0]) {
    const rows = await sql<HoldingRow[]>`
      SELECT h.security_id, h.account_id, a.name AS account_name, a.broker AS account_broker,
             h.quantity, h.avg_price
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
      })
    }
  }

  return <SecuritiesManager securities={securities} latestPrices={latestPrices} priceHistory={priceHistory} options={optionsGrouped} holdingsMap={holdingsMap} />
}
