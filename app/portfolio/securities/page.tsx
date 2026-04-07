import { fetchSecurities } from '@/lib/portfolio/fetch'
import { supabase } from '@/lib/supabase'
import SecuritiesManager from '@/components/portfolio/SecuritiesManager'

export const dynamic = 'force-dynamic'

export default async function SecuritiesPage() {
  const [securities, { data: prices }] = await Promise.all([
    fetchSecurities(),
    supabase.from('price_history')
      .select('ticker, price, currency, date')
      .order('date', { ascending: false })
      .limit(500),
  ])

  const latestPrices: Record<string, { price: number; currency: string; date: string }> = {}
  for (const row of prices ?? []) {
    if (!latestPrices[row.ticker]) latestPrices[row.ticker] = row
  }

  return <SecuritiesManager securities={securities} latestPrices={latestPrices} />
}
