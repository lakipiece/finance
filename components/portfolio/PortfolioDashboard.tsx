'use client'

import { useState, useMemo } from 'react'
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
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all')

  const accountGroups = useMemo(() =>
    summary.positions.reduce<Record<string, {
      label: string; value: number; pnl: number; count: number
    }>>((acc, p) => {
      const id = p.account.id
      if (!acc[id]) acc[id] = {
        label: `${p.account.broker} · ${p.account.name}`,
        value: 0, pnl: 0, count: 0
      }
      acc[id].value += p.market_value
      acc[id].pnl += p.unrealized_pnl
      acc[id].count++
      return acc
    }, {}),
    [summary.positions]
  )

  const visiblePositions = useMemo(() =>
    selectedAccountId === 'all'
      ? summary.positions
      : summary.positions.filter(p => p.account.id === selectedAccountId),
    [summary.positions, selectedAccountId]
  )

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
      {/* Account selector cards */}
      <div className="flex gap-2 flex-wrap">
        {/* 전체 card */}
        <button
          onClick={() => setSelectedAccountId('all')}
          className={`rounded-xl border px-4 py-2.5 text-left transition-all min-w-[8rem] ${
            selectedAccountId === 'all'
              ? 'bg-slate-700 border-slate-700'
              : 'bg-white border-slate-100 hover:border-slate-300'
          }`}
        >
          <p className={`text-[10px] font-medium mb-0.5 ${selectedAccountId === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>
            전체
          </p>
          <p className={`text-sm font-bold ${selectedAccountId === 'all' ? 'text-white' : 'text-slate-800'}`}>
            {summary.total_market_value.toLocaleString()}원
          </p>
          <p className={`text-xs ${summary.total_unrealized_pnl >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
            {summary.total_unrealized_pnl >= 0 ? '+' : ''}{summary.total_unrealized_pnl.toLocaleString()}원
            <span className="ml-1 text-[10px] opacity-70">{summary.positions.length}종목</span>
          </p>
        </button>

        {/* Per-account cards */}
        {Object.entries(accountGroups)
          .sort((a, b) => b[1].value - a[1].value)
          .map(([id, g]) => (
            <button
              key={id}
              onClick={() => setSelectedAccountId(id)}
              className={`rounded-xl border px-4 py-2.5 text-left transition-all min-w-[8rem] ${
                selectedAccountId === id
                  ? 'bg-slate-700 border-slate-700'
                  : 'bg-white border-slate-100 hover:border-slate-300'
              }`}
            >
              <p className={`text-[10px] font-medium mb-0.5 truncate max-w-[7rem] ${selectedAccountId === id ? 'text-slate-300' : 'text-slate-400'}`}>
                {g.label}
              </p>
              <p className={`text-sm font-bold ${selectedAccountId === id ? 'text-white' : 'text-slate-800'}`}>
                {g.value.toLocaleString()}원
              </p>
              <p className={`text-xs ${g.pnl >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                {g.pnl >= 0 ? '+' : ''}{g.pnl.toLocaleString()}원
                <span className="ml-1 text-[10px] opacity-70">{g.count}종목</span>
              </p>
            </button>
          ))}
      </div>

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
      <AllocationCharts positions={visiblePositions} />
      <PositionsTable positions={visiblePositions} />
    </div>
  )
}
