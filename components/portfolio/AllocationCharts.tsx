'use client'

import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import type { PortfolioPosition } from '@/lib/portfolio/types'

const PIE_COLORS = ['#6B8CAE', '#6DAE8C', '#C4A96D', '#C47D7D', '#8B7BC8', '#5BB5B5', '#94a3b8']
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
  return `${Math.round(v / 10000).toLocaleString()}만`
}

function PieLabel({ name, percent }: { name: string; percent: number }) {
  if (percent < 0.05) return null
  return `${name} ${(percent * 100).toFixed(1)}%`
}

export default function AllocationCharts({ positions }: Props) {
  const hasPrices = positions.some(p => p.market_value > 0)
  const valueKey: 'market_value' | 'total_invested' = hasPrices ? 'market_value' : 'total_invested'
  const valueLabel = hasPrices ? '' : ' (투자원금 기준)'

  const byAssetClass = topNWithOther(groupBy(positions, p => p.security.asset_class ?? '기타', valueKey))
  const byCountry = topNWithOther(groupBy(positions, p => p.security.country ?? '기타', valueKey))
  const bySector = topNWithOther(groupBy(positions, p => p.security.sector ?? '기타', valueKey))
  const byAccount = topNWithOther(groupBy(positions, p => p.account.name, valueKey))

  const tooltipFmt = (v: number) => fmtKRW(v) + '원'

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">
          자산군별<span className="text-xs font-normal text-slate-400 ml-1">{valueLabel}</span>
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={byAssetClass} dataKey="value" nameKey="name" cx="50%" cy="50%"
              outerRadius={70} label={(props) => PieLabel(props) as unknown as string}>
              {byAssetClass.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={tooltipFmt} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">국가별</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={byCountry} dataKey="value" nameKey="name" cx="50%" cy="50%"
              outerRadius={70} label={(props) => PieLabel(props) as unknown as string}>
              {byCountry.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={tooltipFmt} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-3">섹터별 <span className="text-xs font-normal text-slate-400">상위 {TOP_N}</span></h3>
        <ResponsiveContainer width="100%" height={Math.max(160, bySector.length * 30)}>
          <BarChart data={bySector} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" tickFormatter={fmtKRW} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} />
            <Tooltip formatter={tooltipFmt} />
            <Bar dataKey="value" fill="#6B8CAE" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-3">계좌별 <span className="text-xs font-normal text-slate-400">상위 {TOP_N}</span></h3>
        <ResponsiveContainer width="100%" height={Math.max(160, byAccount.length * 30)}>
          <BarChart data={byAccount} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" tickFormatter={fmtKRW} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
            <Tooltip formatter={tooltipFmt} />
            <Bar dataKey="value" fill="#6DAE8C" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
