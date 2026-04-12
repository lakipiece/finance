import { getSql } from '@/lib/db'
import IncomeDashboard from '@/components/portfolio/IncomeDashboard'
import type { Dividend, Security, Account } from '@/lib/portfolio/types'

export const dynamic = 'force-dynamic'

type DividendRow = Dividend & { security: Pick<Security, 'ticker' | 'name' | 'currency'>; account: Pick<Account, 'name' | 'broker'> }
type SecurityRow = Pick<Security, 'id' | 'ticker' | 'name' | 'currency'>
type AccountRow = Pick<Account, 'id' | 'name' | 'broker'>
type AccountSecurity = { account_id: string; security_id: string }

export default async function IncomePage() {
  const sql = getSql()
  const [dividends, securities, accounts, accountSecurities] = await Promise.all([
    sql`
      SELECT d.*,
        json_build_object('ticker', s.ticker, 'name', s.name, 'currency', s.currency) AS security,
        json_build_object('name', a.name, 'broker', a.broker) AS account
      FROM dividends d
      JOIN securities s ON s.id = d.security_id
      JOIN accounts a ON a.id = d.account_id
      ORDER BY d.paid_at DESC
    ` as unknown as Promise<DividendRow[]>,
    sql`SELECT id, ticker, name, currency FROM securities ORDER BY ticker` as unknown as Promise<SecurityRow[]>,
    sql`SELECT id, name, broker FROM accounts ORDER BY name` as unknown as Promise<AccountRow[]>,
    sql`SELECT * FROM account_securities` as unknown as Promise<AccountSecurity[]>,
  ])

  return (
    <IncomeDashboard
      dividends={dividends}
      securities={securities}
      accounts={accounts}
      accountSecurities={accountSecurities}
    />
  )
}
