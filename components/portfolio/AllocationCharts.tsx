'use client'

import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar, YAxis,
  ResponsiveContainer,
} from 'recharts'
import type { PortfolioPosition } from '@/lib/portfolio/types'

const PIE_COLORS = ['#6B8CAE', '#6DAE8C', '#C4A96D', '#C47D7D', '#8B7BC8', '#5BB5B5', '#94a3b8']
const BAR_COLORS = { sector: '#6B8CAE', account: '#6DAE8C' }
const TOP_N = 5

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

function topNWithOther(data: { name: string; value: number }[], n = TOP_N) {
  if (data.length <= n) return data
  const top = data.slice(0, n)
  const rest = data.slice(n).reduce((s, d) => s + d.value, 0)
  if (rest > 0) top.push({ name: '기타', value: rest })
  return top
}

function fmtKRW(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (v >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만`
  return v.toLocaleString()
}

function fmtKRWFull(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(2)}억원`
  return `${Math.round(v / 10_000).toLocaleString()}만원`
}

// 파이차트 커스텀 툴팁
function PieCustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-500 mb-0.5">{d.name}</p>
      <p className="font-semibold text-slate-800">{fmtKRWFull(d.value)}</p>
      <p className="text-slate-400">{(d.payload.percent * 100).toFixed(1)}%</p>
    </div>
  )
}

// 바차트 커스텀 툴팁
function BarCustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-500 mb-0.5">{d.payload.name}</p>
      <p className="font-semibold text-slate-800">{fmtKRWFull(d.value)}</p>
    </div>
  )
}

function PieLabel({ name, percent }: { name: string; percent: number }) {
  if (percent < 0.06) return null
  return `${name} ${(percent * 100).toFixed(1)}%`
}

function BarChartCard({
  title, data, total, color,
}: {
  title: string
  data: { name: string; value: number }[]
  total: number
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-600">
          {title} <span className="text-[10px] font-normal text-slate-400">상위 {TOP_N}</span>
        </h3>
        <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtKRWFull(total)}</span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={68} axisLine={false} tickLine={false} />
          <Tooltip content={<BarCustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="value" fill={color} radius={[0, 3, 3, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function AllocationCharts({ positions }: Props) {
  const hasPrices = positions.some(p => p.market_value > 0)
  const valueKey: 'market_value' | 'total_invested' = hasPrices ? 'market_value' : 'total_invested'

  const byAssetClass = topNWithOther(groupBy(positions, p => p.security.asset_class ?? '기타', valueKey))
  const byCountry = topNWithOther(groupBy(positions, p => p.security.country ?? '기타', valueKey))
  const bySector = topNWithOther(groupBy(positions, p => p.security.sector ?? '기타', valueKey))
  const byAccount = topNWithOther(groupBy(positions, p => p.account.name, valueKey))

  const totalValue = positions.reduce((s, p) => s + p[valueKey], 0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 자산군 파이 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-600">자산군별</h3>
          <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtKRWFull(totalValue)}</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={byAssetClass} dataKey="value" nameKey="name" cx="50%" cy="50%"
              outerRadius={65}
              label={(props) => {
                const { name, percent } = props
                if (percent < 0.06) return null
                return `${name} ${(percent * 100).toFixed(1)}%`
              }}
              labelLine={false}>
              {byAssetClass.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<PieCustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 국가별 파이 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-xs font-semibold text-slate-600">국가별</h3>
          <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtKRWFull(totalValue)}</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={byCountry} dataKey="value" nameKey="name" cx="50%" cy="50%"
              outerRadius={65}
              label={(props) => {
                const { name, percent } = props
                if (percent < 0.06) return null
                return `${name} ${(percent * 100).toFixed(1)}%`
              }}
              labelLine={false}>
              {byCountry.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<PieCustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 섹터별 바 */}
      <BarChartCard
        title="섹터별"
        data={bySector}
        total={bySector.reduce((s, d) => s + d.value, 0)}
        color={BAR_COLORS.sector}
      />

      {/* 계좌별 바 */}
      <BarChartCard
        title="계좌별"
        data={byAccount}
        total={byAccount.reduce((s, d) => s + d.value, 0)}
        color={BAR_COLORS.account}
      />
    </div>
  )
}
