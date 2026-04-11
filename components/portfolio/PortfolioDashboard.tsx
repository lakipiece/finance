'use client'

import { useState, useMemo } from 'react'
import type { PortfolioSummary, TargetAllocation, PortfolioPosition, Account } from '@/lib/portfolio/types'
import PortfolioKpiCards from './PortfolioKpiCards'
import AllocationCharts from './AllocationCharts'
import PositionCards from './PositionCards'

interface Props {
  summary: PortfolioSummary
  targets: TargetAllocation[]
}

export interface MergedPosition {
  security: PortfolioPosition['security']
  accounts: Account[]
  quantity: number
  avg_price: number
  avg_price_usd: number | null
  current_price_usd: number | null
  total_invested: number
  current_price: number
  market_value: number
  unrealized_pnl: number
  unrealized_pct: number
  total_dividends: number
}

function mergeBySecuirty(positions: PortfolioPosition[]): MergedPosition[] {
  const map = new Map<string, MergedPosition>()
  for (const p of positions) {
    const key = p.security.id
    if (!map.has(key)) {
      map.set(key, {
        security: p.security,
        accounts: [p.account],
        quantity: p.quantity,
        avg_price: p.avg_price,
        avg_price_usd: p.avg_price_usd,
        current_price_usd: p.current_price_usd,
        total_invested: p.total_invested,
        current_price: p.current_price,
        market_value: p.market_value,
        unrealized_pnl: p.unrealized_pnl,
        unrealized_pct: p.unrealized_pct,
        total_dividends: p.total_dividends,
      })
    } else {
      const m = map.get(key)!
      if (!m.accounts.find(a => a.id === p.account.id)) m.accounts.push(p.account)
      m.quantity += p.quantity
      m.total_invested += p.total_invested
      m.market_value += p.market_value
      m.unrealized_pnl += p.unrealized_pnl
      m.total_dividends += p.total_dividends
    }
  }
  return [...map.values()].map(m => ({
    ...m,
    avg_price: m.quantity > 0 ? m.total_invested / m.quantity : 0,
    unrealized_pct: m.total_invested > 0 ? m.unrealized_pnl / m.total_invested : 0,
  }))
}

export default function PortfolioDashboard({ summary }: Props) {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(summary.last_price_updated_at)
  // 빈 Set = 전체 선택
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set())
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

  function toggleAccount(id: string) {
    setSelectedAccountIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setSelectedSector('all')
      return next
    })
  }

  function selectAll() {
    setSelectedAccountIds(new Set())
    setSelectedSector('all')
  }

  // 계좌 필터 적용
  const accountFiltered = useMemo(() =>
    selectedAccountIds.size === 0
      ? summary.positions
      : summary.positions.filter(p => selectedAccountIds.has(p.account.id)),
    [summary.positions, selectedAccountIds]
  )

  // 동일 종목 합산
  const mergedPositions = useMemo(() => mergeBySecuirty(accountFiltered), [accountFiltered])

  // 섹터 목록
  const sectors = useMemo(() => {
    const s = new Set(mergedPositions.map(p => p.security.sector ?? '기타'))
    return [...s].sort()
  }, [mergedPositions])

  // 섹터 필터
  const visibleMerged = useMemo(() =>
    selectedSector === 'all'
      ? mergedPositions
      : mergedPositions.filter(p => (p.security.sector ?? '기타') === selectedSector),
    [mergedPositions, selectedSector]
  )

  // 선택된 계좌 기준 KPI
  const filteredKpi = useMemo(() => {
    const mv = accountFiltered.reduce((s, p) => s + p.market_value, 0)
    const inv = accountFiltered.reduce((s, p) => s + p.total_invested, 0)
    const pnl = accountFiltered.reduce((s, p) => s + p.unrealized_pnl, 0)
    const div = accountFiltered.reduce((s, p) => s + p.total_dividends, 0)
    return {
      total_market_value: mv,
      total_invested: inv,
      total_unrealized_pnl: pnl,
      total_unrealized_pct: inv > 0 ? pnl / inv : 0,
      total_dividends: div,
      positions: accountFiltered,
      last_price_updated_at: summary.last_price_updated_at,
    }
  }, [accountFiltered, summary.last_price_updated_at])

  const visibleTotal = useMemo(
    () => visibleMerged.reduce((s, p) => s + p.market_value, 0),
    [visibleMerged]
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
        <button onClick={handleRefresh} disabled={refreshing}
          className="mt-4 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
          {refreshing ? '가격 수집 중...' : '가격 새로고침'}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

      {/* KPI 카드 (선택 계좌 기준) */}
      <PortfolioKpiCards summary={filteredKpi} />

      {/* 가격 새로고침 */}
      <div className="flex items-center justify-end gap-2">
        {refreshMsg && <span className="text-xs text-slate-500">{refreshMsg}</span>}
        {lastUpdated && <span className="text-xs text-slate-400">최근 수집: {lastUpdated}</span>}
        <button onClick={handleRefresh} disabled={refreshing}
          className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 disabled:opacity-50 transition-colors">
          {refreshing ? '수집 중...' : '가격 새로고침'}
        </button>
      </div>

      {/* 계좌 필터 (다중 선택) */}
      <div className="flex gap-2 flex-wrap">
        {/* 전체 */}
        <button
          onClick={selectAll}
          className={`rounded-xl border px-4 py-3 text-left transition-all w-36 shrink-0 ${
            selectedAccountIds.size === 0
              ? 'bg-slate-700 border-slate-700'
              : 'bg-white border-slate-100 hover:border-slate-300'
          }`}>
          <p className={`text-[10px] font-medium mb-0.5 ${selectedAccountIds.size === 0 ? 'text-slate-300' : 'text-slate-400'}`}>전체</p>
          <p className={`text-sm font-bold tabular-nums ${selectedAccountIds.size === 0 ? 'text-white' : 'text-slate-800'}`}>
            {Math.round(summary.total_market_value).toLocaleString()}원
          </p>
          <p className={`text-xs tabular-nums ${summary.total_unrealized_pnl >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
            {summary.total_unrealized_pnl >= 0 ? '+' : ''}{Math.round(summary.total_unrealized_pnl).toLocaleString()}원
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">{summary.positions.length}종목</p>
        </button>

        {Object.entries(accountGroups)
          .sort((a, b) => b[1].value - a[1].value)
          .map(([id, g]) => {
            const isSelected = selectedAccountIds.has(id)
            return (
              <button key={id}
                onClick={() => toggleAccount(id)}
                className={`rounded-xl border px-4 py-3 text-left transition-all w-36 shrink-0 relative ${
                  isSelected
                    ? 'bg-slate-700 border-slate-700'
                    : 'bg-white border-slate-100 hover:border-slate-300'
                }`}>
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
                )}
                <p className={`text-[10px] font-medium mb-0.5 truncate ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                  {g.label}
                </p>
                <p className={`text-sm font-bold tabular-nums ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                  {Math.round(g.value).toLocaleString()}원
                </p>
                <p className={`text-xs tabular-nums ${g.pnl >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                  {g.pnl >= 0 ? '+' : ''}{Math.round(g.pnl).toLocaleString()}원
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{g.count}종목</p>
              </button>
            )
          })}
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

      {/* 차트 (토글, 섹터 필터 무관하게 계좌 기준으로) */}
      {showCharts && <AllocationCharts positions={accountFiltered} />}

      {/* 종목 카드 (종목 합산, 섹터 필터 적용) */}
      <PositionCards positions={visibleMerged} totalValue={visibleTotal} />
    </div>
  )
}
