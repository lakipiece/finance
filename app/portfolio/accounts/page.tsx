import { fetchAccounts, fetchSecurities } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import AccountsManager from '@/components/portfolio/AccountsManager'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const sql = getSql()
  const [accounts, securities, accountSecurities, optionsRaw] = await Promise.all([
    fetchAccounts(),
    fetchSecurities(),
    sql`SELECT * FROM account_securities` as unknown as Promise<{ account_id: string; security_id: string }[]>,
    sql`SELECT * FROM option_list WHERE type = 'account_type' ORDER BY sort_order` as unknown as Promise<{ value: string; color_hex: string | null }[]>,
  ])
  const typeColors: Record<string, string> = {}
  for (const o of optionsRaw) {
    if (o.color_hex) typeColors[o.value] = o.color_hex
  }
  return (
    <AccountsManager
      accounts={accounts}
      securities={securities}
      accountSecurities={accountSecurities}
      typeColors={typeColors}
    />
  )
}
