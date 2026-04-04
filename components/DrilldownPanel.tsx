'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend } from 'recharts'
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
  onMonthSelect?: (month: number) => void
  selectedMonth?: number | null
}

const PAGE_SIZES = [20, 50, 100] as const
// Generate shades from a base color — darkest first (highest amount)
function generateShades(hex: string, count: number): string[] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return Array.from({ length: count }, (_, i) => {
    const t = count <= 1 ? 0 : i / (count - 1) // 0 = darkest, 1 = lightest
    const mix = (c: number) => Math.round(c + (255 - c) * t * 0.6)
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`
  })
}

export default function DrilldownPanel({ monthData, expenses, allExpenses, monthlyList, onClose, onMonthSelect, selectedMonth }: Props) {
  const { catColors } = useTheme()
  const { excludeLoan } = useFilter()

  const baseExpenses = useMemo(() =>
    excludeLoan ? expenses.filter(e => e.category !== '대출상환') : expenses,
    [expenses, excludeLoan]
  )
  const baseMonthData = useMemo((): MonthlyData =>
    excludeLoan ? { ...monthData, 대출상환: 0, total: monthData.total - monthData.대출상환 } : monthData,
    [monthData, excludeLoan]
  )
  const activeCategories = CATEGORIES.filter(c => {
    if (excludeLoan && c === '대출상환') return false
    return (baseMonthData[c as keyof MonthlyData] as number) > 0
  })

  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [detailSearch, setDetailSearch] = useState('')
  const [selectedTrendDetail, setSelectedTrendDetail] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)

  const isCategory = selectedCat && selectedCat !== '__all__'

  const filteredExpenses = (() => {
    let result = isCategory ? baseExpenses.filter(e => e.category === selectedCat) : baseExpenses
    if (selectedTrendDetail) result = result.filter(e => e.detail === selectedTrendDetail)
    return result
  })()

  // Group by detail for selected category
  const detailSummary = isCategory
    ? Object.entries(
        (selectedCat ? baseExpenses.filter(e => e.category === selectedCat) : baseExpenses)
          .reduce<Record<string, number>>((acc, e) => {
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

  // Top details for stacked chart when category selected
  const topDetails = useMemo(() => {
    if (!isCategory) return []
    const agg: Record<string, number> = {}
    allExpenses.filter(e => e.category === selectedCat).forEach(e => {
      const key = e.detail || '기타'
      agg[key] = (agg[key] ?? 0) + e.amount
    })
    return Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => name)
  }, [allExpenses, selectedCat, isCategory])

  // Chart data — always computed
  const chartData = useMemo(() => {
    if (isCategory && selectedTrendDetail) {
      // Single detail selected — show only that item
      return MONTH_LABELS.map((label, i) => ({
        month: label,
        [selectedTrendDetail]: allExpenses
          .filter(e => e.category === selectedCat && e.detail === selectedTrendDetail && e.month === i + 1)
          .reduce((s, e) => s + e.amount, 0),
      }))
    }
    if (isCategory) {
      // Stacked by top details
      return MONTH_LABELS.map((label, i) => {
        const monthExpenses = allExpenses.filter(e => e.category === selectedCat && e.month === i + 1)
        const entry: Record<string, any> = { month: label }
        let others = 0
        for (const e of monthExpenses) {
          const key = e.detail || '기타'
          if (topDetails.includes(key)) {
            entry[key] = (entry[key] ?? 0) + e.amount
          } else {
            others += e.amount
          }
        }
        if (others > 0) entry['기타'] = others
        return entry
      })
    }
    // 전체: stacked by category
    return MONTH_LABELS.map((label, i) => ({
      month: label,
      ...Object.fromEntries(activeCategories.map(cat => [cat, (monthlyList[i]?.[cat as keyof MonthlyData] as number) ?? 0])),
    }))
  }, [isCategory, selectedCat, selectedTrendDetail, allExpenses, topDetails, activeCategories, monthlyList])

  const chartKeys = isCategory
    ? (selectedTrendDetail
        ? [selectedTrendDetail]
        : [...topDetails, ...(chartData.some((d: any) => d['기타']) ? ['기타'] : [])])
    : activeCategories

  const chartColors = isCategory
    ? (() => {
        if (selectedTrendDetail) {
          return { [selectedTrendDetail]: catColors[selectedCat!] ?? '#6B8CAE' }
        }
        const baseColor = catColors[selectedCat!] ?? '#6B8CAE'
        const shades = generateShades(baseColor, chartKeys.length)
        return Object.fromEntries(chartKeys.map((k, i) => [k, shades[i]]))
      })()
    : catColors

  function handleChartClick(_: any, index: number) {
    onMonthSelect?.(index + 1)
  }

  return (
  <>
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {/* 전체 카드 */}
        <button
          onClick={() => {
            setSelectedCat(prev => prev === '__all__' || prev === null ? null : '__all__')
            setDetailSearch('')
            setSelectedTrendDetail(null)
            setPage(1)
          }}
          className="text-left rounded-xl p-3 transition-all"
          style={{
            background: (!selectedCat || selectedCat === '__all__') ? 'rgba(100,116,139,0.16)' : 'rgba(100,116,139,0.08)',
            outline: (!selectedCat || selectedCat === '__all__') ? '2px solid #64748b' : '2px solid transparent',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-xs font-medium text-slate-500">전체</span>
          </div>
          <p className="text-base font-bold text-slate-800">{formatWonFull(baseMonthData.total)}</p>
        </button>
        {activeCategories.map((cat) => {
          const amount = baseMonthData[cat as keyof MonthlyData] as number
          const isSelected = selectedCat === cat
          const pct = baseMonthData.total > 0 ? ((amount / baseMonthData.total) * 100).toFixed(1) : '0'
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
              <p className="text-[10px] text-slate-400">{pct}%</p>
            </button>
          )
        })}
      </div>

      {/* Chart — always visible */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500">
            {isCategory ? `${selectedCat} 월별 추이` : '월별 지출 현황'}
          </p>
          {selectedMonth && (
            <button
              onClick={() => onMonthSelect?.(selectedMonth)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              월 필터 해제
            </button>
          )}
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}만`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
            <Tooltip
              formatter={(value: number, name: string) => [formatWonFull(value), name]}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {chartKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="a"
                fill={chartColors[key] ?? '#6B8CAE'}
                radius={idx === chartKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                cursor="pointer"
                onClick={handleChartClick}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} opacity={selectedMonth === null || selectedMonth === undefined || selectedMonth === i + 1 ? 1 : 0.3} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category summary (when no category selected or __all__) */}
      {!isCategory && (
        <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2">
          {activeCategories.map(cat => {
            const amount = baseMonthData[cat as keyof MonthlyData] as number
            const pct = baseMonthData.total > 0 ? Math.round(amount / baseMonthData.total * 100) : 0
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CAT_BADGE[cat] ?? 'bg-slate-100 text-slate-700'}`}>{cat}</span>
                    <span className="text-slate-400 ml-2 shrink-0">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: catColors[cat] }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-800 shrink-0 w-24 text-right">{formatWonFull(amount)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail summary for selected category — 3 columns */}
      {isCategory && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-2">{selectedCat} 항목별 집계</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1.5 md:[grid-auto-flow:column]"
            style={{
              gridTemplateRows: detailSummary && detailSummary.length > 3
                ? `repeat(${Math.ceil(detailSummary.length / 3)}, auto)` : undefined,
            }}
          >
            {detailSummary && detailSummary.length > 0 ? detailSummary.map(([detail, amount], rank) => {
              const total = baseMonthData[selectedCat as keyof MonthlyData] as number
              const pct = total > 0 ? Math.round(amount / total * 100) : 0
              const isDetailSelected = selectedTrendDetail === detail
              return (
                <div
                  key={detail}
                  className={`flex items-center gap-2 rounded-lg px-1 py-0.5 cursor-pointer transition-colors ${isDetailSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                  onClick={() => { setSelectedTrendDetail(prev => prev === detail ? null : detail); setPage(1) }}
                >
                  <span className="text-[10px] text-slate-300 w-4 shrink-0 text-right">{rank + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span
                        className={`truncate max-w-[100px] ${isDetailSelected ? 'text-slate-800 font-bold' : 'text-slate-600'}`}
                        title={detail}
                      >
                        {detail}
                      </span>
                      <span className="text-slate-400 ml-1 shrink-0">{pct}%</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: catColors[selectedCat!] }} />
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-800 shrink-0 w-16 text-right">{formatWonFull(amount)}</span>
                </div>
              )
            }) : (
              <p className="text-xs text-slate-400 py-2">{detailSearch ? '검색 결과가 없습니다.' : '내역이 없습니다.'}</p>
            )}
          </div>
        </div>
      )}

    </div>

    {/* Expense Table — separate card */}
    <ExpenseTableCard
      expenses={filteredExpenses}
      selectedCat={selectedCat}
      selectedTrendDetail={selectedTrendDetail}
      isCategory={!!isCategory}
      onReset={() => { setSelectedCat(null); setDetailSearch(''); setSelectedTrendDetail(null); setPage(1) }}
    />
  </>
  )
}

/* ── Expense Table (separate card) ── */
function ExpenseTableCard({
  expenses, selectedCat, selectedTrendDetail, isCategory,
  onReset,
}: {
  expenses: ExpenseItem[]
  selectedCat: string | null
  selectedTrendDetail: string | null
  isCategory: boolean
  onReset: () => void
}) {
  const [sortKey, setSortKey] = useState<'date' | 'category' | 'detail' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)

  function handleSort(key: 'date' | 'category' | 'detail' | 'amount') {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'amount' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const sortIcon = (key: string) => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓'
  const thSort = 'text-left py-2 px-3 text-xs text-slate-400 font-medium cursor-pointer hover:text-slate-600 select-none'

  const tableData = useMemo(() => {
    let result = [...expenses]
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
      let cmp = 0
      switch (sortKey) {
        case 'date': cmp = a.date.localeCompare(b.date); break
        case 'category': cmp = a.category.localeCompare(b.category); break
        case 'detail': cmp = a.detail.localeCompare(b.detail); break
        case 'amount': cmp = a.amount - b.amount; break
      }
      if (cmp !== 0) return dir * cmp
      // Secondary: date desc then amount desc
      const dateCmp = b.date.localeCompare(a.date)
      return dateCmp !== 0 ? dateCmp : b.amount - a.amount
    })
    return result
  }, [expenses, searchQuery, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(tableData.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const slice = tableData.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-base font-semibold text-slate-700">
          {selectedTrendDetail ? `${selectedCat} > ${selectedTrendDetail} 내역` : isCategory ? `${selectedCat} 내역` : '지출 내역'}
          {(selectedCat || selectedTrendDetail) && (
            <button onClick={onReset} className="ml-2 text-xs text-slate-400 hover:text-slate-600 font-normal">전체보기</button>
          )}
        </h3>
        <input
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
          placeholder="내역 / 분류 / 결제수단 / 비고 검색..."
          className="border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300 w-52"
        />
      </div>
      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        <div className="flex gap-2 mb-3 flex-wrap">
          {(['date', 'category', 'detail', 'amount'] as const).map(key => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className={`px-2 py-1 rounded-lg text-xs transition-colors ${sortKey === key ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'}`}
            >
              {{ date: '날짜', category: '분류', detail: '내역', amount: '금액' }[key]}{sortIcon(key)}
            </button>
          ))}
        </div>
        {slice.map((e, i) => (
          <div key={`${e.date}-${e.detail}-${e.amount}-${i}`} className="border border-slate-100 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>{e.category}</span>
                {e.detail && <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{e.detail}</span>}
              </div>
              <span className="font-semibold text-slate-800 text-sm">{formatWonFull(e.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{e.date}</span>
              <span>{e.method}</span>
            </div>
            {e.memo && <p className="text-xs text-slate-400 mt-1 truncate">{e.memo}</p>}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">#</th>
              <th className={thSort} onClick={() => handleSort('date')}>날짜{sortIcon('date')}</th>
              <th className={thSort} onClick={() => handleSort('category')}>분류{sortIcon('category')}</th>
              <th className={thSort} onClick={() => handleSort('detail')}>내역{sortIcon('detail')}</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">비고</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">결제수단</th>
              <th className={`${thSort} text-right`} onClick={() => handleSort('amount')}>금액{sortIcon('amount')}</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((e, i) => (
              <tr key={`${e.date}-${e.detail}-${e.amount}-${i}`} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                <td className="py-2 px-3 text-slate-300 text-xs">{(safePage - 1) * pageSize + i + 1}</td>
                <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap">{e.date}</td>
                <td className="py-2 px-3">
                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>{e.category}</span>
                </td>
                <td className="py-2 px-3">
                  {e.detail ? <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">{e.detail}</span> : <span className="text-slate-300">—</span>}
                </td>
                <td className="py-2 px-3 text-slate-400 text-xs max-w-[180px]">
                  {e.memo ? <span className="block truncate" title={e.memo}>{e.memo}</span> : <span className="text-slate-200">—</span>}
                </td>
                <td className="py-2 px-3 text-slate-400 text-xs">{e.method || <span className="text-slate-300">—</span>}</td>
                <td className="py-2 px-3 text-right font-semibold text-slate-800 text-xs whitespace-nowrap">{formatWonFull(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>총 {tableData.length.toLocaleString()}건</span>
          <span className="text-slate-200">|</span>
          <span>페이지당</span>
          {PAGE_SIZES.map(size => (
            <button
              key={size}
              onClick={() => { setPageSize(size); setPage(1) }}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${pageSize === size ? 'bg-slate-700 text-white font-semibold' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
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
  )
}
