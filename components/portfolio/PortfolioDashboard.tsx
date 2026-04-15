'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { PortfolioSummary, TargetAllocation, PortfolioPosition, Account } from '@/lib/portfolio/types'
import { useTheme } from '@/lib/ThemeContext'
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
  accountValues: Record<string, number>
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
        accountValues: { [p.account.id]: p.market_value },
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
      m.accountValues[p.account.id] = (m.accountValues[p.account.id] ?? 0) + p.market_value
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

function SectionHeader({
  label,
  open,
  onToggle,
  badge,
}: {
  label: string
  open: boolean
  onToggle: () => void
  badge?: number
}) {
  const { palette } = useTheme()
  return (
    <button onClick={onToggle} className="flex items-center gap-1.5 group">
      <span className="text-sm font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white tabular-nums"
          style={{ backgroundColor: palette.colors[0] }}>{badge}</span>
      )}
      <svg
        className={`w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-all ${open ? '' : '-rotate-90'}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

export default function PortfolioDashboard({ summary, accountTypeColors = {}, sectorColors = {} }: Props) {
  const { palette } = useTheme()
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(summary.last_price_updated_at)
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set())
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set())
  const [showAccounts, setShowAccounts] = useState(true)
  const [showSectors, setShowSectors] = useState(true)
  const [showCharts, setShowCharts] = useState(true)
  const [showPositions, setShowPositions] = useState(true)

  const accountGroups = useMemo(() =>
    summary.positions.reduce<Record<string, {
      name: string; type: string | null; value: number; pnl: number; invested: number; count: number
    }>>((acc, p) => {
      const id = p.account.id
      if (!acc[id]) acc[id] = { name: p.account.name, type: p.account.type, value: 0, pnl: 0, invested: 0, count: 0 }
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

  const chartPositions = useMemo(() =>
    accountFiltered.filter(p =>
      selectedSectors.size === 0 || selectedSectors.has(p.security.sector ?? '기타')
    ),
    [accountFiltered, selectedSectors]
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
        if (json.failed?.length > 0) console.warn('[price refresh] failed:', json.failed)
        setRefreshMsg(`${json.saved}개 저장 완료${failedMsg} ${json.failed?.length > 0 ? '— 콘솔 확인' : ''}`)
        setLastUpdated(new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }))
        router.refresh()
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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      {/* 최상단 툴바 */}
      <div className="flex items-center justify-end gap-2">
        {refreshMsg && <span className="text-[10px] text-slate-400">{refreshMsg}</span>}
        {lastUpdated && (
          <span className="text-[10px] text-slate-300 tabular-nums">{lastUpdated}</span>
        )}
        <button onClick={handleRefresh} disabled={refreshing}
          className="text-slate-300 hover:text-slate-500 disabled:opacity-40 transition-colors"
          title={refreshing ? '수집 중...' : '가격 새로고침'}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}>
            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.389zm1.26-3.674a.75.75 0 00.219-.53V2.978a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.27 8.236a.75.75 0 101.449.389A5.5 5.5 0 0113.92 6.159l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <PortfolioKpiCards summary={filteredKpi} />

      {/* 계좌 섹션 */}
      <div>
        <div className="mb-2">
          <SectionHeader
            label="계좌"
            open={showAccounts}
            onToggle={() => setShowAccounts(v => !v)}
            badge={selectedAccountIds.size}
          />
        </div>
        {showAccounts && (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <button
              onClick={selectAll}
              title={`${summary.positions.length}종목`}
              className={`rounded-xl border px-3 py-3 text-right transition-all min-w-0 ${
                selectedAccountIds.size === 0
                  ? 'bg-slate-50'
                  : 'bg-white border-slate-100 hover:border-slate-300'
              }`}
              style={selectedAccountIds.size === 0 ? { borderColor: palette.colors[0] } : undefined}>
              <p className={`text-[10px] font-medium mb-1 text-left ${selectedAccountIds.size === 0 ? 'text-slate-500' : 'text-slate-400'}`}>전체</p>
              <p className={`text-sm font-bold tabular-nums leading-tight ${selectedAccountIds.size === 0 ? 'text-slate-700' : 'text-slate-500'}`}>
                {Math.round(summary.total_market_value).toLocaleString()}원
              </p>
              <p className={`text-xs tabular-nums mt-0.5 text-right ${summary.total_unrealized_pnl >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                {summary.total_unrealized_pnl >= 0 ? '+' : ''}{Math.round(summary.total_unrealized_pnl).toLocaleString()}원
              </p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-slate-400 opacity-0">-</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
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
                      isSelected ? 'bg-slate-50' : 'bg-white border-slate-100 hover:border-slate-300'
                    }`}
                    style={isSelected ? { borderColor: palette.colors[0] } : undefined}>
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-slate-400" />
                    )}
                    <div className="flex items-center gap-1.5">
                      {typeColor && (
                        <span className="w-2 h-2 rounded-full shrink-0 self-center" style={{ backgroundColor: typeColor }} />
                      )}
                      <p className={`text-xs font-semibold truncate leading-none ${isSelected ? 'text-slate-700' : 'text-slate-700'}`}>
                        {g.name}
                      </p>
                    </div>
                    <div className={`border-t mt-1.5 mb-1.5 ${isSelected ? 'border-slate-200' : 'border-slate-50'}`} />
                    <p className={`text-sm font-bold tabular-nums leading-tight text-right ${isSelected ? 'text-slate-700' : 'text-slate-500'}`}>
                      {Math.round(g.value).toLocaleString()}원
                    </p>
                    <p className={`text-xs tabular-nums mt-0.5 text-right ${g.pnl >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                      {g.pnl >= 0 ? '+' : ''}{Math.round(g.pnl).toLocaleString()}원
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[10px] tabular-nums ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                        {summary.total_market_value > 0 ? (g.value / summary.total_market_value * 100).toFixed(1) : '0.0'}%
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${
                        g.pnl >= 0
                          ? 'bg-rose-50 text-rose-500'
                          : 'bg-blue-50 text-blue-500'
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

      {/* 섹터 섹션 */}
      <div>
        <div className="mb-2">
          <SectionHeader
            label="섹터"
            open={showSectors}
            onToggle={() => setShowSectors(v => !v)}
            badge={selectedSectors.size}
          />
        </div>
        {showSectors && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedSectors(new Set())}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                selectedSectors.size === 0
                  ? 'bg-slate-50 text-slate-700 font-medium'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
              }`}
              style={selectedSectors.size === 0 ? { borderColor: palette.colors[0] } : undefined}>
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
                      ? 'bg-slate-50 text-slate-700 font-medium'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}
                  style={isSelected ? { borderColor: palette.colors[0] } : undefined}>
                  {color && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  )}
                  {s}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 차트 섹션 */}
      <div>
        <div className="mb-2">
          <SectionHeader
            label="차트"
            open={showCharts}
            onToggle={() => setShowCharts(v => !v)}
          />
        </div>
        {showCharts && (
          <AllocationCharts
            allPositions={summary.positions}
            positions={chartPositions}
            sectorColors={sectorColors}
          />
        )}
      </div>

      {/* 종목 섹션 */}
      <div>
        <div className="mb-2">
          <SectionHeader
            label="종목"
            open={showPositions}
            onToggle={() => setShowPositions(v => !v)}
            badge={visibleMerged.length}
          />
        </div>
        {showPositions && (
          <PositionCards positions={visibleMerged} totalValue={visibleTotal} sectorColors={sectorColors} />
        )}
      </div>

    </div>
  )
}
