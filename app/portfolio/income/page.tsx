import { supabase } from '@/lib/supabase'
import IncomeDashboard from '@/components/portfolio/IncomeDashboard'

export const dynamic = 'force-dynamic'

export default async function IncomePage() {
  const [{ data: sells }, { data: dividends }, { data: securities }, { data: accounts }] = await Promise.all([
    supabase.from('sells').select('*, security:securities(ticker,name), account:accounts(name,broker)').order('sold_at', { ascending: false }),
    supabase.from('dividends').select('*, security:securities(ticker,name), account:accounts(name,broker)').order('paid_at', { ascending: false }),
    supabase.from('securities').select('id,ticker,name').order('ticker'),
    supabase.from('accounts').select('id,name,broker').order('name'),
  ])

  return (
    <IncomeDashboard
      sells={sells ?? []}
      dividends={dividends ?? []}
      securities={securities ?? []}
      accounts={accounts ?? []}
    />
  )
}
