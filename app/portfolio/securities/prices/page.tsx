import { fetchSecurities } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import { priceLookupKeys, toDateStr } from '@/lib/portfolio/valuation'
import PriceHistoryViewer from '@/components/portfolio/PriceHistoryViewer'

export const dynamic = 'force-dynamic'

// 가격 이력 전량을 내려보내던 것을 선택한 종목 1개만 읽도록 (?ticker=)
export default async function PriceHistoryPage({ searchParams }: { searchParams: Promise<{ ticker?: string }> }) {
  const { ticker } = await searchParams
  const sql = getSql()
  const securities = await fetchSecurities()
  const selected = securities.find(s => s.ticker === ticker) ?? securities[0] ?? null

  const history = selected
    ? (await sql<{ date: unknown; price: number; currency: string }[]>`
        SELECT DISTINCT ON (date) date, price, currency FROM price_history
        WHERE ticker = ANY(${priceLookupKeys(selected.ticker, selected.country)})
        ORDER BY date ASC, ticker DESC
      `).map(r => ({ ticker: selected.ticker, date: toDateStr(r.date), price: Number(r.price), currency: r.currency }))
    : []

  return <PriceHistoryViewer securities={securities} selectedTicker={selected?.ticker ?? ''} history={history} />
}
