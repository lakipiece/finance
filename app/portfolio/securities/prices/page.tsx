import { fetchSecurities } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import PriceHistoryViewer from '@/components/portfolio/PriceHistoryViewer'

export const dynamic = 'force-dynamic'

export default async function PriceHistoryPage() {
  const sql = getSql()
  const securities = await fetchSecurities()
  const securitiesSet = new Set(securities.map(s => s.ticker))

  const rawHistory = await sql<{ ticker: string; date: string; price: number; currency: string }[]>`
    SELECT ticker, date, price, currency FROM price_history ORDER BY date ASC
  `
  const history = rawHistory
    .map(r => ({
      ...r,
      // price_history는 161510.KS로 저장, securities는 161510 → 정규화
      ticker: r.ticker.endsWith('.KS') || r.ticker.endsWith('.KQ') ? r.ticker.slice(0, -3) : r.ticker,
      price: Number(r.price),
      date: (r.date as unknown) instanceof Date ? (r.date as unknown as Date).toISOString().slice(0, 10) : String(r.date).slice(0, 10),
    }))
    // securities에 없는 내부 티커(KRW=X 등) 제외
    .filter(r => securitiesSet.has(r.ticker))

  return <PriceHistoryViewer securities={securities} history={history} />
}
