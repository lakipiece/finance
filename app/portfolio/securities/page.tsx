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
    // 360200.KS → 360200 으로도 인덱싱 (securities 테이블은 .KS 없이 저장)
    const keys = [row.ticker]
    if (row.ticker.endsWith('.KS')) keys.push(row.ticker.slice(0, -3))

    for (const key of keys) {
      if (!priceHistory[key]) priceHistory[key] = []
      priceHistory[key].push(p)
      latestPrices[key] = { price: p.price, currency: row.currency, date: p.date }
    }
  }

  return <SecuritiesManager securities={securities} latestPrices={latestPrices} priceHistory={priceHistory} />
}
