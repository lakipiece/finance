import { fetchPortfolioSummary, fetchTargetAllocations } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import PortfolioDashboard from '@/components/portfolio/PortfolioDashboard'

export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  const sql = getSql()
  const [summary, targets, optionColors, cashflowSums] = await Promise.all([
    fetchPortfolioSummary(),
    fetchTargetAllocations(),
    sql<{ type: string; value: string; color_hex: string }[]>`
      SELECT type, value, color_hex FROM option_list
      WHERE type IN ('account_type', 'sector') AND color_hex IS NOT NULL
    `,
    // 입출금 원장 합계 (마이그레이션 전에는 테이블이 없을 수 있음)
    sql<{ account_id: string; inflow: number; outflow: number }[]>`
      SELECT account_id,
        COALESCE(SUM(amount) FILTER (WHERE type IN ('deposit','transfer_in','opening')), 0)::float AS inflow,
        COALESCE(SUM(amount) FILTER (WHERE type IN ('withdrawal','transfer_out')), 0)::float AS outflow
      FROM account_cashflows
      GROUP BY account_id
    `.catch(() => [] as { account_id: string; inflow: number; outflow: number }[]),
  ])
  const accountTypeColors: Record<string, string> = {}
  const sectorColors: Record<string, string> = {}
  for (const r of optionColors) {
    if (r.type === 'account_type') accountTypeColors[r.value] = r.color_hex
    else if (r.type === 'sector') sectorColors[r.value] = r.color_hex
  }
  return (
    <PortfolioDashboard
      summary={summary}
      targets={targets}
      accountTypeColors={accountTypeColors}
      sectorColors={sectorColors}
      cashflowSums={cashflowSums}
    />
  )
}
