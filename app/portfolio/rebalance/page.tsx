import { fetchPortfolioSummary, fetchTargetAllocations } from '@/lib/portfolio/fetch'
import RebalanceDashboard from '@/components/portfolio/RebalanceDashboard'

export const dynamic = 'force-dynamic'

export default async function RebalancePage() {
  const [summary, targets] = await Promise.all([
    fetchPortfolioSummary(),
    fetchTargetAllocations(),
  ])
  return <RebalanceDashboard summary={summary} targets={targets} />
}
