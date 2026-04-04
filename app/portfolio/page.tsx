import { fetchPortfolioSummary, fetchTargetAllocations } from '@/lib/portfolio/fetch'
import PortfolioDashboard from '@/components/portfolio/PortfolioDashboard'

export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  const [summary, targets] = await Promise.all([
    fetchPortfolioSummary(),
    fetchTargetAllocations(),
  ])
  return <PortfolioDashboard summary={summary} targets={targets} />
}
