import { fetchSecurities } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import SecuritiesManager from '@/components/portfolio/SecuritiesManager'

export const dynamic = 'force-dynamic'

export default async function SecuritiesPage() {
  const sql = getSql()
  const [securities, prices] = await Promise.all([
    fetchSecurities(),
    sql<{ ticker: string; price: number; currency: string; date: string }[]>`
      SELECT ticker, price, currency, date FROM price_history ORDER BY date ASC
    `,
  ])

  const latestPrices: Record<string, { price: number; currency: string; date: string }> = {}
  const priceHistory: Record<string, { price: number; date: string }[]> = {}

  for (const row of prices) {
    const p = { price: Number(row.price), date: String(row.date).slice(0, 10) }
    if (!priceHistory[row.ticker]) priceHistory[row.ticker] = []
    priceHistory[row.ticker].push(p)
    latestPrices[row.ticker] = { price: p.price, currency: row.currency, date: p.date }
  }

  return <SecuritiesManager securities={securities} latestPrices={latestPrices} priceHistory={priceHistory} />
}
