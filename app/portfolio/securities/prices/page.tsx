import { fetchSecurities } from '@/lib/portfolio/fetch'
import { supabase } from '@/lib/supabase'
import PriceHistoryViewer from '@/components/portfolio/PriceHistoryViewer'

export const dynamic = 'force-dynamic'

export default async function PriceHistoryPage() {
  const [securities, { data: history }] = await Promise.all([
    fetchSecurities(),
    supabase
      .from('price_history')
      .select('ticker, date, price, currency')
      .order('date', { ascending: true }),
  ])
  return <PriceHistoryViewer securities={securities} history={history ?? []} />
}
