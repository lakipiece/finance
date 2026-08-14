import { fetchPortfolioSummary, fetchTargetAllocations } from '@/lib/portfolio/fetch'
import { getSql } from '@/lib/db'
import PortfolioDashboard from '@/components/portfolio/PortfolioDashboard'

export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  const sql = getSql()
  const [summary, targets, optionColors] = await Promise.all([
    fetchPortfolioSummary(),
    fetchTargetAllocations(),
    sql<{ type: string; value: string; color_hex: string }[]>`
      SELECT type, value, color_hex FROM option_list
      WHERE type IN ('account_type', 'sector') AND color_hex IS NOT NULL
    `,
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
    />
  )
}
