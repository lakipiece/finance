import { fetchAccounts, fetchSecurities } from '@/lib/portfolio/fetch'
import { supabase } from '@/lib/supabase'
import AccountsManager from '@/components/portfolio/AccountsManager'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const [accounts, securities, { data: accountSecurities }] = await Promise.all([
    fetchAccounts(),
    fetchSecurities(),
    supabase.from('account_securities').select('*'),
  ])
  return (
    <AccountsManager
      accounts={accounts}
      securities={securities}
      accountSecurities={accountSecurities ?? []}
    />
  )
}
