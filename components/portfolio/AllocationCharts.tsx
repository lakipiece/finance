'use client'

import { useState } from 'react'
import type { PortfolioPosition } from '@/lib/portfolio/types'
import { useTheme } from '@/lib/ThemeContext'

const GREY = '#e2e8f0'

interface Props {
  allPositions: PortfolioPosition[]
  positions: PortfolioPosition[]
  sectorColors?: Record<string, string>
}

type Segment = { name: string; value: number; pct: number; color: string }
type DimRow = { label: string; segments: Segment[]; total: number }

function groupBy(
  arr: PortfolioPosition[],
  key: (p: PortfolioPosition) => string,
  vk: 'market_value' | 'total_invested',
): { name: string; value: number }[] {
  const map: Record<string, number> = {}
  for (const p of arr) {
    const k = key(p)
    map[k] = (map[k] ?? 0) + p[vk]
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
}

function toSegments(
  data: { name: string; value: number }[],
  total: number,
  colorFn: (name: string, i: number) => string,
): Segment[] {
  return data.map((d, i) => ({
    name: d.name,
    value: d.value,
    pct: total > 0 ? d.value / total * 100 : 0,
    color: colorFn(d.name, i),
  }))
}

function fmtKRW(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억원`
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만원`
  return `${v.toLocaleString()}원`
}

function DetailPanel({ row }: { row: DimRow }) {
  return (
    <div className="ml-14 mt-1.5 bg-slate-50 rounded-xl border border-slate-100 px-3 py-2.5 space-y-1.5">
      {row.segments.map((seg, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
          <span className="text-[10px] text-slate-600 flex-1 truncate">{seg.name}</span>
          <div className="w-20 bg-slate-200 rounded-full h-1 overflow-hidden">
            <div className="h-1 rounded-full" style={{ width: `${seg.pct}%`, backgroundColor: seg.color }} />
          </div>
          <span className="text-[10px] text-slate-400 tabular-nums w-8 text-right">{seg.pct.toFixed(1)}%</span>
          <span className="text-[10px] text-slate-600 tabular-nums w-16 text-right">{fmtKRW(seg.value)}</span>
        </div>
      ))}
    </div>
  )
}

function StackBar({
  row,
  isExpanded,
  onToggle,
}: {
  row: DimRow
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 group"
      >
        <span className="text-[10px] font-medium text-slate-500 w-12 shrink-0 text-right group-hover:text-slate-700 transition-colors">
          {row.label}
        </span>
        <div className="flex-1 flex h-5 rounded-md overflow-hidden gap-px">
          {row.segments.map((seg, i) => (
            <div
              key={i}
              style={{ width: `${seg.pct}%`, backgroundColor: seg.color, minWidth: seg.pct > 0.5 ? 2 : 0 }}
              className="relative flex items-center overflow-hidden"
            >
              {seg.pct >= 8 && (
                <span className="text-[10px] text-white font-medium px-1 truncate leading-none select-none">
                  {seg.pct.toFixed(0)}%
                </span>
              )}
            </div>
          ))}
        </div>
        <span className="text-[10px] tabular-nums text-slate-400 w-16 text-right shrink-0">
          {fmtKRW(row.total)}
        </span>
        <svg
          className={`w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-all shrink-0 ${isExpanded ? '' : '-rotate-90'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isExpanded && <DetailPanel row={row} />}
    </div>
  )
}

export default function AllocationCharts({ allPositions, positions, sectorColors = {} }: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const { palette } = useTheme()
  const PALETTE = [
    palette.colors[0], palette.colors[1], palette.colors[2], palette.colors[3],
    palette.colors[0] + 'CC', palette.colors[1] + 'CC', palette.colors[2] + 'CC', palette.colors[3] + 'CC',
    palette.colors[0] + '99', palette.colors[1] + '99', palette.colors[2] + '99', palette.colors[3] + '99',
  ]

  const hasPrices = allPositions.some(p => p.market_value > 0)
  const vk: 'market_value' | 'total_invested' = hasPrices ? 'market_value' : 'total_invested'

  const allTotal = allPositions.reduce((s, p) => s + p[vk], 0)
  const filteredTotal = positions.reduce((s, p) => s + p[vk], 0)

  // 계좌 행: allPositions 기준, 선택된 계좌 컬러 / 나머지 회색
  const selectedAccountNames = new Set(positions.map(p => p.account.name))
  const allByAccount = groupBy(allPositions, p => p.account.name, vk)
  const accountColorMap: Record<string, string> = {}
  let colorIdx = 0
  for (const d of allByAccount) {
    accountColorMap[d.name] = selectedAccountNames.has(d.name)
      ? PALETTE[colorIdx++ % PALETTE.length]
      : GREY
  }
  const accountSegments = toSegments(allByAccount, allTotal, name => accountColorMap[name])

  const bySector = groupBy(positions, p => p.security.sector ?? '기타', vk).slice(0, 12)
  const byCountry = groupBy(positions, p => p.security.country ?? '기타', vk).slice(0, 10)
  const byAssetClass = groupBy(positions, p => p.security.asset_class ?? '기타', vk).slice(0, 8)
  const byStyle = groupBy(positions, p => p.security.etf_style ?? '미분류', vk).slice(0, 12)

  const sectorSegments = toSegments(bySector, filteredTotal,
    (name, i) => sectorColors[name] ?? PALETTE[i % PALETTE.length])
  const countrySegments = toSegments(byCountry, filteredTotal,
    (_, i) => PALETTE[i % PALETTE.length])
  const assetClassSegments = toSegments(byAssetClass, filteredTotal,
    (_, i) => PALETTE[i % PALETTE.length])
  const styleSegments = toSegments(byStyle, filteredTotal,
    (_, i) => PALETTE[i % PALETTE.length])

  const rows: DimRow[] = [
    { label: '계좌별', segments: accountSegments, total: allTotal },
    { label: '자산군별', segments: assetClassSegments, total: filteredTotal },
    { label: '스타일별', segments: styleSegments, total: filteredTotal },
    { label: '국가별', segments: countrySegments, total: filteredTotal },
    { label: '섹터별', segments: sectorSegments, total: filteredTotal },
  ]

  function toggle(label: string) {
    setExpandedRow(prev => prev === label ? null : label)
  }

  const isFiltered = allTotal > 0 && Math.abs(filteredTotal - allTotal) > 1
  const selectedPct = allTotal > 0 ? filteredTotal / allTotal * 100 : 100

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">자산 구성</h3>
        <div className="flex items-center gap-2">
          {isFiltered && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 tabular-nums font-medium">
              {selectedPct.toFixed(1)}%
            </span>
          )}
          <span className="text-xs tabular-nums text-slate-700 font-semibold">{fmtKRW(filteredTotal)}</span>
          {isFiltered && (
            <span className="text-[10px] tabular-nums text-slate-300">/ {fmtKRW(allTotal)}</span>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {rows.map(row => (
          <StackBar
            key={row.label}
            row={row}
            isExpanded={expandedRow === row.label}
            onToggle={() => toggle(row.label)}
          />
        ))}
      </div>
    </div>
  )
}
