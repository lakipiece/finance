import { fetchSecurities } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import SecuritiesManager from '@/components/portfolio/SecuritiesManager'

export const dynamic = 'force-dynamic'

type OptionRow = { id: string; type: string; label: string; value: string; color_hex: string | null; sort_order: number }

export default async function SecuritiesPage() {
  const sql = getSql()
  const [securities, prices, optionRows] = await Promise.all([
    fetchSecurities(),
    sql<{ ticker: string; price: number; currency: string; date: string; change_pct: number | null; exchange: string | null }[]>`
      SELECT ticker, price, currency, date, change_pct, exchange FROM price_history ORDER BY date ASC
    `,
    sql<OptionRow[]>`SELECT * FROM option_list ORDER BY type, sort_order, label`,
  ])

  const optionsGrouped: Record<string, OptionRow[]> = {}
  for (const r of optionRows) {
    if (!optionsGrouped[r.type]) optionsGrouped[r.type] = []
    optionsGrouped[r.type].push(r)
  }

  const latestPrices: Record<string, { price: number; currency: string; date: string; change_pct: number | null; exchange: string | null }> = {}
  const priceHistory: Record<string, { price: number; date: string }[]> = {}

  for (const row of prices) {
    const p = { price: Number(row.price), date: String(row.date).slice(0, 10) }
    const changePct = row.change_pct != null ? Number(row.change_pct) : null
    const keys = [row.ticker]
    if (row.ticker.endsWith('.KS')) keys.push(row.ticker.slice(0, -3))

    for (const key of keys) {
      if (!priceHistory[key]) priceHistory[key] = []
      priceHistory[key].push(p)
      latestPrices[key] = { price: p.price, currency: row.currency, date: p.date, change_pct: changePct, exchange: row.exchange ?? null }
    }
  }

  return <SecuritiesManager securities={securities} latestPrices={latestPrices} priceHistory={priceHistory} options={optionsGrouped} />
}
