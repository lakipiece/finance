import { getSql } from '@/lib/db'
import IncomeDashboard from '@/components/portfolio/IncomeDashboard'

export const dynamic = 'force-dynamic'

export default async function IncomePage() {
  const sql = getSql()
  const [sells, dividends, securities, accounts, accountSecurities] = await Promise.all([
    sql`
      SELECT sells.*, row_to_json(sec) AS security, row_to_json(acc) AS account
      FROM sells
      LEFT JOIN securities sec ON sells.security_id = sec.id
      LEFT JOIN accounts acc ON sells.account_id = acc.id
      ORDER BY sold_at DESC
    `,
    sql`
      SELECT dividends.*, row_to_json(sec) AS security, row_to_json(acc) AS account
      FROM dividends
      LEFT JOIN securities sec ON dividends.security_id = sec.id
      LEFT JOIN accounts acc ON dividends.account_id = acc.id
      ORDER BY paid_at DESC
    `,
    sql`SELECT id, ticker, name FROM securities ORDER BY ticker`,
    sql`SELECT id, name, broker FROM accounts ORDER BY name`,
    sql`SELECT * FROM account_securities`,
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
