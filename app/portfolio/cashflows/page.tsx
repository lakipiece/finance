import { getSql } from '@/lib/db'
import { fetchAccounts, fetchPortfolioSummary } from '@/lib/portfolio/fetch'
import CashflowManager from '@/components/portfolio/CashflowManager'
import type { Cashflow } from '@/lib/portfolio/types'

export const dynamic = 'force-dynamic'

export default async function CashflowsPage() {
  const sql = getSql()

  // 실시간 평가액 (계좌별) — 실패해도 페이지는 유지
  const summary = await fetchPortfolioSummary().catch(() => null)
  const accountValues: Record<string, number> = {}
  for (const p of summary?.positions ?? []) {
    accountValues[p.account.id] = (accountValues[p.account.id] ?? 0) + p.market_value
  }

  const accounts = await fetchAccounts()

  // 마이그레이션 전(테이블 없음)에도 안내와 함께 렌더
  let cashflows: Cashflow[] = []
  let tableMissing = false
  try {
    const rows = await sql`
      SELECT cf.id, cf.account_id, cf.flow_date, cf.type, cf.amount, cf.memo,
        json_build_object('name', a.name, 'broker', a.broker, 'owner', a.owner) AS account
      FROM account_cashflows cf
      JOIN accounts a ON a.id = cf.account_id
      ORDER BY cf.flow_date DESC, cf.created_at DESC
    `
    cashflows = rows.map(r => ({
      id: r.id,
      account_id: r.account_id,
      flow_date: r.flow_date instanceof Date ? r.flow_date.toISOString().slice(0, 10) : String(r.flow_date).slice(0, 10),
      type: r.type,
      amount: Number(r.amount),
      memo: r.memo ?? '',
      account: r.account,
    })) as Cashflow[]
  } catch {
    tableMissing = true
  }

  return (
    <CashflowManager
      accounts={accounts}
      cashflows={cashflows}
      accountValues={accountValues}
      tableMissing={tableMissing}
    />
  )
}
