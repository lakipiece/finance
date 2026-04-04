'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { MonthlyData, ExpenseItem } from '@/lib/types'
import { formatWonFull, CAT_BADGE, CATEGORIES } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'
import { useFilter } from '@/lib/FilterContext'

interface Props {
  monthData: MonthlyData
  expenses: ExpenseItem[]
  allExpenses: ExpenseItem[]
  monthlyList: MonthlyData[]
  onClose: (() => void) | null
}

const PAGE_SIZES = [20, 50, 100] as const

export default function DrilldownPanel({ monthData, expenses, allExpenses, monthlyList, onClose }: Props) {
  const { catColors } = useTheme()
  const { excludeLoan } = useFilter()

  // Filter out 대출상환 if excluded
  const baseExpenses = useMemo(() =>
    excludeLoan ? expenses.filter(e => e.category !== '대출상환') : expenses,
    [expenses, excludeLoan]
  )
  const baseMonthData = useMemo((): MonthlyData =>
    excludeLoan ? { ...monthData, 대출상환: 0, total: monthData.total - monthData.대출상환 } : monthData,
    [monthData, excludeLoan]
  )
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [detailSearch, setDetailSearch] = useState('')
  const [selectedTrendDetail, setSelectedTrendDetail] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)

  const filteredExpenses = (() => {
    let result = selectedCat ? baseExpenses.filter(e => e.category === selectedCat) : baseExpenses
    if (selectedTrendDetail) result = result.filter(e => e.detail === selectedTrendDetail)
    return result
  })()

  // Group by detail for selected category
  const detailSummary = selectedCat
    ? Object.entries(
        filteredExpenses.reduce<Record<string, number>>((acc, e) => {
          const key = e.detail || '기타'
          acc[key] = (acc[key] ?? 0) + e.amount
          return acc
        }, {})
      )
        .sort((a, b) => b[1] - a[1])
        .filter(([detail]) =>
          detailSearch === '' || detail.toLowerCase().includes(detailSearch.toLowerCase())
        )
    : null

  const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

  const trendData = selectedCat
    ? MONTH_LABELS.map((label, i) => {
        const value = selectedTrendDetail
          ? allExpenses
              .filter(e => e.category === selectedCat && e.detail === selectedTrendDetail && e.month === i + 1)
              .reduce((s, e) => s + e.amount, 0)
          : (monthlyList[i]?.[selectedCat as keyof MonthlyData] as number) ?? 0
        return { month: label, value }
      })
    : null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-violet-100 p-6 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{baseMonthData.month} 상세 내역</h2>
          <p className="text-sm text-slate-400 mt-0.5">총 {formatWonFull(baseMonthData.total)}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Category Summary — clickable drilldown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {CATEGORIES.map((cat) => {
          const amount = baseMonthData[cat as keyof MonthlyData] as number
          if (amount === 0) return null
          const isSelected = selectedCat === cat
          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedCat(prev => prev === cat ? null : cat)
                setDetailSearch('')
                setSelectedTrendDetail(null)
                setPage(1)
              }}
              className="text-left rounded-xl p-3 transition-all"
              style={{
                background: `${catColors[cat]}${isSelected ? '28' : '14'}`,
                outline: isSelected ? `2px solid ${catColors[cat]}` : '2px solid transparent',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: catColors[cat] }} />
                <span className="text-xs font-medium" style={{ color: catColors[cat] }}>{cat}</span>
              </div>
              <p className="text-base font-bold text-slate-800">{formatWonFull(amount)}</p>
            </button>
          )
        })}
      </div>

      {/* Detail summary for selected category */}
      {selectedCat && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2 gap-3">
            <h3 className="text-sm font-semibold text-slate-600 shrink-0">{selectedCat} 항목별 집계</h3>
            {/* Search input */}
            <input
              type="text"
              value={detailSearch}
              onChange={e => setDetailSearch(e.target.value)}
              placeholder="내역 검색..."
              className="flex-1 max-w-48 text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          {/* Monthly trend chart */}
          {selectedCat && trendData && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">
                {selectedTrendDetail ?? selectedCat} 월별 추이
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={trendData} margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value: number) => [formatWonFull(value), '']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {trendData.map((_, i) => (
                      <Cell key={i} fill={catColors[selectedCat] ?? '#6B8CAE'} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Fixed height scroll area */}
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
            {detailSummary && detailSummary.length > 0 ? detailSummary.map(([detail, amount]) => {
              const total = baseMonthData[selectedCat as keyof MonthlyData] as number
              const pct = total > 0 ? Math.round(amount / total * 100) : 0
              const isLong = detail.length > 18
              const isDetailSelected = selectedTrendDetail === detail
              return (
                <div
                  key={detail}
                  className={`flex items-center gap-3 rounded-lg px-1 py-0.5 cursor-pointer transition-colors ${isDetailSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                  onClick={() => { setSelectedTrendDetail(prev => prev === detail ? null : detail); setPage(1) }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span
                        className={`truncate max-w-[160px] ${isDetailSelected ? 'text-slate-800 font-bold' : 'text-slate-600'}`}
                        title={isLong ? detail : undefined}
                      >
                        {detail}
                      </span>
                      <span className="text-slate-400 ml-2 shrink-0">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: catColors[selectedCat!] }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-800 shrink-0 w-28 text-right">
                    {formatWonFull(amount)}
                  </span>
                </div>
              )
            }) : (
              <p className="text-xs text-slate-400 py-2">
                {detailSearch ? '검색 결과가 없습니다.' : '내역이 없습니다.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Expenses Table */}
      {(() => {
        const sorted = [...filteredExpenses].sort((a, b) => b.amount - a.amount)
        const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
        const safePage = Math.min(page, totalPages)
        const slice = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
        return (
          <div>
            <h3 className="text-sm font-semibold text-slate-600 mb-2">
              {selectedTrendDetail ? `${selectedCat} > ${selectedTrendDetail} 내역` : selectedCat ? `${selectedCat} 내역` : '전체 내역'}
              {(selectedCat || selectedTrendDetail) && (
                <button
                  onClick={() => { setSelectedCat(null); setDetailSearch(''); setSelectedTrendDetail(null); setPage(1) }}
                  className="ml-2 text-xs text-slate-400 hover:text-slate-600 font-normal"
                >
                  전체보기
                </button>
              )}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">#</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">날짜</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">분류</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">내역</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">비고</th>
                    <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">결제수단</th>
                    <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((e, i) => (
                    <tr key={`${e.date}-${e.detail}-${e.amount}-${i}`} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                      <td className="py-2 px-3 text-slate-300 text-xs">{(safePage - 1) * pageSize + i + 1}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{e.date}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>
                          {e.category}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {e.detail ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{e.detail}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-xs max-w-[180px]">
                        {e.memo ? (
                          <span className="block truncate" title={e.memo}>{e.memo}</span>
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{e.method || <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800">{formatWonFull(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 flex-wrap gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>총 {sorted.length.toLocaleString()}건</span>
                <span className="text-slate-200">|</span>
                <span>페이지당</span>
                {PAGE_SIZES.map(size => (
                  <button
                    key={size}
                    onClick={() => { setPageSize(size); setPage(1) }}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      pageSize === size
                        ? 'bg-slate-700 text-white font-semibold'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {size}
                  </button>
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
        )
      })()}
    </div>
  )
}
