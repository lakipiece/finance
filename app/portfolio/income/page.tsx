import { getSql } from '@/lib/db'
import IncomeDashboard from '@/components/portfolio/IncomeDashboard'
import type { Sell, Dividend, Security, Account } from '@/lib/portfolio/types'

export const dynamic = 'force-dynamic'

type SellRow = Sell & { security: Pick<Security, 'ticker' | 'name'>; account: Pick<Account, 'name' | 'broker'> }
type DividendRow = Dividend & { security: Pick<Security, 'ticker' | 'name'>; account: Pick<Account, 'name' | 'broker'> }
type SecurityRow = Pick<Security, 'id' | 'ticker' | 'name'>
type AccountRow = Pick<Account, 'id' | 'name' | 'broker'>
type AccountSecurity = { account_id: string; security_id: string }

export default async function IncomePage() {
  const sql = getSql()
  const [sells, dividends, securities, accounts, accountSecurities] = await Promise.all([
    sql`
      SELECT sells.*, row_to_json(sec) AS security, row_to_json(acc) AS account
      FROM sells
      LEFT JOIN securities sec ON sells.security_id = sec.id
      LEFT JOIN accounts acc ON sells.account_id = acc.id
      ORDER BY sold_at DESC
    ` as unknown as Promise<SellRow[]>,
    sql`
      SELECT dividends.*, row_to_json(sec) AS security, row_to_json(acc) AS account
      FROM dividends
      LEFT JOIN securities sec ON dividends.security_id = sec.id
      LEFT JOIN accounts acc ON dividends.account_id = acc.id
      ORDER BY paid_at DESC
    ` as unknown as Promise<DividendRow[]>,
    sql`SELECT id, ticker, name FROM securities ORDER BY ticker` as unknown as Promise<SecurityRow[]>,
    sql`SELECT id, name, broker FROM accounts ORDER BY name` as unknown as Promise<AccountRow[]>,
    sql`SELECT * FROM account_securities` as unknown as Promise<AccountSecurity[]>,
  ])

  return (
    <IncomeDashboard
      sells={sells}
      dividends={dividends}
      securities={securities}
      accounts={accounts}
      accountSecurities={accountSecurities}
    />
  )
}
