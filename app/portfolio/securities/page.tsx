import { fetchSecurities } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import SecuritiesManager from '@/components/portfolio/SecuritiesManager'

export const dynamic = 'force-dynamic'

export default async function SecuritiesPage() {
  const sql = getSql()
  const [securities, prices] = await Promise.all([
    fetchSecurities(),
    sql<{ ticker: string; price: number; currency: string; date: string; change_pct: number | null }[]>`
      SELECT ticker, price, currency, date, change_pct FROM price_history ORDER BY date ASC
    `,
  ])

  const latestPrices: Record<string, { price: number; currency: string; date: string }> = {}
  const priceHistory: Record<string, { price: number; date: string }[]> = {}

  for (const row of prices) {
    const p = { price: Number(row.price), date: String(row.date).slice(0, 10) }
    const changePct = row.change_pct != null ? Number(row.change_pct) : null
    const keys = [row.ticker]
    if (row.ticker.endsWith('.KS')) keys.push(row.ticker.slice(0, -3))

    for (const key of keys) {
      if (!priceHistory[key]) priceHistory[key] = []
      priceHistory[key].push(p)
      latestPrices[key] = { price: p.price, currency: row.currency, date: p.date, change_pct: changePct }
    }
  }

  return <SecuritiesManager securities={securities} latestPrices={latestPrices} priceHistory={priceHistory} />
}
