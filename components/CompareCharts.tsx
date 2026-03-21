'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import type { DashboardData } from '@/lib/types'
import { formatWonFull } from '@/lib/utils'

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const CATEGORIES = ['고정비', '대출상환', '변동비', '여행공연비'] as const

interface Props {
  selectedYears: number[]
  yearData: Record<number, DashboardData>
  colorMap: Record<number, string>
  loading: Record<number, boolean>
}

export default function CompareCharts({ selectedYears, yearData, colorMap, loading }: Props) {
  const readyYears = selectedYears.filter(y => yearData[y] && !loading[y])

  // Build monthly line chart data: [{month:'1월', 2022:total, 2023:total}, ...]
  const monthlyData = MONTH_LABELS.map((month, i) => {
    const entry: Record<string, any> = { month }
    for (const year of readyYears) {
      const m = yearData[year].monthlyList[i]
      entry[year] = m?.total ?? 0
    }
    return entry
  })

  // Build category grouped bar data: [{category:'고정비', 2022:amt, 2023:amt}, ...]
  const categoryData = CATEGORIES.map((cat) => {
    const entry: Record<string, any> = { category: cat }
    for (const year of readyYears) {
      entry[year] = yearData[year].categoryTotals[cat] ?? 0
    }
    return entry
  })

  if (readyYears.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
        <div className="animate-pulse text-slate-400 text-sm">데이터 로딩 중...</div>
      </div>
    )
  }

  return (
    <>
      {/* Monthly line chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1">월별 지출 비교</h2>
        <p className="text-xs text-slate-400 mb-4">선택한 연도별 월간 지출 합계</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 10000)}만`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatWonFull(value), `${name}년`]}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
            <Legend formatter={(value) => <span style={{ color: '#64748b', fontSize: 12 }}>{value}년</span>} />
            {readyYears.map((year) => (
              <Line
                key={year}
                type="monotone"
                dataKey={year}
                stroke={colorMap[year]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category grouped bar chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1">카테고리별 연도 비교</h2>
        <p className="text-xs text-slate-400 mb-4">카테고리별 연간 지출 합계</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={categoryData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 10000)}만`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatWonFull(value), `${name}년`]}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
            <Legend formatter={(value) => <span style={{ color: '#64748b', fontSize: 12 }}>{value}년</span>} />
            {readyYears.map((year) => (
              <Bar key={year} dataKey={year} fill={colorMap[year]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
