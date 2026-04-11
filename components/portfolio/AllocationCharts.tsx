'use client'

import { useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, YAxis, ResponsiveContainer,
} from 'recharts'
import type { PortfolioPosition } from '@/lib/portfolio/types'

const DONUT_COLORS = ['#6B8CAE', '#6DAE8C', '#C4A96D', '#C47D7D', '#8B7BC8', '#5BB5B5', '#E8A87C', '#82C0CC', '#94a3b8']
const TOP_N = 20

interface Props { positions: PortfolioPosition[] }

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

function topN(data: { name: string; value: number }[], n = TOP_N) {
  if (data.length <= n) return data
  const top = data.slice(0, n)
  const rest = data.slice(n).reduce((s, d) => s + d.value, 0)
  if (rest > 0) top.push({ name: '기타', value: rest })
  return top
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

// 도넛 커스텀 툴팁
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

// 바차트 툴팁
function BarTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-500 mb-0.5">{d.payload.name}</p>
      <p className="font-semibold text-slate-800">{fmtKRW(d.value)}</p>
    </div>
  )
}

// 도넛 차트 카드
function DonutCard({
  title, data,
}: {
  title: string
  data: { name: string; value: number }[]
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  // recharts에 total 주입 (tooltip용)
  const dataWithTotal = data.map(d => ({ ...d, total }))

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-600">{title}</h3>
        <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtKRW(total)}</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={dataWithTotal}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {dataWithTotal.map((_, i) => (
              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      {/* 레전드 */}
      <div className="mt-2 space-y-1">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.value / total * 100) : 0
          if (pct < 0.5) return null
          return (
            <div key={d.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
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

// 섹터/계좌 바차트 카드 (토글)
function BarToggleCard({
  sectorData,
  accountData,
}: {
  sectorData: { name: string; value: number }[]
  accountData: { name: string; value: number }[]
}) {
  const [mode, setMode] = useState<'sector' | 'account'>('sector')
  const data = mode === 'sector' ? sectorData : accountData
  const total = data.reduce((s, d) => s + d.value, 0)
  const height = Math.max(200, data.length * 26 + 20)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-xs font-semibold text-slate-600">
            {mode === 'sector' ? '섹터별' : '계좌별'}
          </h3>
          <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtKRW(total)}</span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setMode('sector')}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              mode === 'sector'
                ? 'bg-slate-600 text-white border-slate-600'
                : 'border-slate-200 text-slate-400 hover:border-slate-400'
            }`}>
            섹터
          </button>
          <button
            onClick={() => setMode('account')}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
              mode === 'account'
                ? 'bg-slate-600 text-white border-slate-600'
                : 'border-slate-200 text-slate-400 hover:border-slate-400'
            }`}>
            계좌
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12, top: 0, bottom: 0 }}>
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: '#64748b' }}
            width={72}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<BarTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar
            dataKey="value"
            fill={mode === 'sector' ? '#6B8CAE' : '#6DAE8C'}
            radius={[0, 3, 3, 0]}
            maxBarSize={14}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function AllocationCharts({ positions }: Props) {
  const hasPrices = positions.some(p => p.market_value > 0)
  const valueKey: 'market_value' | 'total_invested' = hasPrices ? 'market_value' : 'total_invested'

  const byAssetClass = topN(groupBy(positions, p => p.security.asset_class ?? '기타', valueKey), 8)
  const byCountry = topN(groupBy(positions, p => p.security.country ?? '기타', valueKey), 8)
  const bySector = topN(groupBy(positions, p => p.security.sector ?? '기타', valueKey), TOP_N)
  const byAccount = topN(groupBy(positions, p => p.account.name, valueKey), TOP_N)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <DonutCard title="자산군별" data={byAssetClass} />
      <DonutCard title="국가별" data={byCountry} />
      <BarToggleCard sectorData={bySector} accountData={byAccount} />
    </div>
  )
}
