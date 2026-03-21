'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData } from '@/lib/types'

const CompareCharts = dynamic(() => import('./CompareCharts'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-slate-100 rounded-xl h-64" />,
})

interface YearSummary { year: number; count: number }

const YEAR_COLORS = ['#4E79A7', '#E15759', '#59A14F', '#F28E2B', '#76B7B2']

interface Props {
  availableYears: YearSummary[]
}

export default function CompareClient({ availableYears }: Props) {
  const [selectedYears, setSelectedYears] = useState<number[]>([])
  const [yearData, setYearData] = useState<Record<number, DashboardData>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})

  async function fetchYear(year: number) {
    if (yearData[year]) return
    setLoading(prev => ({ ...prev, [year]: true }))
    const res = await fetch(`/api/year-data?year=${year}`)
    if (res.ok) {
      const data = await res.json()
      setYearData(prev => ({ ...prev, [year]: data }))
    }
    setLoading(prev => ({ ...prev, [year]: false }))
  }

  function toggleYear(year: number) {
    setSelectedYears(prev => {
      if (prev.includes(year)) return prev.filter(y => y !== year)
      fetchYear(year)
      return [...prev, year]
    })
  }

  const colorMap = Object.fromEntries(
    availableYears.map((y, i) => [y.year, YEAR_COLORS[i % YEAR_COLORS.length]])
  )

  if (availableYears.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 inline-block">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">데이터가 없습니다</h2>
          <p className="text-slate-400 text-sm">관리 탭에서 연도별 데이터를 업로드하면 비교할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Year selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-4 flex items-center gap-6 flex-wrap">
        <span className="text-sm font-semibold text-slate-600">연도 선택</span>
        <div className="flex gap-3 flex-wrap">
          {availableYears.map((y) => {
            const isSelected = selectedYears.includes(y.year)
            const color = colorMap[y.year]
            const isLoading = loading[y.year]
            return (
              <button
                key={y.year}
                onClick={() => toggleYear(y.year)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isSelected ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                style={isSelected ? { background: color } : {}}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: isSelected ? 'rgba(255,255,255,0.6)' : color }}
                />
                {y.year}
                {isLoading && <span className="text-xs opacity-70">...</span>}
              </button>
            )
          })}
        </div>
      </div>

      {selectedYears.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
          <p className="text-slate-400 text-sm">위에서 비교할 연도를 선택하세요</p>
        </div>
      ) : (
        <CompareCharts
          selectedYears={selectedYears}
          yearData={yearData}
          colorMap={colorMap}
          loading={loading}
        />
      )}
    </div>
  )
}
