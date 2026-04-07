import { fetchAccounts, fetchSecurities } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import AccountsManager from '@/components/portfolio/AccountsManager'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const sql = getSql()
  const [accounts, securities, accountSecurities] = await Promise.all([
    fetchAccounts(),
    fetchSecurities(),
    sql`SELECT * FROM account_securities`,
  ])
  return (
    <AccountsManager
      accounts={accounts}
      securities={securities}
      accountSecurities={accountSecurities}
    />
  )
}
