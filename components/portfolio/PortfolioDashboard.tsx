'use client'

import type { PortfolioSummary, TargetAllocation } from '@/lib/portfolio/types'
import PortfolioKpiCards from './PortfolioKpiCards'
import AllocationCharts from './AllocationCharts'
import PositionsTable from './PositionsTable'

interface Props {
  summary: PortfolioSummary
  targets: TargetAllocation[]
}

export default function PortfolioDashboard({ summary }: Props) {
  if (summary.positions.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-400">보유 종목이 없습니다.</p>
        <p className="text-sm text-slate-300 mt-1">
          <a href="/portfolio/import" className="underline">구글시트에서 import</a> 하거나
          <a href="/portfolio/holdings" className="underline ml-1">직접 입력</a>하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <PortfolioKpiCards summary={summary} />
      <AllocationCharts positions={summary.positions} />
      <PositionsTable positions={summary.positions} />
    </div>
  )
}
