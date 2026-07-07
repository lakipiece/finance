import { getSql } from '@/lib/db'
import IncomeDashboard from '@/components/portfolio/IncomeDashboard'
import { fetchPortfolioSummary } from '@/lib/portfolio/fetch'
import type { Dividend, Security, Account } from '@/lib/portfolio/types'

export const dynamic = 'force-dynamic'

type DividendRow = Dividend & { security: Pick<Security, 'ticker' | 'name' | 'currency'>; account: Pick<Account, 'name' | 'broker' | 'owner'> }
type SecurityRow = Pick<Security, 'id' | 'ticker' | 'name' | 'currency'>
type AccountRow = Pick<Account, 'id' | 'name' | 'broker' | 'owner' | 'dividend_eligible' | 'dividend_tax_rate'>
type AccountSecurity = { account_id: string; security_id: string }

export default async function IncomePage() {
  const sql = getSql()

  try {
    // 종목별 투자금·평가금 (실시간 시세 기반). 실패해도 income 페이지는 유지.
    const summaryPromise = fetchPortfolioSummary().catch((e: any) => {
      console.error('[IncomePage] 포트폴리오 요약 로드 실패:', e?.message ?? e)
      return null
    })

    const [dividends, securities, accounts, accountSecurities, summary] = await Promise.all([
      sql`
        SELECT d.*,
          json_build_object('ticker', s.ticker, 'name', s.name, 'currency', COALESCE(ol.value, 'KRW')) AS security,
          json_build_object('name', a.name, 'broker', a.broker, 'owner', a.owner) AS account
        FROM dividends d
        JOIN securities s ON s.id = d.security_id
        LEFT JOIN option_list ol ON s.currency_id = ol.id
        JOIN accounts a ON a.id = d.account_id
        ORDER BY d.paid_at DESC
      ` as unknown as Promise<DividendRow[]>,
      sql`
        SELECT s.id, s.ticker, s.name, COALESCE(ol.value, 'KRW') AS currency
        FROM securities s
        LEFT JOIN option_list ol ON s.currency_id = ol.id
        ORDER BY s.ticker
      ` as unknown as Promise<SecurityRow[]>,
      sql`SELECT id, name, broker, owner, dividend_eligible, dividend_tax_rate
          FROM accounts ORDER BY name` as unknown as Promise<AccountRow[]>,
      sql`SELECT account_id, security_id FROM account_securities` as unknown as Promise<AccountSecurity[]>,
      summaryPromise,
    ])

    // 종목별 투자금·평가금 (계좌 단위) → 클라이언트에서 필터 반영해 집계
    const positions = (summary?.positions ?? []).map(p => ({
      ticker: p.security.ticker,
      account_id: String(p.account.id),
      owner: p.account.owner,
      invested: p.total_invested,
      marketValue: p.market_value,
    }))

    return (
      <IncomeDashboard
        dividends={dividends}
        securities={securities}
        accounts={accounts}
        accountSecurities={accountSecurities}
        positions={positions}
      />
    )
  } catch (e: any) {
    console.error('[IncomePage] DB 오류:', e?.message ?? e)
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-red-500 font-semibold mb-2">데이터 로드 실패</p>
        <p className="text-xs text-slate-400">{e?.message ?? '알 수 없는 오류'}</p>
      </div>
    )
  }
}
