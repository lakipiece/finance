'use client'

import { useState } from 'react'
import type { PortfolioPosition } from '@/lib/portfolio/types'

const PALETTE = ['#6B8CAE', '#6DAE8C', '#C4A96D', '#C47D7D', '#8B7BC8', '#5BB5B5', '#E8A87C', '#82C0CC', '#94a3b8', '#A3C4A8', '#D4A5A5', '#A5B4D4']
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

function StackBar({ row }: { row: DimRow }) {
  const [hovered, setHovered] = useState<Segment | null>(null)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-slate-500 w-12 shrink-0 text-right">{row.label}</span>
        <div className="flex-1 flex h-5 rounded-md overflow-hidden gap-px">
          {row.segments.map((seg, i) => (
            <div
              key={i}
              style={{ width: `${seg.pct}%`, backgroundColor: seg.color, minWidth: seg.pct > 0.5 ? 2 : 0 }}
              className="transition-opacity hover:opacity-75 cursor-default"
              onMouseEnter={() => setHovered(seg)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </div>
        <span className="text-[10px] tabular-nums text-slate-400 w-16 text-right shrink-0">
          {fmtKRW(row.total)}
        </span>
      </div>
      {/* 호버 툴팁 */}
      {hovered && (
        <div className="ml-14 text-[10px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hovered.color }} />
          <span className="font-medium">{hovered.name}</span>
          <span className="text-slate-400 tabular-nums">{hovered.pct.toFixed(1)}%</span>
          <span className="text-slate-500 tabular-nums">{fmtKRW(hovered.value)}</span>
        </div>
      )}
    </div>
  )
}

// 범례 — 여러 행에 걸쳐 표시
function Legend({ rows }: { rows: DimRow[] }) {
  // 각 dimension 별로 구분해서 표시
  return (
    <div className="mt-4 space-y-3">
      {rows.map(row => (
        <div key={row.label}>
          <p className="text-[10px] font-semibold text-slate-400 mb-1">{row.label}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {row.segments.filter(s => s.pct >= 0.5).map((seg, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-[10px] text-slate-600">{seg.name}</span>
                <span className="text-[10px] text-slate-400 tabular-nums">{seg.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AllocationCharts({ allPositions, positions, sectorColors = {} }: Props) {
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

  // 나머지 행: positions 기준
  const bySector = groupBy(positions, p => p.security.sector ?? '기타', vk).slice(0, 12)
  const byCountry = groupBy(positions, p => p.security.country ?? '기타', vk).slice(0, 10)
  const byAssetClass = groupBy(positions, p => p.security.asset_class ?? '기타', vk).slice(0, 8)

  const sectorSegments = toSegments(bySector, filteredTotal,
    (name, i) => sectorColors[name] ?? PALETTE[i % PALETTE.length])
  const countrySegments = toSegments(byCountry, filteredTotal,
    (_, i) => PALETTE[i % PALETTE.length])
  const assetClassSegments = toSegments(byAssetClass, filteredTotal,
    (_, i) => PALETTE[i % PALETTE.length])

  const rows: DimRow[] = [
    { label: '계좌별', segments: accountSegments, total: allTotal },
    { label: '섹터별', segments: sectorSegments, total: filteredTotal },
    { label: '국가별', segments: countrySegments, total: filteredTotal },
    { label: '자산군별', segments: assetClassSegments, total: filteredTotal },
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-xs font-semibold text-slate-600">자산 구성</h3>
        <span className="text-xs text-slate-400 tabular-nums">{fmtKRW(filteredTotal)}</span>
      </div>
      <div className="space-y-3">
        {rows.map(row => <StackBar key={row.label} row={row} />)}
      </div>
      <Legend rows={rows} />
    </div>
  )
}
