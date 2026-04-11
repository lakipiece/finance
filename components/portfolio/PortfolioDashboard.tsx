'use client'

import { useState, useMemo } from 'react'
import type { PortfolioSummary, TargetAllocation } from '@/lib/portfolio/types'
import PortfolioKpiCards from './PortfolioKpiCards'
import AllocationCharts from './AllocationCharts'
import PositionCards from './PositionCards'

interface Props {
  summary: PortfolioSummary
  targets: TargetAllocation[]
}

export default function PortfolioDashboard({ summary }: Props) {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(summary.last_price_updated_at)
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all')
  const [selectedSector, setSelectedSector] = useState<string | 'all'>('all')
  const [showCharts, setShowCharts] = useState(false)

  // 계좌별 집계
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

  // 계좌 필터 적용 후 포지션
  const accountFiltered = useMemo(() =>
    selectedAccountId === 'all'
      ? summary.positions
      : summary.positions.filter(p => p.account.id === selectedAccountId),
    [summary.positions, selectedAccountId]
  )

  // 사용 가능한 섹터 목록
  const sectors = useMemo(() => {
    const s = new Set(accountFiltered.map(p => p.security.sector ?? '기타'))
    return [...s].sort()
  }, [accountFiltered])

  // 섹터 필터 적용
  const visiblePositions = useMemo(() =>
    selectedSector === 'all'
      ? accountFiltered
      : accountFiltered.filter(p => (p.security.sector ?? '기타') === selectedSector),
    [accountFiltered, selectedSector]
  )

  const visibleTotal = useMemo(
    () => visiblePositions.reduce((s, p) => s + p.market_value, 0),
    [visiblePositions]
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
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* KPI 카드 */}
      <PortfolioKpiCards summary={summary} />

      {/* 가격 새로고침 */}
      <div className="flex items-center justify-end gap-2">
        {refreshMsg && <span className="text-xs text-slate-500">{refreshMsg}</span>}
        {lastUpdated && <span className="text-xs text-slate-400">최근 수집: {lastUpdated}</span>}
        <button onClick={handleRefresh} disabled={refreshing}
          className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 disabled:opacity-50 transition-colors">
          {refreshing ? '수집 중...' : '가격 새로고침'}
        </button>
      </div>

      {/* 계좌 필터 chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedAccountId('all')}
          className={`rounded-xl border px-4 py-2.5 text-left transition-all min-w-[7rem] ${
            selectedAccountId === 'all'
              ? 'bg-slate-700 border-slate-700'
              : 'bg-white border-slate-100 hover:border-slate-300'
          }`}>
          <p className={`text-[10px] font-medium mb-0.5 ${selectedAccountId === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>전체</p>
          <p className={`text-sm font-bold tabular-nums ${selectedAccountId === 'all' ? 'text-white' : 'text-slate-800'}`}>
            {Math.round(summary.total_market_value).toLocaleString()}원
          </p>
          <p className={`text-xs tabular-nums ${summary.total_unrealized_pnl >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
            {summary.total_unrealized_pnl >= 0 ? '+' : ''}{Math.round(summary.total_unrealized_pnl).toLocaleString()}원
            <span className="ml-1 text-[10px] opacity-70">{summary.positions.length}종목</span>
          </p>
        </button>

        {Object.entries(accountGroups)
          .sort((a, b) => b[1].value - a[1].value)
          .map(([id, g]) => (
            <button key={id}
              onClick={() => { setSelectedAccountId(id); setSelectedSector('all') }}
              className={`rounded-xl border px-4 py-2.5 text-left transition-all min-w-[7rem] ${
                selectedAccountId === id
                  ? 'bg-slate-700 border-slate-700'
                  : 'bg-white border-slate-100 hover:border-slate-300'
              }`}>
              <p className={`text-[10px] font-medium mb-0.5 truncate max-w-[7rem] ${selectedAccountId === id ? 'text-slate-300' : 'text-slate-400'}`}>
                {g.label}
              </p>
              <p className={`text-sm font-bold tabular-nums ${selectedAccountId === id ? 'text-white' : 'text-slate-800'}`}>
                {Math.round(g.value).toLocaleString()}원
              </p>
              <p className={`text-xs tabular-nums ${g.pnl >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                {g.pnl >= 0 ? '+' : ''}{Math.round(g.pnl).toLocaleString()}원
                <span className="ml-1 text-[10px] opacity-70">{g.count}종목</span>
              </p>
            </button>
          ))}
      </div>

      {/* 섹터 필터 + 차트 토글 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <span className="text-[10px] text-slate-400 font-medium">섹터</span>
          <button
            onClick={() => setSelectedSector('all')}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              selectedSector === 'all'
                ? 'bg-slate-600 text-white border-slate-600'
                : 'border-slate-200 text-slate-500 hover:border-slate-400'
            }`}>
            전체
          </button>
          {sectors.map(s => (
            <button key={s}
              onClick={() => setSelectedSector(s)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                selectedSector === s
                  ? 'bg-slate-600 text-white border-slate-600'
                  : 'border-slate-200 text-slate-500 hover:border-slate-400'
              }`}>
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCharts(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors shrink-0 ${
            showCharts
              ? 'bg-slate-100 border-slate-300 text-slate-700'
              : 'border-slate-200 text-slate-500 hover:border-slate-400'
          }`}>
          {showCharts ? '차트 닫기' : '차트 보기'}
        </button>
      </div>

      {/* 차트 (토글) */}
      {showCharts && <AllocationCharts positions={accountFiltered} />}

      {/* 종목 카드 */}
      <PositionCards positions={visiblePositions} totalValue={visibleTotal} />
    </div>
  )
}
