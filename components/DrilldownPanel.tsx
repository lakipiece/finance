'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend, LineChart, Line } from 'recharts'
import type { MonthlyData, ExpenseItem } from '@/lib/types'
import type { CategoryDetailsData } from './DashboardClient'
import { formatWonFull, formatDate, CATEGORIES } from '@/lib/utils'
import CategoryBadge from '@/components/ui/CategoryBadge'
import { useTheme } from '@/lib/ThemeContext'
import { useFilter } from '@/lib/FilterContext'
import { tbl, field } from '@/lib/styles'
import IncomeTableCard from './IncomeTableCard'
import type { IncomeRow } from './IncomeTableCard'

const INCOME_CHART_COLORS: Record<string, string> = {
  '급여': '#4527A0',
  '기타': '#5A6476',
}

interface IncomeMonthData {
  total: number
  급여: number
  기타: number
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
  incomeMonthlyList: Array<{ month: string; total: number; 급여: number; 기타: number }>
  incomes: IncomeRow[] | null
  incomesLoading: boolean
}

const PAGE_SIZES = [20, 50, 100] as const

/**
 * KPI 선택 카드 — 선택 상태는 잉크 배경으로만 표현한다.
 * 카테고리색은 6px 점에만 남기고 배경·글자색으로 쓰지 않는다.
 * (색 틴트를 배경에 깔면 중성 램프가 깨지고, 선택 여부와 카테고리가 같은 채널을 두고 다툰다.)
 */
function kpiCardCls(selected: boolean): string {
  return `text-left rounded-card p-[13px] transition-colors ${
    selected ? 'bg-action' : 'bg-surface-low hover:bg-surface-container'
  }`
}
const kpiLabelCls = (selected: boolean) =>
  `text-body font-medium ${selected ? 'text-white/70' : 'text-ink-3'}`
const kpiValueCls = (selected: boolean) =>
  `text-heading tabular-nums ${selected ? 'text-white' : 'text-ink'}`
const kpiSubCls = (selected: boolean) =>
  `text-micro tracking-normal tabular-nums ${selected ? 'text-white/55' : 'text-ink-4'}`

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
  const [cumulative, setCumulative] = useState(false)

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
        [selectedIncomeCard]: incomeMonthlyList[i]?.[selectedIncomeCard as '급여'|'기타'] ?? 0,
      }))
    }
    // Overall: stacked income + expense
    return MONTH_LABELS.map((label, i) => ({
      month: label,
      수입_급여:  incomeMonthlyList[i]?.급여 ?? 0,
      수입_기타:  incomeMonthlyList[i]?.기타 ?? 0,
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
  const allIncomeCategories = (['급여', '기타'] as const).filter(c => incomeMonthData[c] > 0)
  const incomeCategories = selectedIncomeCard
    ? allIncomeCategories.filter(c => c === selectedIncomeCard)
    : allIncomeCategories

  const displayCategories = !isCategory
    ? (drilldownType === 'income' ? incomeCategories : activeCategories)
    : []
  const displayTotal = !isCategory
    ? (drilldownType === 'income'
        ? (selectedIncomeCard ? (incomeMonthData[selectedIncomeCard as '급여'|'기타'] ?? 0) : incomeMonthData.total)
        : monthData.total)
    : 0
  const getAmount = (cat: string) =>
    drilldownType === 'income'
      ? (incomeMonthData[cat as '급여' | '기타'] ?? 0)
      : (monthData[cat as keyof MonthlyData] as number)
  const getCatColor = (cat: string) =>
    drilldownType === 'income' ? (INCOME_CHART_COLORS[cat] ?? '#5b6a80') : catColors[cat]

  return (
  <>
    <div className="bg-surface-card rounded-card shadow-card p-[13px] sm:p-[13px] mb-4 sm:mb-6">
      {/* KPI Cards — 수입 row */}
      <p className="text-micro tracking-normal text-ink-4 font-medium mb-1.5 mt-3">수입</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
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
              className={kpiCardCls(isActive)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00695C' }} />
                <span className={kpiLabelCls(isActive)}>전체 수입</span>
              </div>
              <p className={kpiValueCls(isActive)}>{formatWonFull(incomeMonthData.total)}</p>
            </button>
          )
        })()}
        {/* 수입 카테고리 카드 2개 */}
        {(['급여', '기타'] as const).map(cat => {
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
              className={kpiCardCls(isActive)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                <span className={kpiLabelCls(isActive)}>{cat}</span>
              </div>
              <p className={kpiValueCls(isActive)}>{formatWonFull(amount)}</p>
              <p className={kpiSubCls(isActive)}>{pct}%</p>
            </button>
          )
        })}
      </div>

      {/* KPI Cards — 지출 row */}
      <p className="text-micro tracking-normal text-ink-4 font-medium mb-1.5">지출</p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
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
              className={kpiCardCls(isActive)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#1A237E' }} />
                <span className={kpiLabelCls(isActive)}>전체 지출</span>
              </div>
              <p className={kpiValueCls(isActive)}>{formatWonFull(monthData.total)}</p>
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
              className={kpiCardCls(isSelected)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: catColors[cat] }} />
                <span className={kpiLabelCls(isSelected)}>{cat}</span>
              </div>
              <p className={kpiValueCls(isSelected)}>{formatWonFull(amount)}</p>
              <p className={kpiSubCls(isSelected)}>{pct}%</p>
            </button>
          )
        })}
      </div>

      {/* Chart */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-body font-medium text-ink-3">
            {isCategory ? `${selectedCat} 월별 추이` : selectedIncomeCard ? `${selectedIncomeCard} 월별 추이` : '월별 수입·지출 현황'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCumulative(v => !v)}
              className={`px-2 py-0.5 rounded text-meta font-medium transition-colors ${cumulative ? 'bg-action text-white' : 'bg-surface-low text-ink-3 hover:bg-surface-high'}`}
            >
              {cumulative ? '누적' : '월별'}
            </button>
            {selectedMonth && (
              <button
                onClick={() => onMonthSelect?.(selectedMonth)}
                className="text-body font-medium"
                style={{ color: '#0d1c2e' }}
              >
                월 필터 해제
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="text-ink-5 hover:text-ink-3 transition-colors p-1 rounded-btn hover:bg-surface-low"
                aria-label="닫기"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {isCategory && catDetailsLoading ? (
          <div className="h-[220px] bg-surface-low rounded-field animate-pulse" />
        ) : cumulative ? (
          // 누적 라인 차트
          (() => {
            // 누적 합계 계산
            const cumulData = (chartData as Array<Record<string, number | string>>).reduce<Array<Record<string, number | string>>>((acc, row, i) => {
              const prev = acc[i - 1] ?? {}
              const entry: Record<string, number | string> = { month: row.month }
              if (selectedIncomeCard) {
                entry['누적'] = ((prev['누적'] as number) ?? 0) + ((row[selectedIncomeCard] as number) ?? 0)
              } else if (isCategory) {
                for (const key of chartKeys) {
                  entry[key] = ((prev[key] as number) ?? 0) + ((row[key] as number) ?? 0)
                }
              } else if (drilldownType === 'expense') {
                for (const cat of activeCategories) {
                  entry[cat] = ((prev[cat] as number) ?? 0) + ((row[`지출_${cat}`] as number) ?? 0)
                }
              } else {
                const incomeTotal = ((row['수입_급여'] as number) ?? 0) + ((row['수입_기타'] as number) ?? 0)
                entry['수입'] = ((prev['수입'] as number) ?? 0) + incomeTotal
              }
              return [...acc, entry]
            }, [])

            const lineKeys = selectedIncomeCard
              ? ['누적']
              : isCategory
                ? chartKeys
                : drilldownType === 'expense'
                  ? activeCategories
                  : ['수입']
            const lineColors: Record<string, string> = selectedIncomeCard
              ? { '누적': INCOME_CHART_COLORS[selectedIncomeCard] ?? '#6B8CAE' }
              : isCategory
                ? chartColors
                : drilldownType === 'expense'
                  ? Object.fromEntries(activeCategories.map(cat => [cat, catColors[cat] ?? '#6B8CAE']))
                  : { '수입': '#4527A0' }

            return (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={cumulData} margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#a8b3c4' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${Math.round(v / 10000)}만`} tick={{ fontSize: 10, fill: '#a8b3c4' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatWonFull(value), name]}
                    contentStyle={{ borderRadius: 11, border: 'none', boxShadow: '0 4px 32px 0 rgba(13,28,46,.06)', fontSize: 12 }}
                  />
                  {lineKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  {lineKeys.map(key => (
                    <Line key={key} type="monotone" dataKey={key} stroke={lineColors[key] ?? '#6B8CAE'}
                      strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )
          })()
        ) : selectedIncomeCard ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 2, right: 8, left: 0, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#a8b3c4' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${Math.round(v / 10000)}만`} tick={{ fontSize: 10, fill: '#a8b3c4' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(value: number) => [formatWonFull(value), selectedIncomeCard]}
                contentStyle={{ borderRadius: 11, border: 'none', boxShadow: '0 4px 32px 0 rgba(13,28,46,.06)', fontSize: 12 }}
              />
              <Bar
                dataKey={selectedIncomeCard}
                stackId="a"
                fill={INCOME_CHART_COLORS[selectedIncomeCard] ?? '#5b6a80'}
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
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#a8b3c4' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${Math.round(v / 10000)}만`} tick={{ fontSize: 10, fill: '#a8b3c4' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(value: number, name: string) => [formatWonFull(value), name]}
                contentStyle={{ borderRadius: 11, border: 'none', boxShadow: '0 4px 32px 0 rgba(13,28,46,.06)', fontSize: 12 }}
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
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#a8b3c4' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${Math.round(v / 10000)}만`} tick={{ fontSize: 10, fill: '#a8b3c4' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(value: number, name: string) => [formatWonFull(value), name]}
                contentStyle={{ borderRadius: 11, border: 'none', boxShadow: '0 4px 32px 0 rgba(13,28,46,.06)', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {/* 수입 Bars — 전체 수입 선택 시에만 표시 */}
              {drilldownType === 'income' && (
                <>
                  <Bar
                    dataKey="수입_급여"
                    stackId="income"
                    name="급여"
                    fill={INCOME_CHART_COLORS['급여']}
                    cursor="pointer"
                    onClick={(_: unknown, index: number) => { setDrilldownType('income'); onMonthSelect?.(index + 1) }}
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} opacity={!selectedMonth || selectedMonth === i + 1 ? 1 : 0.3} />
                    ))}
                  </Bar>
                  <Bar
                    dataKey="수입_기타"
                    stackId="income"
                    name="기타"
                    fill={INCOME_CHART_COLORS['기타']}
                    cursor="pointer"
                    onClick={(_: unknown, index: number) => { setDrilldownType('income'); onMonthSelect?.(index + 1) }}
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} opacity={!selectedMonth || selectedMonth === i + 1 ? 1 : 0.3} />
                    ))}
                  </Bar>
                </>
              )}
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
              className={`px-3 py-1 rounded-btn text-body font-medium transition-colors ${
                drilldownType === t ? 'text-white' : 'bg-surface-low text-ink-3'
              }`}
              style={drilldownType === t ? { background: '#131b2e' } : undefined}
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
                  <div className="flex items-center justify-between text-body mb-0.5">
                    {drilldownType === 'income' ? (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded-full text-micro tracking-normal font-medium text-white"
                        style={{ backgroundColor: color }}
                      >
                        {cat}
                      </span>
                    ) : (
                      <CategoryBadge category={cat} size="sm" />
                    )}
                    <span className="text-ink-4 ml-2 shrink-0">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-low rounded-full overflow-hidden mt-1.5">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
                <span className="text-subhead font-medium text-ink shrink-0 w-24 text-right">{formatWonFull(amount)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail summary (category selected) */}
      {isCategory && (
        <div className="mb-5">
          <h3 className="text-subhead font-medium mb-2" style={{ color: '#0d1c2e' }}>{selectedCat} 항목별 집계</h3>
          {catDetailsLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-8 bg-surface-low rounded-btn animate-pulse" />)}
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
                    className={`flex items-center gap-2 rounded-btn px-1 py-0.5 cursor-pointer transition-colors ${isDetailSelected ? 'bg-surface-low' : 'hover:bg-surface-low'}`}
                    onClick={() => setSelectedTrendDetail(isDetailSelected ? null : d.name)}
                  >
                    <span className="text-micro tracking-normal text-ink-5 w-4 shrink-0 text-right">{rank + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-body mb-0.5">
                        <span
                          className={`truncate max-w-[100px] ${isDetailSelected ? 'text-ink font-bold' : 'text-ink-2'}`}
                          title={d.name}
                        >
                          {d.name}
                        </span>
                        <span className="text-ink-4 ml-1 shrink-0">{pct}%</span>
                      </div>
                      <div className="h-1 bg-surface-low rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: catColors[selectedCat!] }} />
                      </div>
                    </div>
                    <span className="text-body font-medium text-ink shrink-0 w-16 text-right">{formatWonFull(d.amount)}</span>
                  </div>
                )
              }) : (
                <p className="text-body text-ink-4 py-2">{detailSearch ? '검색 결과가 없습니다.' : '내역이 없습니다.'}</p>
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
    <div className="bg-surface-card rounded-card shadow-card p-[13px]">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-heading font-bold text-ink">
          {selectedTrendDetail ? `${selectedCat} > ${selectedTrendDetail} 내역` : isCategory ? `${selectedCat} 내역` : '지출 내역'}
          {(selectedCat || selectedTrendDetail) && (
            <button onClick={onReset} className="ml-2 text-body text-ink-4 hover:text-ink-2 font-normal">전체보기</button>
          )}
        </h3>
        <input
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
          placeholder="검색..."
          className="w-44 rounded-btn px-3 py-1.5 text-body text-ink-2 focus:outline-none bg-surface-low border-0 focus:bg-surface-card focus:shadow-focus placeholder:text-ink-5 transition-colors"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-surface-low rounded-btn animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Mobile(<640px): 2행 접기 — D-06.
              360px에서 4열이 들어가지 않으므로 분류를 내역 아래로 내린다.
              행 높이 57px으로 터치 타깃 44px을 여유 있게 넘긴다. */}
          <div className="sm:hidden">
            <div className="flex gap-2 mb-3 flex-wrap">
              {(['date', 'category', 'detail', 'amount'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => handleSort(key)}
                  className={`px-2 py-1 rounded-btn text-body transition-colors ${
                    sortKey === key ? 'bg-action text-white font-bold' : 'bg-surface-low text-ink-3'
                  }`}
                >
                  {{ date: '날짜', category: '분류', detail: '내역', amount: '금액' }[key]}{sortIcon(key)}
                </button>
              ))}
            </div>
            {slice.map((e, i) => (
              <div
                key={`${e.date}-${e.detail}-${e.amount}-${i}`}
                className="flex items-center gap-[9px] py-2 h-[57px] border-b border-surface-low last:border-0"
              >
                {/* 좌측 블록 — min-w-0이 없으면 ellipsis가 동작하지 않는다 */}
                <div className="flex-1 min-w-0">
                  <p className="text-subhead font-normal text-ink whitespace-nowrap overflow-hidden text-ellipsis">
                    {e.detail || e.category}
                  </p>
                  <div className="flex items-center gap-1.5 mt-[3px]">
                    <span className="text-micro tracking-normal text-ink-5 tabular-nums shrink-0">{formatDate(e.date)}</span>
                    {/* 색만으로 의미를 지게 하지 않는다 — 점과 라벨을 함께 유지 */}
                    <CategoryBadge category={e.category} size="sm" />
                  </div>
                </div>
                <span className="text-subhead font-normal text-ink tabular-nums whitespace-nowrap shrink-0">
                  {formatWonFull(e.amount)}
                </span>
              </div>
            ))}
          </div>

          {/* Desktop(≥640px): 표 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-subhead">
              <thead>
                <tr className="border-b border-surface-low">
                  <th className={tbl.th}>#</th>
                  <th className={`${tbl.th} cursor-pointer hover:text-ink-2 select-none`} onClick={() => handleSort('date')}>날짜{sortIcon('date')}</th>
                  <th className={`${tbl.th} cursor-pointer hover:text-ink-2 select-none`} onClick={() => handleSort('category')}>분류{sortIcon('category')}</th>
                  <th className={`${tbl.th} cursor-pointer hover:text-ink-2 select-none`} onClick={() => handleSort('detail')}>내역{sortIcon('detail')}</th>
                  <th className={tbl.th}>사용자</th>
                  <th className={tbl.th}>비고</th>
                  <th className={tbl.th}>결제수단</th>
                  <th className={`${tbl.thRight} cursor-pointer hover:text-ink-2 select-none`} onClick={() => handleSort('amount')}>금액{sortIcon('amount')}</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((e, i) => (
                  <tr key={`${e.date}-${e.detail}-${e.amount}-${i}`} className={i % 2 === 1 ? tbl.rowOdd : tbl.rowEven}>
                    <td className="py-[5px] px-2 text-ink-5 text-body">{(safePage - 1) * pageSize + i + 1}</td>
                    <td className="py-[5px] px-2 text-ink-4 text-body whitespace-nowrap tabular-nums">{formatDate(e.date)}</td>
                    <td className="py-[5px] px-2">
                      <CategoryBadge category={e.category} size="sm" />
                    </td>
                    <td className="py-[5px] px-2">
                      {e.detail ? <span className="inline-block px-1.5 py-0.5 rounded-full text-micro tracking-normal font-medium bg-surface-low text-ink">{e.detail}</span> : <span className="text-ink-5">—</span>}
                    </td>
                    <td className="py-[5px] px-2">
                      {e.member ? (
                        <span className={`text-micro tracking-normal font-bold px-1.5 py-0.5 rounded ${
                          e.member === 'L' ? 'bg-surface-low text-ink-2' :
                          e.member === 'P' ? 'bg-surface-low text-ink-2' :
                          'bg-surface-low text-ink-3'
                        }`}>{e.member}</span>
                      ) : <span className="text-ink-5 text-body">-</span>}
                    </td>
                    <td className="py-[5px] px-2 text-ink-4 text-body max-w-[180px]">
                      {e.memo ? <span className="block truncate" title={e.memo}>{e.memo}</span> : <span className="text-ink-5">—</span>}
                    </td>
                    <td className="py-[5px] px-2 text-ink-4 text-body">{e.method || <span className="text-ink-5">—</span>}</td>
                    <td className="py-[5px] px-2 text-right font-medium text-ink text-body whitespace-nowrap">{formatWonFull(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-low flex-wrap gap-3">
            <div className="flex items-center gap-2 text-body text-ink-4">
              <span>총 {tableData.length.toLocaleString()}건</span>
              <span className="text-ink-5">|</span>
              <span>페이지당</span>
              {PAGE_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => { setPageSize(size); setPage(1) }}
                  className={`px-2 py-0.5 rounded text-body transition-colors ${pageSize !== size ? 'bg-surface-low text-ink-3 hover:bg-surface-high' : 'font-medium'}`}
                  style={pageSize === size ? { background: '#131b2e', color: '#fff' } : undefined}
                >{size}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={safePage === 1} className="px-2 py-1 rounded text-body text-ink-3 hover:bg-surface-low disabled:opacity-50 disabled:cursor-not-allowed">처음</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded text-body text-ink-3 hover:bg-surface-low disabled:opacity-50 disabled:cursor-not-allowed">이전</button>
              <span className="px-3 py-1 text-body text-ink-2 font-medium">{safePage} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded text-body text-ink-3 hover:bg-surface-low disabled:opacity-50 disabled:cursor-not-allowed">다음</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="px-2 py-1 rounded text-body text-ink-3 hover:bg-surface-low disabled:opacity-50 disabled:cursor-not-allowed">끝</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
