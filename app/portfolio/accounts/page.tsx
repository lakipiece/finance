import { fetchAccounts, fetchSecurities, fetchPortfolioSummary } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import AccountsManager from '@/components/portfolio/AccountsManager'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const sql = getSql()
  const [accounts, securities, accountSecurities, optionsRaw, allOptionsRaw, summary] = await Promise.all([
    fetchAccounts(),
    fetchSecurities(),
    sql`SELECT * FROM account_securities` as unknown as Promise<{ account_id: string; security_id: string }[]>,
    sql`SELECT id, label, value, color_hex FROM option_list WHERE type = 'account_type' ORDER BY sort_order` as unknown as Promise<{ id: string; label: string; value: string; color_hex: string | null }[]>,
    sql`SELECT type, value, color_hex FROM option_list WHERE type IN ('sector','country','currency') AND color_hex IS NOT NULL` as unknown as Promise<{ type: string; value: string; color_hex: string }[]>,
    // 입출금 탭의 실질수익 계산용 — 실패해도 계좌 관리는 동작
    fetchPortfolioSummary().catch(() => null),
  ])

  const accountValues: Record<string, number> = {}
  for (const p of summary?.positions ?? []) {
    accountValues[p.account.id] = (accountValues[p.account.id] ?? 0) + p.market_value
  }
  const typeColors: Record<string, string> = {}
  const sectorColors: Record<string, string> = {}
  const countryColors: Record<string, string> = {}
  const currencyColors: Record<string, string> = {}
  for (const o of optionsRaw) {
    if (o.color_hex) typeColors[o.value] = o.color_hex
  }
  for (const o of allOptionsRaw) {
    if (o.type === 'sector') sectorColors[o.value] = o.color_hex
    else if (o.type === 'country') countryColors[o.value] = o.color_hex
    else if (o.type === 'currency') currencyColors[o.value] = o.color_hex
  }
  return (
    <AccountsManager
      accounts={accounts}
      securities={securities}
      accountSecurities={accountSecurities}
      typeColors={typeColors}
      accountTypeOptions={optionsRaw}
      sectorColors={sectorColors}
      countryColors={countryColors}
      currencyColors={currencyColors}
      accountValues={accountValues}
    />
  )
}
