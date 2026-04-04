'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData, MonthlyData } from '@/lib/types'
import { useFilter } from '@/lib/FilterContext'
import { formatWonFull, CAT_BADGE } from '@/lib/utils'
import KpiCards from './KpiCards'
import DrilldownSummary from './DrilldownSummary'

const MonthlyChart = dynamic(() => import('./MonthlyChart'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-slate-100 rounded-xl h-[300px]" />,
})

interface Props {
  data: DashboardData
  year: number
}

type SortKey = 'date' | 'category' | 'detail' | 'amount'
type SortDir = 'asc' | 'desc'
const PAGE_SIZES = [20, 50, 100] as const

export default function MonthlyClient({ data, year }: Props) {
  const { excludeLoan } = useFilter()

  // Global filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('amount')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)

  // Apply excludeLoan filter
  const filteredData = useMemo((): DashboardData => {
    if (!excludeLoan) return data
    return {
      ...data,
      allExpenses: data.allExpenses.filter(e => e.category !== '대출상환'),
      total: data.total - data.categoryTotals.대출상환,
      categoryTotals: { ...data.categoryTotals, 대출상환: 0 },
      monthlyAvg: Math.round((data.total - data.categoryTotals.대출상환) / 12),
      monthlyList: data.monthlyList.map(m => ({ ...m, 대출상환: 0, total: m.total - m.대출상환 })),
    }
  }, [data, excludeLoan])

  // Compute display data based on filters
  const displayMonthData = useMemo((): MonthlyData => {
    if (selectedMonth) return filteredData.monthlyList[selectedMonth - 1]
    return {
      month: `${year}년 전체`,
      고정비: filteredData.categoryTotals.고정비,
      대출상환: filteredData.categoryTotals.대출상환,
      변동비: filteredData.categoryTotals.변동비,
      여행공연비: filteredData.categoryTotals.여행공연비,
      total: filteredData.total,
    }
  }, [filteredData, selectedMonth, year])

  const displayExpenses = useMemo(() => {
    let result = filteredData.allExpenses
    if (selectedMonth) result = result.filter(e => e.month === selectedMonth)
    if (selectedCategory) result = result.filter(e => e.category === selectedCategory)
    return result
  }, [filteredData, selectedMonth, selectedCategory])

  // Table: apply detail filter, search, and sort
  const tableExpenses = useMemo(() => {
    let result = [...displayExpenses]
    if (selectedDetail) result = result.filter(e => e.detail === selectedDetail)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(e =>
        e.detail.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        e.memo.toLowerCase().includes(q)
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    result.sort((a, b) => {
      switch (sortKey) {
        case 'date': return dir * a.date.localeCompare(b.date)
        case 'category': return dir * a.category.localeCompare(b.category)
        case 'detail': return dir * a.detail.localeCompare(b.detail)
        case 'amount': return dir * (a.amount - b.amount)
        default: return 0
      }
    })
    return result
  }, [displayExpenses, selectedDetail, searchQuery, sortKey, sortDir])

  function handleCategoryClick(cat: string | null) {
    setSelectedCategory(cat)
    setSelectedDetail(null)
    setPage(1)
  }

  function handleMonthSelect(month: number) {
    setSelectedMonth(prev => prev === month ? null : month)
    setPage(1)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'amount' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const hasActiveFilter = selectedCategory || selectedMonth || selectedDetail
  const filterLabel = [
    selectedMonth ? `${selectedMonth}월` : null,
    selectedCategory,
    selectedDetail,
  ].filter(Boolean).join(' > ')

  const totalPages = Math.max(1, Math.ceil(tableExpenses.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const slice = tableExpenses.slice((safePage - 1) * pageSize, safePage * pageSize)

  const sortIcon = (key: SortKey) => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓'
  const thSortable = 'text-left py-2 px-3 text-xs text-slate-400 font-medium cursor-pointer hover:text-slate-600 select-none'

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Row 1: KPI Cards */}
      <KpiCards
        data={filteredData}
        year={year}
        selectedCategory={selectedCategory}
        selectedMonth={selectedMonth}
        onCategoryClick={handleCategoryClick}
      />

      {/* Row 2: Chart + Drilldown Summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-slate-700">
            {selectedCategory ? `${selectedCategory} 월별 추이` : `${year}년 월별 지출 현황`}
          </h2>
          {hasActiveFilter && (
            <button
              onClick={() => { setSelectedCategory(null); setSelectedMonth(null); setSelectedDetail(null); setPage(1) }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              필터 해제
            </button>
          )}
        </div>
        {hasActiveFilter && (
          <p className="text-xs text-slate-400 mb-2">{filterLabel} 필터 적용 중</p>
        )}
        {!hasActiveFilter && (
          <p className="text-xs text-slate-400 mb-2">막대를 클릭하면 해당 월로 필터링됩니다</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Chart (3/5) */}
          <div className="lg:col-span-3">
            <MonthlyChart
              monthlyList={filteredData.monthlyList}
              selectedMonth={selectedMonth}
              onMonthSelect={handleMonthSelect}
              highlightCategory={selectedCategory}
            />
          </div>
          {/* Right: Drilldown Summary (2/5) */}
          <div className="lg:col-span-2">
            <DrilldownSummary
              monthData={displayMonthData}
              expenses={displayExpenses}
              selectedCategory={selectedCategory}
              selectedDetail={selectedDetail}
              onDetailSelect={(d) => { setSelectedDetail(d); setPage(1) }}
            />
          </div>
        </div>
      </div>

      {/* Row 3: Expense Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-base font-semibold text-slate-700">
            {selectedDetail
              ? `${selectedCategory} > ${selectedDetail} 지출 내역`
              : selectedCategory
              ? `${selectedCategory} 지출 내역`
              : '주요 지출 내역'}
          </h2>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="내역 / 분류 / 결제수단 / 비고 검색..."
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300 w-64"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">#</th>
                <th className={thSortable} onClick={() => handleSort('date')}>날짜{sortIcon('date')}</th>
                <th className={thSortable} onClick={() => handleSort('category')}>분류{sortIcon('category')}</th>
                <th className={thSortable} onClick={() => handleSort('detail')}>내역{sortIcon('detail')}</th>
                <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">비고</th>
                <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">결제수단</th>
                <th className={`${thSortable} text-right`} onClick={() => handleSort('amount')}>금액{sortIcon('amount')}</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((e, i) => (
                <tr
                  key={`${e.date}-${e.detail}-${e.amount}-${i}`}
                  className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}
                >
                  <td className="py-2.5 px-3 text-slate-300 text-xs">{(safePage - 1) * pageSize + i + 1}</td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs whitespace-nowrap">{e.date}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>{e.category}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    {e.detail ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{e.detail}</span>
                    ) : <span className="text-slate-300">&mdash;</span>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs max-w-[200px]">
                    {e.memo ? <span className="block truncate" title={e.memo}>{e.memo}</span> : <span className="text-slate-200">&mdash;</span>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs">{e.method || <span className="text-slate-300">&mdash;</span>}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">{formatWonFull(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>총 {tableExpenses.length.toLocaleString()}건</span>
            <span className="text-slate-200">|</span>
            <span>페이지당</span>
            {PAGE_SIZES.map(size => (
              <button
                key={size}
                onClick={() => { setPageSize(size); setPage(1) }}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  pageSize === size ? 'bg-slate-700 text-white font-semibold' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >{size}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">처음</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">이전</button>
            <span className="px-3 py-1 text-xs text-slate-600 font-medium">{safePage} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">다음</button>
            <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">끝</button>
          </div>
        </div>
      </div>
    </div>
  )
}
