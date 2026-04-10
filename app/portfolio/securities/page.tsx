import { fetchSecurities } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import SecuritiesManager from '@/components/portfolio/SecuritiesManager'

export const dynamic = 'force-dynamic'

export default async function SecuritiesPage() {
  const sql = getSql()
  const [securities, prices] = await Promise.all([
    fetchSecurities(),
    sql<{ ticker: string; price: number; currency: string; date: string }[]>`
      SELECT ticker, price, currency, date FROM price_history ORDER BY date DESC LIMIT 500
    `,
  ])

  const latestPrices: Record<string, { price: number; currency: string; date: string }> = {}
  for (const row of prices) {
    if (!latestPrices[row.ticker]) latestPrices[row.ticker] = {
      ...row,
      price: Number(row.price),
      date: String(row.date).slice(0, 10),
    }
  }

  return <SecuritiesManager securities={securities} latestPrices={latestPrices} />
}
