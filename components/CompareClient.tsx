'use client'

import { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData } from '@/lib/types'
import type { YearSummary } from '@/lib/fetchYears'
import { useTheme } from '@/lib/ThemeContext'
import { useFilter } from '@/lib/FilterContext'
import { INCOME_CATEGORIES, INCOME_COLORS } from '@/lib/utils'

const CompareCharts = dynamic(() => import('./CompareCharts'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-slate-100 rounded-xl h-64" />,
})

interface IncomeSummary {
  year: number
  total: number
  categoryTotals: { 급여: number; 기타: number }
  monthlyList: Array<{ month: string; total: number; 급여: number; 기타: number }>
}

interface Props {
  availableYears: YearSummary[]
}

const ALL_EXPENSE_CATEGORIES = ['고정비', '대출상환', '변동비', '여행공연비'] as const
type ExpenseCategory = typeof ALL_EXPENSE_CATEGORIES[number]

export default function CompareClient({ availableYears }: Props) {
  const { palette } = useTheme()
  const { excludeLoan } = useFilter()
  const expenseCategories = useMemo(() =>
    excludeLoan ? ALL_EXPENSE_CATEGORIES.filter(c => c !== '대출상환') : [...ALL_EXPENSE_CATEGORIES],
    [excludeLoan]
  )
  const defaultYear = availableYears[0]?.year
  const [selectedYears, setSelectedYears] = useState<number[]>(defaultYear ? [defaultYear] : [])
  const [yearData, setYearData] = useState<Record<number, DashboardData>>({})
  const [incomeYearData, setIncomeYearData] = useState<Record<number, IncomeSummary>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null)
  const [cumulative, setCumulative] = useState(false)

  async function fetchYear(year: number) {
    if (yearData[year]) return
    setLoading(prev => ({ ...prev, [year]: true }))
    const [expRes, incRes] = await Promise.all([
      fetch(`/api/year-data?year=${year}`),
      fetch(`/api/incomes/summary?year=${year}`),
    ])
    if (expRes.ok) {
      const data = await expRes.json()
      setYearData(prev => ({ ...prev, [year]: data }))
    }
    if (incRes.ok) {
      const data = await incRes.json()
      setIncomeYearData(prev => ({ ...prev, [year]: data }))
    }
    setLoading(prev => ({ ...prev, [year]: false }))
  }

  useEffect(() => {
    if (defaultYear) fetchYear(defaultYear)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleYear(year: number) {
    setSelectedYears(prev => {
      if (prev.includes(year)) return prev.filter(y => y !== year)
      fetchYear(year)
      return [...prev, year]
    })
  }

  const colorMap = Object.fromEntries(
    availableYears.map((y, i) => [y.year, palette.colors[i % palette.colors.length]])
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

  const isIncomeCategory = (cat: string | null) => cat !== null && (INCOME_CATEGORIES as readonly string[]).includes(cat)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>연도 비교</h1>
          <p className="text-xs text-slate-400 mt-0.5">연도별 수입·지출 패턴 비교 분석</p>
        </div>
      </div>

      {/* Year selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-4 sm:gap-6 flex-wrap">
        <span className="hidden sm:inline text-xs font-semibold text-slate-600">연도 선택</span>
        <div className="flex gap-2 flex-wrap">
          {availableYears.map((y) => {
            const isSelected = selectedYears.includes(y.year)
            const color = colorMap[y.year]
            const isLoading = loading[y.year]
            return (
              <button key={y.year} onClick={() => toggleYear(y.year)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${isSelected ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                style={isSelected ? { background: color } : {}}>
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: isSelected ? 'rgba(255,255,255,0.6)' : color }} />
                {y.year}
                {isLoading && <span className="opacity-70">...</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Category filter */}
      {selectedYears.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-600">카테고리</span>
            <button onClick={() => setCumulative(prev => !prev)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${cumulative ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {cumulative ? '누적 보기' : '월별 보기'}
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap items-center">
            <button
              onClick={() => { setSelectedCategory(null); setSelectedDetail(null) }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${selectedCategory === null ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              전체 지출
            </button>
            {expenseCategories.map(cat => (
              <button key={cat}
                onClick={() => { setSelectedCategory(prev => prev === cat ? null : cat); setSelectedDetail(null) }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${selectedCategory === cat ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {cat}
              </button>
            ))}
            <span className="text-slate-200 mx-0.5">|</span>
            {/* 수입 카테고리 */}
            {INCOME_CATEGORIES.map(cat => (
              <button key={cat}
                onClick={() => { setSelectedCategory(prev => prev === cat ? null : cat); setSelectedDetail(null) }}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                style={selectedCategory === cat
                  ? { backgroundColor: INCOME_COLORS[cat], color: '#fff' }
                  : { backgroundColor: `${INCOME_COLORS[cat]}22`, color: INCOME_COLORS[cat], border: `1px solid ${INCOME_COLORS[cat]}44` }
                }>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedYears.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
          <p className="text-slate-400 text-sm">위에서 비교할 연도를 선택하세요</p>
        </div>
      ) : (
        <CompareCharts
          selectedYears={selectedYears}
          yearData={yearData}
          incomeYearData={incomeYearData}
          colorMap={colorMap}
          loading={loading}
          selectedCategory={selectedCategory}
          selectedDetail={selectedDetail}
          onDetailSelect={setSelectedDetail}
          cumulative={cumulative}
          isIncomeCategory={isIncomeCategory(selectedCategory)}
        />
      )}
    </div>
  )
}
