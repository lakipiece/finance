'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import type { DashboardData } from '@/lib/types'
import { formatWonFull } from '@/lib/utils'

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const CATEGORIES = ['고정비', '대출상환', '변동비', '여행공연비'] as const
type Category = typeof CATEGORIES[number]

interface Props {
  selectedYears: number[]
  yearData: Record<number, DashboardData>
  colorMap: Record<number, string>
  loading: Record<number, boolean>
  selectedCategory: Category | null
  cumulative: boolean
}

export default function CompareCharts({ selectedYears, yearData, colorMap, loading, selectedCategory, cumulative }: Props) {
  const [detailSearch, setDetailSearch] = useState('')

  useEffect(() => {
    setDetailSearch('')
  }, [selectedCategory])

  const readyYears = selectedYears.filter(y => yearData[y] && !loading[y])

  // Monthly line chart: total or category-filtered, with optional cumulative running sum
  const monthlyData = MONTH_LABELS.map((month, i) => {
    const entry: Record<string, number | string> = { month }
    for (const year of readyYears) {
      if (cumulative) {
        entry[year] = yearData[year].monthlyList
          .slice(0, i + 1)
          .reduce((s, m) => s + (selectedCategory ? (m?.[selectedCategory] ?? 0) : (m?.total ?? 0)), 0)
      } else {
        const m = yearData[year].monthlyList[i]
        entry[year] = selectedCategory ? (m?.[selectedCategory] ?? 0) : (m?.total ?? 0)
      }
    }
    return entry
  })

  // Category bar chart (when no category selected)
  const categoryData = CATEGORIES.map((cat) => {
    const entry: Record<string, any> = { category: cat }
    for (const year of readyYears) {
      entry[year] = yearData[year].categoryTotals[cat] ?? 0
    }
    return entry
  })

  // Sub-detail bar chart (when category selected)
  const subDetailData = (() => {
    if (!selectedCategory) return null
    const allDetails = new Set<string>()
    for (const year of readyYears) {
      for (const e of yearData[year].allExpenses) {
        if (e.category === selectedCategory && e.detail) allDetails.add(e.detail)
      }
    }
    return Array.from(allDetails).map(detail => {
      const entry: Record<string, any> = { detail }
      for (const year of readyYears) {
        entry[year] = yearData[year].allExpenses
          .filter(e => e.category === selectedCategory && e.detail === detail)
          .reduce((s, e) => s + e.amount, 0)
      }
      return entry
    }).sort((a, b) => {
      const sumA = readyYears.reduce((s, y) => s + (a[y] || 0), 0)
      const sumB = readyYears.reduce((s, y) => s + (b[y] || 0), 0)
      return sumB - sumA
    }).filter(item =>
      detailSearch === '' ||
      item.detail.toLowerCase().includes(detailSearch.toLowerCase())
    ).slice(0, 20) // top 20
  })()

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
        <h2 className="text-base font-semibold text-slate-700 mb-1">
          월별 지출 {cumulative ? '누적' : '비교'}{selectedCategory ? ` — ${selectedCategory}` : ''}
        </h2>
        <p className="text-xs text-slate-400 mb-4">{cumulative ? '연초부터 해당 월까지 누적 지출' : '선택한 연도별 월간 지출 합계'}</p>
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

      {/* Category or sub-detail bar chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {subDetailData ? (
          <>
            <h2 className="text-base font-semibold text-slate-700 mb-1">{selectedCategory} — 항목별 연도 비교</h2>
            <p className="text-xs text-slate-400 mb-4">세부 항목별 연간 지출 합계 (상위 20개)</p>
            <div className="mb-3">
              <input
                type="text"
                value={detailSearch}
                onChange={e => setDetailSearch(e.target.value)}
                placeholder="내역 검색 (예: 스타벅스)..."
                className="w-full max-w-sm text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <ResponsiveContainer width="100%" height={Math.max(300, subDetailData.length * 40)}>
              <BarChart data={subDetailData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${Math.round(v / 10000)}만`}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="detail"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [formatWonFull(value), `${name}년`]}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
                />
                <Legend formatter={(value) => <span style={{ color: '#64748b', fontSize: 12 }}>{value}년</span>} />
                {readyYears.map((year) => (
                  <Bar key={year} dataKey={year} fill={colorMap[year]} radius={[0, 4, 4, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </>
  )
}
