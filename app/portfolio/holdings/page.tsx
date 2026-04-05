import { fetchAccounts, fetchSecurities } from '@/lib/portfolio/fetch'
import { supabase } from '@/lib/supabase'
import HoldingsManager from '@/components/portfolio/HoldingsManager'

export const dynamic = 'force-dynamic'

export default async function HoldingsPage() {
  const [accounts, securities, { data: accountSecurities }] = await Promise.all([
    fetchAccounts(),
    fetchSecurities(),
    supabase.from('account_securities').select('*'),
  ])
  return (
    <HoldingsManager
      accounts={accounts}
      securities={securities}
      accountSecurities={accountSecurities ?? []}
    />
  )
}
