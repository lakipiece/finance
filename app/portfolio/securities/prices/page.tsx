import { fetchSecurities } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import PriceHistoryViewer from '@/components/portfolio/PriceHistoryViewer'

export const dynamic = 'force-dynamic'

export default async function PriceHistoryPage() {
  const sql = getSql()
  const [securities, history] = await Promise.all([
    fetchSecurities(),
    sql<{ ticker: string; date: string; price: number; currency: string }[]>`
      SELECT ticker, date, price, currency FROM price_history ORDER BY date ASC
    `.then(rows => rows.map(r => ({ ...r, price: Number(r.price), date: String(r.date).slice(0, 10) }))),
  ])
  return <PriceHistoryViewer securities={securities} history={history} />
}
