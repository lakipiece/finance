'use client'

import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import type { PortfolioPosition } from '@/lib/portfolio/types'

const COLORS = ['#6B8CAE', '#6DAE8C', '#C4A96D', '#C47D7D', '#8B7BC8', '#5BB5B5']

interface Props { positions: PortfolioPosition[] }

function groupBy(arr: PortfolioPosition[], key: (item: PortfolioPosition) => string, valueKey: 'market_value' | 'total_invested'): Record<string, number> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    acc[k] = (acc[k] ?? 0) + item[valueKey]
    return acc
  }, {} as Record<string, number>)
}

export default function AllocationCharts({ positions }: Props) {
  // 현재가 미조회 시 투자원금 기준으로 fallback
  const hasPrices = positions.some(p => p.market_value > 0)
  const valueKey: 'market_value' | 'total_invested' = hasPrices ? 'market_value' : 'total_invested'
  const valueLabel = hasPrices ? '' : ' (투자원금 기준)'

  const byAssetClass = Object.entries(groupBy(positions, p => p.security.asset_class ?? '기타', valueKey))
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const byCountry = Object.entries(groupBy(positions, p => p.security.country ?? '기타', valueKey))
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter(d => d.value > 0)

  const bySector = Object.entries(groupBy(positions, p => p.security.sector ?? '기타', valueKey))
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  const byAccount = Object.entries(groupBy(positions, p => p.account.name, valueKey))
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter(d => d.value > 0)

  const fmtKRW = (v: number) => `${Math.round(v / 10000).toLocaleString()}만`

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">자산군별<span className="text-xs font-normal text-slate-400 ml-1">{valueLabel}</span></h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={byAssetClass} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(1)}%`}>
              {byAssetClass.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => fmtKRW(v) + '원'} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">국가별</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={byCountry} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(1)}%`}>
              {byCountry.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => fmtKRW(v) + '원'} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">섹터별</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bySector} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" tickFormatter={fmtKRW} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
            <Tooltip formatter={(v: number) => fmtKRW(v) + '원'} />
            <Bar dataKey="value" fill="#6B8CAE" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">계좌별</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byAccount} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" tickFormatter={fmtKRW} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
            <Tooltip formatter={(v: number) => fmtKRW(v) + '원'} />
            <Bar dataKey="value" fill="#6DAE8C" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
