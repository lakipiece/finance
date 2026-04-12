'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { PortfolioPosition } from '@/lib/portfolio/types'

const DONUT_COLORS = ['#6B8CAE', '#6DAE8C', '#C4A96D', '#C47D7D', '#8B7BC8', '#5BB5B5', '#E8A87C', '#82C0CC', '#94a3b8']
const GREY = '#e2e8f0'

interface Props {
  allPositions: PortfolioPosition[]
  positions: PortfolioPosition[]
  sectorColors?: Record<string, string>
}

function groupBy(
  arr: PortfolioPosition[],
  key: (item: PortfolioPosition) => string,
  valueKey: 'market_value' | 'total_invested'
): { name: string; value: number }[] {
  const map: Record<string, number> = {}
  for (const item of arr) {
    const k = key(item)
    map[k] = (map[k] ?? 0) + item[valueKey]
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
}

function fmtKRW(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(2)}억원`
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만원`
  return `${v.toLocaleString()}원`
}

function fmtKRWShort(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만`
  return v.toLocaleString()
}

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const total = d.payload?.total ?? 0
  const pct = total > 0 ? (d.value / total * 100).toFixed(1) : '0.0'
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-500 mb-0.5">{d.name}</p>
      <p className="font-semibold text-slate-800">{fmtKRW(d.value)}</p>
      <p className="text-slate-400">{pct}%</p>
    </div>
  )
}

// 계좌 비중 카드 — 전체 대비 선택 비중
function AccountWeightCard({
  allPositions,
  filteredPositions,
}: {
  allPositions: PortfolioPosition[]
  filteredPositions: PortfolioPosition[]
}) {
  const hasPrices = allPositions.some(p => p.market_value > 0)
  const vk: 'market_value' | 'total_invested' = hasPrices ? 'market_value' : 'total_invested'

  const allTotal = allPositions.reduce((s, p) => s + p[vk], 0)
  const filteredTotal = filteredPositions.reduce((s, p) => s + p[vk], 0)
  const restTotal = allTotal - filteredTotal
  const selectedPct = allTotal > 0 ? filteredTotal / allTotal * 100 : 100
  const isFiltered = restTotal > 1

  const selectedByAccount = groupBy(filteredPositions, p => p.account.name, vk)

  const chartData = [
    ...selectedByAccount.map((d, i) => ({
      ...d,
      total: allTotal,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    })),
    ...(restTotal > 1
      ? [{ name: '나머지', value: Math.round(restTotal), total: allTotal, color: GREY }]
      : []),
  ]

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-600">계좌 비중 (전체 대비)</h3>
        <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtKRW(filteredTotal)}</span>
      </div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={1}
              startAngle={90}
              endAngle={-270}
            >
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-xl font-bold text-slate-800 tabular-nums">{selectedPct.toFixed(1)}%</p>
            <p className="text-[10px] text-slate-400">{isFiltered ? '선택됨' : '전체'}</p>
          </div>
        </div>
      </div>
      <div className="mt-2 space-y-1">
        {selectedByAccount.map((d, i) => {
          const pct = allTotal > 0 ? d.value / allTotal * 100 : 0
          return (
            <div key={d.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="text-[10px] text-slate-600 flex-1 truncate">{d.name}</span>
              <span className="text-[10px] text-slate-400 tabular-nums">{pct.toFixed(1)}%</span>
              <span className="text-[10px] text-slate-600 tabular-nums w-14 text-right">{fmtKRWShort(d.value)}</span>
            </div>
          )
        })}
        {restTotal > 1 && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: GREY }} />
            <span className="text-[10px] text-slate-400 flex-1">나머지</span>
            <span className="text-[10px] text-slate-300 tabular-nums">{(restTotal / allTotal * 100).toFixed(1)}%</span>
            <span className="text-[10px] text-slate-400 tabular-nums w-14 text-right">{fmtKRWShort(restTotal)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// 일반 도넛 카드 (커스텀 컬러 지원)
function DonutCard({
  title,
  data,
  colorMap = {},
}: {
  title: string
  data: { name: string; value: number }[]
  colorMap?: Record<string, string>
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const dataWithTotal = data.map(d => ({ ...d, total }))

  function getColor(name: string, i: number) {
    return colorMap[name] ?? DONUT_COLORS[i % DONUT_COLORS.length]
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-600">{title}</h3>
        <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtKRW(total)}</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={dataWithTotal}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {dataWithTotal.map((d, i) => (
              <Cell key={i} fill={getColor(d.name, i)} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-1">
        {data.map((d, i) => {
          const pct = total > 0 ? d.value / total * 100 : 0
          if (pct < 0.5) return null
          return (
            <div key={d.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getColor(d.name, i) }} />
              <span className="text-[10px] text-slate-600 flex-1 truncate">{d.name}</span>
              <span className="text-[10px] text-slate-400 tabular-nums">{pct.toFixed(1)}%</span>
              <span className="text-[10px] text-slate-600 tabular-nums w-14 text-right">{fmtKRWShort(d.value)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AllocationCharts({ allPositions, positions, sectorColors = {} }: Props) {
  const hasPrices = positions.some(p => p.market_value > 0)
  const vk: 'market_value' | 'total_invested' = hasPrices ? 'market_value' : 'total_invested'

  const bySector = groupBy(positions, p => p.security.sector ?? '기타', vk).slice(0, 20)
  const byCountry = groupBy(positions, p => p.security.country ?? '기타', vk).slice(0, 10)
  const byAssetClass = groupBy(positions, p => p.security.asset_class ?? '기타', vk).slice(0, 8)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <AccountWeightCard allPositions={allPositions} filteredPositions={positions} />
      <DonutCard title="섹터별 비중" data={bySector} colorMap={sectorColors} />
      <DonutCard title="국가별 비중" data={byCountry} />
      <DonutCard title="자산군별 비중" data={byAssetClass} />
    </div>
  )
}
