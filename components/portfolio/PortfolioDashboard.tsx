'use client'

import { useState } from 'react'
import type { PortfolioSummary, TargetAllocation } from '@/lib/portfolio/types'
import PortfolioKpiCards from './PortfolioKpiCards'
import AllocationCharts from './AllocationCharts'
import PositionsTable from './PositionsTable'

interface Props {
  summary: PortfolioSummary
  targets: TargetAllocation[]
}

export default function PortfolioDashboard({ summary }: Props) {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(summary.last_price_updated_at)

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const res = await fetch('/api/portfolio/prices/refresh', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setRefreshMsg(`오류: ${json.error}`)
      } else {
        const failedMsg = json.failed?.length > 0 ? ` (${json.failed.length}개 실패)` : ''
        setRefreshMsg(`${json.saved}개 저장 완료${failedMsg}`)
        setLastUpdated(new Date().toISOString().slice(0, 10))
      }
    } catch {
      setRefreshMsg('새로고침 실패')
    } finally {
      setRefreshing(false)
    }
  }

  if (summary.positions.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-400">보유 종목이 없습니다.</p>
        <p className="text-sm text-slate-300 mt-1">
          <a href="/portfolio/import" className="underline">구글시트에서 import</a> 하거나
          <a href="/portfolio/holdings" className="underline ml-1">직접 입력</a>하세요.
        </p>
        <button onClick={handleRefresh} disabled={refreshing}
          className="mt-4 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
          {refreshing ? '가격 수집 중...' : '가격 새로고침'}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            {refreshMsg && (
              <span className="text-xs text-slate-500">{refreshMsg}</span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {refreshing ? '수집 중...' : '가격 새로고침'}
            </button>
          </div>
          {lastUpdated && (
            <span className="text-xs text-slate-400">최근 수집: {lastUpdated}</span>
          )}
        </div>
      </div>
      <PortfolioKpiCards summary={summary} />
      <AllocationCharts positions={summary.positions} />
      <PositionsTable positions={summary.positions} />
    </div>
  )
}
