'use client'

import { useState, useMemo } from 'react'
import type { PortfolioSummary, TargetAllocation, PortfolioPosition, Account } from '@/lib/portfolio/types'
import PortfolioKpiCards from './PortfolioKpiCards'
import AllocationCharts from './AllocationCharts'
import PositionCards from './PositionCards'

interface Props {
  summary: PortfolioSummary
  targets: TargetAllocation[]
  accountTypeColors?: Record<string, string>
  sectorColors?: Record<string, string>
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

export default function PortfolioDashboard({ summary, accountTypeColors = {}, sectorColors = {} }: Props) {
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(summary.last_price_updated_at)
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set())
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set())
  const [showAccounts, setShowAccounts] = useState(true)
  const [showCharts, setShowCharts] = useState(false)

  // 계좌별 집계 (account type 포함)
  const accountGroups = useMemo(() =>
    summary.positions.reduce<Record<string, {
      name: string; type: string | null; value: number; pnl: number; invested: number; count: number
    }>>((acc, p) => {
      const id = p.account.id
      if (!acc[id]) acc[id] = {
        name: p.account.name,
        type: p.account.type,
        value: 0, pnl: 0, invested: 0, count: 0,
      }
      acc[id].value += p.market_value
      acc[id].pnl += p.unrealized_pnl
      acc[id].invested += p.total_invested
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
      setSelectedSectors(new Set())
      return next
    })
  }

  function selectAll() {
    setSelectedAccountIds(new Set())
    setSelectedSectors(new Set())
  }

  function toggleSector(sector: string) {
    setSelectedSectors(prev => {
      const next = new Set(prev)
      if (next.has(sector)) next.delete(sector)
      else next.add(sector)
      return next
    })
  }

  function clearSectors() {
    setSelectedSectors(new Set())
  }

  const accountFiltered = useMemo(() =>
    selectedAccountIds.size === 0
      ? summary.positions
      : summary.positions.filter(p => selectedAccountIds.has(p.account.id)),
    [summary.positions, selectedAccountIds]
  )

  const mergedPositions = useMemo(() => mergeBySecuirty(accountFiltered), [accountFiltered])

  const sectors = useMemo(() => {
    const s = new Set(mergedPositions.map(p => p.security.sector ?? '기타'))
    return [...s].sort()
  }, [mergedPositions])

  const visibleMerged = useMemo(() =>
    selectedSectors.size === 0
      ? mergedPositions
      : mergedPositions.filter(p => selectedSectors.has(p.security.sector ?? '기타')),
    [mergedPositions, selectedSectors]
  )

  const filteredKpi = useMemo(() => {
    const mv = visibleMerged.reduce((s, p) => s + p.market_value, 0)
    const inv = visibleMerged.reduce((s, p) => s + p.total_invested, 0)
    const pnl = visibleMerged.reduce((s, p) => s + p.unrealized_pnl, 0)
    const div = visibleMerged.reduce((s, p) => s + p.total_dividends, 0)
    return {
      total_market_value: mv,
      total_invested: inv,
      total_unrealized_pnl: pnl,
      total_unrealized_pct: inv > 0 ? pnl / inv : 0,
      total_dividends: div,
      positions: accountFiltered,
      last_price_updated_at: summary.last_price_updated_at,
    }
  }, [visibleMerged, accountFiltered, summary.last_price_updated_at])

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

      <PortfolioKpiCards summary={filteredKpi} />

      <div className="flex items-center justify-end gap-2">
        {refreshMsg && <span className="text-xs text-slate-500">{refreshMsg}</span>}
        {lastUpdated && <span className="text-xs text-slate-400">최근 수집: {lastUpdated}</span>}
        <button
          onClick={() => setShowCharts(v => !v)}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            showCharts
              ? 'bg-slate-100 border-slate-300 text-slate-700'
              : 'border-slate-200 text-slate-500 hover:border-slate-400'
          }`}>
          {showCharts ? '차트 닫기' : '차트 보기'}
        </button>
        <button onClick={handleRefresh} disabled={refreshing}
          className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 disabled:opacity-50 transition-colors">
          {refreshing ? '수집 중...' : '가격 새로고침'}
        </button>
      </div>

      {/* 계좌 필터 — 접기/펼치기 */}
      <div>
        <button
          onClick={() => setShowAccounts(v => !v)}
          className="flex items-center gap-1.5 mb-2 group"
        >
          <span className="text-xs font-medium text-slate-400 group-hover:text-slate-600 transition-colors">계좌</span>
          {selectedAccountIds.size > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-white tabular-nums">
              {selectedAccountIds.size}
            </span>
          )}
          <svg
            className={`w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-all ${showAccounts ? '' : '-rotate-90'}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAccounts && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {/* 전체 */}
            <button
              onClick={selectAll}
              title={`${summary.positions.length}종목`}
              className={`rounded-xl border px-3 py-3 text-right transition-all min-w-0 ${
                selectedAccountIds.size === 0
                  ? 'bg-slate-700 border-slate-700'
                  : 'bg-white border-slate-100 hover:border-slate-300'
              }`}>
              <p className={`text-[10px] font-medium mb-1 text-left ${selectedAccountIds.size === 0 ? 'text-slate-300' : 'text-slate-400'}`}>전체</p>
              <p className={`text-sm font-bold tabular-nums leading-tight ${selectedAccountIds.size === 0 ? 'text-white' : 'text-slate-500'}`}>
                {Math.round(summary.total_market_value).toLocaleString()}원
              </p>
              <p className={`text-xs tabular-nums mt-0.5 text-right ${summary.total_unrealized_pnl >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                {summary.total_unrealized_pnl >= 0 ? '+' : ''}{Math.round(summary.total_unrealized_pnl).toLocaleString()}원
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-400 opacity-0">-</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
                  summary.total_unrealized_pnl >= 0 ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'
                }`}>
                  {summary.total_unrealized_pnl >= 0 ? '+' : ''}{(summary.total_unrealized_pct * 100).toFixed(1)}%
                </span>
              </div>
            </button>

            {Object.entries(accountGroups)
              .sort((a, b) => b[1].value - a[1].value)
              .map(([id, g]) => {
                const isSelected = selectedAccountIds.has(id)
                const typeColor = g.type ? (accountTypeColors[g.type] ?? null) : null
                return (
                  <button key={id}
                    onClick={() => toggleAccount(id)}
                    title={`${g.count}종목`}
                    className={`rounded-xl border px-3 py-3 text-right transition-all min-w-0 relative ${
                      isSelected
                        ? 'bg-slate-700 border-slate-700'
                        : 'bg-white border-slate-100 hover:border-slate-300'
                    }`}>
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                    <div className="flex items-center gap-1.5 mb-1">
                      {typeColor && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: typeColor }} />
                      )}
                      <p className={`text-xs font-semibold truncate leading-tight ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                        {g.name}
                      </p>
                    </div>
                    <p className={`text-sm font-bold tabular-nums leading-tight text-right ${isSelected ? 'text-white' : 'text-slate-500'}`}>
                      {Math.round(g.value).toLocaleString()}원
                    </p>
                    <p className={`text-xs tabular-nums mt-0.5 text-right ${g.pnl >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                      {g.pnl >= 0 ? '+' : ''}{Math.round(g.pnl).toLocaleString()}원
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[10px] tabular-nums ${isSelected ? 'text-slate-400' : 'text-slate-300'}`}>
                        {summary.total_market_value > 0 ? (g.value / summary.total_market_value * 100).toFixed(1) : '0.0'}%
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
                        g.pnl >= 0
                          ? (isSelected ? 'bg-rose-400/20 text-rose-300' : 'bg-rose-50 text-rose-500')
                          : (isSelected ? 'bg-blue-400/20 text-blue-300' : 'bg-blue-50 text-blue-500')
                      }`}>
                        {g.pnl >= 0 ? '+' : ''}{g.invested > 0 ? (g.pnl / g.invested * 100).toFixed(1) : '0.0'}%
                      </span>
                    </div>
                  </button>
                )
              })}
          </div>
        )}
      </div>

      {/* 섹터 필터 — 다중선택 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={clearSectors}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            selectedSectors.size === 0
              ? 'bg-slate-600 text-white border-slate-600'
              : 'border-slate-200 text-slate-500 hover:border-slate-400'
          }`}>
          전체
        </button>
        {sectors.map(s => {
          const color = sectorColors[s] ?? null
          const isSelected = selectedSectors.has(s)
          return (
            <button key={s}
              onClick={() => toggleSector(s)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                isSelected
                  ? 'bg-slate-600 text-white border-slate-600'
                  : 'border-slate-200 text-slate-500 hover:border-slate-400'
              }`}>
              {color && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: isSelected ? 'white' : color }} />
              )}
              {s}
            </button>
          )
        })}
      </div>

      {/* 차트 */}
      {showCharts && <AllocationCharts
        allPositions={summary.positions}
        positions={accountFiltered.filter(p =>
          selectedSectors.size === 0 || selectedSectors.has(p.security.sector ?? '기타')
        )}
        sectorColors={sectorColors}
      />}

      <PositionCards positions={visibleMerged} totalValue={visibleTotal} sectorColors={sectorColors} />
    </div>
  )
}
