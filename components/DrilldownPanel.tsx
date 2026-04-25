'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend } from 'recharts'
import type { MonthlyData, ExpenseItem } from '@/lib/types'
import type { CategoryDetailsData } from './DashboardClient'
import { formatWonFull, catBadgeStyle, CATEGORIES } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'
import { useFilter } from '@/lib/FilterContext'
import YearPicker from './YearPicker'
import { tbl, field } from '@/lib/styles'
import IncomeTableCard from './IncomeTableCard'
import type { IncomeRow } from './IncomeTableCard'

const INCOME_CHART_COLORS: Record<string, string> = {
  '급여':    '#4527A0',
  '급여 외': '#5A6476',
}

interface IncomeMonthData {
  total: number
  급여: number
  '급여 외': number
}

interface Props {
  monthData: MonthlyData
  monthlyList: MonthlyData[]
  selectedMonth: number | null
  onClose: (() => void) | null
  onMonthSelect?: (month: number) => void

  // Lifted state
  selectedCat: string | null
  setSelectedCat: (cat: string | null) => void
  selectedTrendDetail: string | null
  setSelectedTrendDetail: (detail: string | null) => void

  // Drilldown type (lifted state)
  drilldownType: 'income' | 'expense'
  setDrilldownType: (t: 'income' | 'expense') => void

  // API data (expense)
  catDetails: CategoryDetailsData | null
  catDetailsLoading: boolean
  expenses: ExpenseItem[] | null
  expensesLoading: boolean

  // API data (income)
  incomeMonthData: IncomeMonthData
  incomeMonthlyList: Array<{ month: string; total: number; 급여: number; '급여 외': number }>
  incomes: IncomeRow[] | null
  incomesLoading: boolean
}

const PAGE_SIZES = [20, 50, 100] as const

function generateShades(hex: string, count: number): string[] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return Array.from({ length: count }, (_, i) => {
    const t = count <= 1 ? 0 : i / (count - 1)
    const mix = (c: number) => Math.round(c + (255 - c) * t * 0.6)
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`
  })
}

export default function DrilldownPanel({
  monthData, monthlyList, selectedMonth,
  onClose, onMonthSelect,
  selectedCat, setSelectedCat, selectedTrendDetail, setSelectedTrendDetail,
  drilldownType, setDrilldownType,
  catDetails, catDetailsLoading, expenses, expensesLoading,
  incomeMonthData, incomeMonthlyList, incomes, incomesLoading,
}: Props) {
  const { catColors } = useTheme()
  const { excludeLoan } = useFilter()
  const [detailSearch, setDetailSearch] = useState('')
  const [selectedIncomeCard, setSelectedIncomeCard] = useState<string | null>(null)

  const isCategory = selectedCat && selectedCat !== '__all__'

  const activeCategories = CATEGORIES.filter(c => {
    if (excludeLoan && c === '대출상환') return false
    return (monthData[c as keyof MonthlyData] as number) > 0
  })

  const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

  // Top details from API response
  const topDetails = useMemo(() => {
    if (!isCategory || !catDetails) return []
    return catDetails.details.slice(0, 6).map(d => d.name)
  }, [isCategory, catDetails])

  // Chart data
  const chartData = useMemo(() => {
    if (isCategory && catDetails) {
      if (selectedTrendDetail) {
        return MONTH_LABELS.map((label, i) => ({
          month: label,
          [selectedTrendDetail]: catDetails.detailMonthly[selectedTrendDetail]?.[i] ?? 0,
        }))
      }
      // Stacked by top details
      return MONTH_LABELS.map((label, i) => {
        const entry: Record<string, number | string> = { month: label }
        let others = 0
        for (const [detail, months] of Object.entries(catDetails.detailMonthly)) {
          const amount = months[i] ?? 0
          if (amount === 0) continue
          if (topDetails.includes(detail)) {
            entry[detail] = ((entry[detail] as number) ?? 0) + amount
          } else {
            others += amount
          }
        }
        if (others > 0) entry['기타'] = others
        return entry
      })
    }
    // Income category selected → single category monthly trend
    if (selectedIncomeCard) {
      return MONTH_LABELS.map((label, i) => ({
        month: label,
        [selectedIncomeCard]: incomeMonthlyList[i]?.[selectedIncomeCard as '급여'|'급여 외'] ?? 0,
      }))
    }
    // Overall: stacked income + expense
    return MONTH_LABELS.map((label, i) => ({
      month: label,
      수입_급여:    incomeMonthlyList[i]?.급여 ?? 0,
      '수입_급여 외': incomeMonthlyList[i]?.['급여 외'] ?? 0,
      ...Object.fromEntries(activeCategories.map(cat => [`지출_${cat}`, (monthlyList[i]?.[cat as keyof MonthlyData] as number) ?? 0])),
    }))
  }, [isCategory, catDetails, selectedTrendDetail, topDetails, activeCategories, monthlyList, incomeMonthlyList, selectedIncomeCard])

  const chartKeys = isCategory
    ? (selectedTrendDetail
        ? [selectedTrendDetail]
        : [...topDetails, ...(chartData.some((d) => d['기타']) ? ['기타'] : [])])
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

  // Detail summary for currently selected view
  const detailSummary = useMemo(() => {
    if (!isCategory || !catDetails) return null
    const items = selectedMonth
      ? Object.entries(catDetails.detailMonthly)
          .map(([name, months]) => ({ name, amount: months[selectedMonth - 1] ?? 0 }))
          .filter(d => d.amount > 0)
          .sort((a, b) => b.amount - a.amount)
      : catDetails.details
    if (!detailSearch) return items
    return items.filter(d => d.name.toLowerCase().includes(detailSearch.toLowerCase()))
  }, [isCategory, catDetails, selectedMonth, detailSearch])

  // Category total for detail % calculation
  const catTotal = isCategory ? (monthData[selectedCat as keyof MonthlyData] as number) : 0

  // Display data for horizontal category bars
  const allIncomeCategories = (['급여', '급여 외'] as const).filter(c => incomeMonthData[c] > 0)
  const incomeCategories = selectedIncomeCard
    ? allIncomeCategories.filter(c => c === selectedIncomeCard)
    : allIncomeCategories

  const displayCategories = !isCategory
    ? (drilldownType === 'income' ? incomeCategories : activeCategories)
    : []
  const displayTotal = !isCategory
    ? (drilldownType === 'income'
        ? (selectedIncomeCard ? (incomeMonthData[selectedIncomeCard as '급여'|'급여 외'] ?? 0) : incomeMonthData.total)
        : monthData.total)
    : 0
  const getAmount = (cat: string) =>
    drilldownType === 'income'
      ? (incomeMonthData[cat as '급여' | '급여 외'] ?? 0)
      : (monthData[cat as keyof MonthlyData] as number)
  const getCatColor = (cat: string) =>
    drilldownType === 'income' ? (INCOME_CHART_COLORS[cat] ?? '#64748b') : catColors[cat]

  return (
  <>
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 mb-4 sm:mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold" style={{ color: '#1A237E' }}>{monthData.month} 상세 내역</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            수입 {formatWonFull(incomeMonthData.total)} / 지출 {formatWonFull(monthData.total)}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <YearPicker variant="light" />
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
      </div>

      {/* KPI Cards — 수입 row (grid-cols-5에서 4개만 채움 → 지출과 동일 너비) */}
      <p className="text-[10px] text-slate-400 font-medium mb-1.5 mt-3">수입</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-2">
        {/* 전체 수입 */}
        {(() => {
          const isActive = drilldownType === 'income' && selectedIncomeCard === null
          return (
            <button
              onClick={() => {
                setSelectedIncomeCard(null)
                setDrilldownType('income')
                setSelectedCat(null)
                setSelectedTrendDetail(null)
              }}
              className="text-left rounded-xl p-3 transition-all"
              style={{
                background: isActive ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.05)',
                outline: isActive ? '2px solid #3b82f6' : '2px solid transparent',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: isActive ? '#3b82f6' : '#94a3b8' }} />
                <span className="text-xs font-medium" style={{ color: isActive ? '#3b82f6' : '#64748b' }}>전체 수입</span>
              </div>
              <p className="text-base font-bold text-slate-800">{formatWonFull(incomeMonthData.total)}</p>
            </button>
          )
        })()}
        {/* 수입 카테고리 카드 2개 */}
        {(['급여', '급여 외'] as const).map(cat => {
          const amount = incomeMonthData[cat]
          const color = INCOME_CHART_COLORS[cat]
          const isActive = drilldownType === 'income' && selectedIncomeCard === cat
          const pct = incomeMonthData.total > 0 ? ((amount / incomeMonthData.total) * 100).toFixed(1) : '0'
          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedIncomeCard(isActive ? null : cat)
                setDrilldownType('income')
                setSelectedCat(null)
                setSelectedTrendDetail(null)
              }}
              className="text-left rounded-xl p-3 transition-all"
              style={{
                background: `${color}${isActive ? '20' : '0d'}`,
                outline: isActive ? `2px solid ${color}` : '2px solid transparent',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs font-medium" style={{ color }}>{cat}</span>
              </div>
              <p className="text-base font-bold text-slate-800">{formatWonFull(amount)}</p>
              <p className="text-[10px] text-slate-400">{pct}%</p>
            </button>
          )
        })}
      </div>

      {/* KPI Cards — 지출 row */}
      <p className="text-[10px] text-slate-400 font-medium mb-1.5">지출</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {/* 전체 지출 */}
        {(() => {
          const isActive = drilldownType === 'expense' && (!selectedCat || selectedCat === '__all__')
          return (
            <button
              onClick={() => {
                setSelectedIncomeCard(null)
                setDrilldownType('expense')
                setSelectedCat(null)
                setSelectedTrendDetail(null)
              }}
              className="text-left rounded-xl p-3 transition-all"
              style={{
                background: isActive ? 'rgba(26,35,126,0.1)' : 'rgba(26,35,126,0.04)',
                outline: isActive ? '2px solid #1A237E' : '2px solid transparent',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: isActive ? '#1A237E' : '#94a3b8' }} />
                <span className="text-xs font-medium" style={{ color: isActive ? '#1A237E' : '#64748b' }}>전체 지출</span>
              </div>
              <p className="text-base font-bold text-slate-800">{formatWonFull(monthData.total)}</p>
            </button>
          )
        })()}
        {/* 지출 카테고리 카드 4개 */}
        {activeCategories.map(cat => {
          const amount = monthData[cat as keyof MonthlyData] as number
          const isSelected = drilldownType === 'expense' && selectedCat === cat
          const pct = monthData.total > 0 ? ((amount / monthData.total) * 100).toFixed(1) : '0'
          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedIncomeCard(null)
                setDrilldownType('expense')
                setSelectedCat(isSelected ? null : cat)
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

      {/* Chart */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500">
            {isCategory ? `${selectedCat} 월별 추이` : selectedIncomeCard ? `${selectedIncomeCard} 월별 추이` : '월별 수입·지출 현황'}
          </p>
          {selectedMonth && (
            <button
              onClick={() => onMonthSelect?.(selectedMonth)}
              className="text-xs font-medium"
              style={{ color: '#1A237E' }}
            >
              월 필터 해제
            </button>
          )}
        </div>
        {isCategory && catDetailsLoading ? (
          <div className="h-[220px] bg-slate-50 rounded-xl animate-pulse" />
        ) : selectedIncomeCard ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${Math.round(v / 10000)}만`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(value: number) => [formatWonFull(value), selectedIncomeCard]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Bar
                dataKey={selectedIncomeCard}
                stackId="a"
                fill={INCOME_CHART_COLORS[selectedIncomeCard] ?? '#64748b'}
                radius={[3, 3, 0, 0]}
                cursor="pointer"
                onClick={(_: unknown, index: number) => onMonthSelect?.(index + 1)}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} opacity={!selectedMonth || selectedMonth === i + 1 ? 1 : 0.3} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : isCategory ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${Math.round(v / 10000)}만`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
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
                  onClick={(_: unknown, index: number) => onMonthSelect?.(index + 1)}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} opacity={!selectedMonth || selectedMonth === i + 1 ? 1 : 0.3} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 2, right: 8, left: 0, bottom: 2 }} barCategoryGap="20%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${Math.round(v / 10000)}만`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(value: number, name: string) => [formatWonFull(value), name]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {/* 수입 Bars */}
              <Bar
                dataKey="수입_급여"
                stackId="income"
                name="급여"
                fill={INCOME_CHART_COLORS['급여']}
                radius={[0, 0, 0, 0]}
                cursor="pointer"
                onClick={(_: unknown, index: number) => { setDrilldownType('income'); onMonthSelect?.(index + 1) }}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} opacity={!selectedMonth || selectedMonth === i + 1 ? 1 : 0.3} />
                ))}
              </Bar>
              <Bar
                dataKey="수입_급여 외"
                stackId="income"
                name="급여 외"
                fill={INCOME_CHART_COLORS['급여 외']}
                radius={[3, 3, 0, 0]}
                cursor="pointer"
                onClick={(_: unknown, index: number) => { setDrilldownType('income'); onMonthSelect?.(index + 1) }}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} opacity={!selectedMonth || selectedMonth === i + 1 ? 1 : 0.3} />
                ))}
              </Bar>
              {/* 지출 Bars */}
              {activeCategories.map((cat, idx) => (
                <Bar
                  key={`지출_${cat}`}
                  dataKey={`지출_${cat}`}
                  stackId="expense"
                  name={cat}
                  fill={catColors[cat] ?? '#6B8CAE'}
                  radius={idx === activeCategories.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                  cursor="pointer"
                  onClick={(_: unknown, index: number) => { setDrilldownType('expense'); onMonthSelect?.(index + 1) }}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} opacity={!selectedMonth || selectedMonth === i + 1 ? 1 : 0.3} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Drilldown type toggle */}
      {!isCategory && selectedMonth && (
        <div className="flex gap-1 mb-4">
          {(['income', 'expense'] as const).map(t => (
            <button
              key={t}
              onClick={() => setDrilldownType(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                drilldownType === t ? 'text-white' : 'bg-slate-100 text-slate-500'
              }`}
              style={drilldownType === t ? { background: '#1A237E' } : undefined}
            >
              {t === 'income' ? '수입' : '지출'}
            </button>
          ))}
        </div>
      )}

      {/* Category summary (no category selected) */}
      {!isCategory && (
        <div className="mb-5 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2">
          {displayCategories.map(cat => {
            const amount = getAmount(cat)
            const pct = displayTotal > 0 ? Math.round(amount / displayTotal * 100) : 0
            const color = getCatColor(cat)
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    {drilldownType === 'income' ? (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                        style={{ backgroundColor: color }}
                      >
                        {cat}
                      </span>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={catBadgeStyle(cat)}>{cat}</span>
                    )}
                    <span className="text-slate-400 ml-2 shrink-0">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-800 shrink-0 w-24 text-right">{formatWonFull(amount)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail summary (category selected) */}
      {isCategory && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold mb-2" style={{ color: '#1A237E' }}>{selectedCat} 항목별 집계</h3>
          {catDetailsLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-8 bg-slate-50 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1.5 md:[grid-auto-flow:column]"
              style={{
                gridTemplateRows: detailSummary && detailSummary.length > 3
                  ? `repeat(${Math.ceil(detailSummary.length / 3)}, auto)` : undefined,
              }}
            >
              {detailSummary && detailSummary.length > 0 ? detailSummary.map((d, rank) => {
                const pct = catTotal > 0 ? Math.round(d.amount / catTotal * 100) : 0
                const isDetailSelected = selectedTrendDetail === d.name
                return (
                  <div
                    key={d.name}
                    className={`flex items-center gap-2 rounded-lg px-1 py-0.5 cursor-pointer transition-colors ${isDetailSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                    onClick={() => setSelectedTrendDetail(isDetailSelected ? null : d.name)}
                  >
                    <span className="text-[10px] text-slate-300 w-4 shrink-0 text-right">{rank + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-0.5">
                        <span
                          className={`truncate max-w-[100px] ${isDetailSelected ? 'text-slate-800 font-bold' : 'text-slate-600'}`}
                          title={d.name}
                        >
                          {d.name}
                        </span>
                        <span className="text-slate-400 ml-1 shrink-0">{pct}%</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: catColors[selectedCat!] }} />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 shrink-0 w-16 text-right">{formatWonFull(d.amount)}</span>
                  </div>
                )
              }) : (
                <p className="text-xs text-slate-400 py-2">{detailSearch ? '검색 결과가 없습니다.' : '내역이 없습니다.'}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>

    {/* Table: income or expense */}
    {drilldownType === 'income' && !isCategory ? (
      <IncomeTableCard incomes={incomes} loading={incomesLoading} />
    ) : (
      <ExpenseTableCard
        expenses={expenses}
        loading={expensesLoading}
        selectedCat={selectedCat}
        selectedTrendDetail={selectedTrendDetail}
        isCategory={!!isCategory}
        onReset={() => { setSelectedCat(null); setSelectedTrendDetail(null) }}
      />
    )}
  </>
  )
}

/* ── Expense Table Card ── */
function ExpenseTableCard({
  expenses, loading, selectedCat, selectedTrendDetail, isCategory, onReset,
}: {
  expenses: ExpenseItem[] | null
  loading: boolean
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

  const tableData = useMemo(() => {
    if (!expenses) return []
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
          placeholder="검색..."
          className="w-44 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            <div className="flex gap-2 mb-3 flex-wrap">
              {(['date', 'category', 'detail', 'amount'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => handleSort(key)}
                  className={`px-2 py-1 rounded-lg text-xs transition-colors ${sortKey !== key ? 'bg-slate-100 text-slate-500' : ''}`}
                  style={sortKey === key ? { background: '#1A237E', color: '#fff' } : undefined}
                >
                  {{ date: '날짜', category: '분류', detail: '내역', amount: '금액' }[key]}{sortIcon(key)}
                </button>
              ))}
            </div>
            {slice.map((e, i) => (
              <div key={`${e.date}-${e.detail}-${e.amount}-${i}`} className="border border-slate-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={catBadgeStyle(e.category)}>{e.category}</span>
                    {e.detail && <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{e.detail}</span>}
                  </div>
                  <span className="font-semibold text-slate-800 text-sm">{formatWonFull(e.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{e.date}</span>
                  <div className="flex items-center gap-1.5">
                    {e.member && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        e.member === 'L' ? 'bg-blue-50 text-blue-600' :
                        e.member === 'P' ? 'bg-pink-50 text-pink-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>{e.member}</span>
                    )}
                    <span>{e.method}</span>
                  </div>
                </div>
                {e.memo && <p className="text-xs text-slate-400 mt-1 break-words">{e.memo}</p>}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={tbl.th}>#</th>
                  <th className={`${tbl.th} cursor-pointer hover:text-slate-600 select-none`} onClick={() => handleSort('date')}>날짜{sortIcon('date')}</th>
                  <th className={`${tbl.th} cursor-pointer hover:text-slate-600 select-none`} onClick={() => handleSort('category')}>분류{sortIcon('category')}</th>
                  <th className={`${tbl.th} cursor-pointer hover:text-slate-600 select-none`} onClick={() => handleSort('detail')}>내역{sortIcon('detail')}</th>
                  <th className={tbl.th}>사용자</th>
                  <th className={tbl.th}>비고</th>
                  <th className={tbl.th}>결제수단</th>
                  <th className={`${tbl.thRight} cursor-pointer hover:text-slate-600 select-none`} onClick={() => handleSort('amount')}>금액{sortIcon('amount')}</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((e, i) => (
                  <tr key={`${e.date}-${e.detail}-${e.amount}-${i}`} className={i % 2 === 1 ? tbl.rowOdd : tbl.rowEven}>
                    <td className="py-2 px-3 text-slate-300 text-xs">{(safePage - 1) * pageSize + i + 1}</td>
                    <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap">{e.date}</td>
                    <td className="py-2 px-3">
                      <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={catBadgeStyle(e.category)}>{e.category}</span>
                    </td>
                    <td className="py-2 px-3">
                      {e.detail ? <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">{e.detail}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-2 px-3">
                      {e.member ? (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          e.member === 'L' ? 'bg-blue-50 text-blue-600' :
                          e.member === 'P' ? 'bg-pink-50 text-pink-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>{e.member}</span>
                      ) : <span className="text-slate-300 text-xs">-</span>}
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
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${pageSize !== size ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'font-semibold'}`}
                  style={pageSize === size ? { background: '#1A237E', color: '#fff' } : undefined}
                >{size}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">처음</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">이전</button>
              <span className="px-3 py-1 text-xs text-slate-600 font-medium">{safePage} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">다음</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">끝</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
