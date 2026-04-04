# Dashboard Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify dashboard to 3-row layout with global filter system (category + month) where all charts and tables are interconnected.

**Architecture:** Replace MonthlyClient with a new unified Dashboard component. KPI cards show filtered totals. Chart area (left) + drilldown summary (right) share a single card. Expense table at bottom with sortable headers. All state managed in one parent component.

**Tech Stack:** Next.js, React, Recharts, Tailwind CSS, existing FilterContext for excludeLoan

---

### Task 1: Rewrite KpiCards — add "전체" card and month-aware totals

**Files:**
- Modify: `components/KpiCards.tsx`

**Step 1: Rewrite KpiCards component**

The new KpiCards must:
- Show 4 cards: 전체, 고정비, 변동비, 여행공연비
- Accept `selectedMonth` prop — when set, show monthly totals instead of annual
- Accept `selectedCategory` prop — highlight active card
- "전체" card click = clear category filter
- Category card click = toggle that category filter
- Show percentage on category cards (relative to total)

```tsx
'use client'

import type { DashboardData, MonthlyData } from '@/lib/types'
import { formatWon, CAT_COLORS, CATEGORIES } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'
import { useFilter } from '@/lib/FilterContext'

interface Props {
  data: DashboardData
  year: number
  selectedCategory: string | null
  selectedMonth: number | null
  onCategoryClick: (cat: string | null) => void
}

export default function KpiCards({ data, year, selectedCategory, selectedMonth, onCategoryClick }: Props) {
  const { catColors } = useTheme()
  const { excludeLoan } = useFilter()

  const activeCategories = CATEGORIES.filter(c => {
    if (excludeLoan && c === '대출상환') return false
    return data.categoryTotals[c] > 0
  })

  // Compute totals based on month filter
  const monthData = selectedMonth ? data.monthlyList[selectedMonth - 1] : null
  const getAmount = (cat: string) => monthData ? (monthData[cat as keyof MonthlyData] as number) : data.categoryTotals[cat as keyof typeof data.categoryTotals]
  const total = monthData ? monthData.total : data.total
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%'
  const subtitle = selectedMonth ? `${selectedMonth}월` : `${year}년`

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${activeCategories.length + 1} gap-4`}>
      {/* Total card */}
      <div
        onClick={() => onCategoryClick(null)}
        className={`bg-white rounded-2xl shadow-sm border p-5 hover:-translate-y-0.5 transition-all cursor-pointer ${
          selectedCategory === null ? 'border-slate-400 ring-2 ring-slate-200' : 'border-slate-100'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">전체</p>
        </div>
        <p className="text-2xl font-bold mt-1 text-slate-800">{formatWon(total)}</p>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>
      {/* Category cards */}
      {activeCategories.map(cat => {
        const amount = getAmount(cat)
        return (
          <div
            key={cat}
            onClick={() => onCategoryClick(selectedCategory === cat ? null : cat)}
            className={`bg-white rounded-2xl shadow-sm border p-5 hover:-translate-y-0.5 transition-all cursor-pointer ${
              selectedCategory === cat ? 'border-slate-400 ring-2 ring-slate-200' : 'border-slate-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: catColors[cat] ?? CAT_COLORS[cat] }} />
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{cat}</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-slate-800">{formatWon(amount)}</p>
            <p className="text-xs text-slate-400 mt-1">{pct(amount)}</p>
          </div>
        )
      })}
    </div>
  )
}
```

**Step 2: Verify it renders**

Run: `npm run build`
Expected: Build succeeds (component not yet wired up — no errors from unused props)

**Step 3: Commit**

```bash
git add components/KpiCards.tsx
git commit -m "feat: rewrite KpiCards with total card, month-aware totals"
```

---

### Task 2: Create DrilldownSummary — right-side summary panel

**Files:**
- Create: `components/DrilldownSummary.tsx`

**Step 1: Create the DrilldownSummary component**

This component shows:
- When no category selected: category-level summary (가로바 with % and amount)
- When category selected: item-level summary (가로바 with % and amount, clickable)
- Search bar at top for item filtering

```tsx
'use client'

import { useState } from 'react'
import type { MonthlyData, ExpenseItem } from '@/lib/types'
import { formatWonFull, CATEGORIES, CAT_BADGE } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'
import { useFilter } from '@/lib/FilterContext'

interface Props {
  monthData: MonthlyData
  expenses: ExpenseItem[]
  selectedCategory: string | null
  selectedDetail: string | null
  onDetailSelect: (detail: string | null) => void
}

export default function DrilldownSummary({ monthData, expenses, selectedCategory, selectedDetail, onDetailSelect }: Props) {
  const { catColors } = useTheme()
  const { excludeLoan } = useFilter()
  const [detailSearch, setDetailSearch] = useState('')

  const activeCategories = CATEGORIES.filter(c => {
    if (excludeLoan && c === '대출상환') return false
    return (monthData[c as keyof MonthlyData] as number) > 0
  })

  // Category-level rows (no category selected)
  if (!selectedCategory) {
    const total = monthData.total
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-3">카테고리별 합계</h3>
        <div className="space-y-2.5">
          {activeCategories.map(cat => {
            const amount = monthData[cat as keyof MonthlyData] as number
            const pct = total > 0 ? Math.round(amount / total * 100) : 0
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[cat] ?? 'bg-slate-100 text-slate-700'}`}>{cat}</span>
                    <span className="text-slate-400 ml-2 shrink-0">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: catColors[cat] }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-800 shrink-0 w-28 text-right">{formatWonFull(amount)}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Item-level rows (category selected)
  const catExpenses = expenses.filter(e => e.category === selectedCategory)
  const agg: Record<string, number> = {}
  for (const e of catExpenses) {
    const key = e.detail || '기타'
    agg[key] = (agg[key] ?? 0) + e.amount
  }
  const rows = Object.entries(agg)
    .sort((a, b) => b[1] - a[1])
    .filter(([detail]) => !detailSearch || detail.toLowerCase().includes(detailSearch.toLowerCase()))

  const catTotal = catExpenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="text-sm font-semibold text-slate-600 shrink-0">{selectedCategory} 항목별 집계</h3>
        <input
          type="text"
          value={detailSearch}
          onChange={e => setDetailSearch(e.target.value)}
          placeholder="내역 검색..."
          className="flex-1 max-w-48 text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1">
        {rows.length > 0 ? rows.map(([detail, amount]) => {
          const pct = catTotal > 0 ? Math.round(amount / catTotal * 100) : 0
          const isSelected = selectedDetail === detail
          return (
            <div
              key={detail}
              className={`flex items-center gap-3 rounded-lg px-1 py-0.5 cursor-pointer transition-colors ${isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              onClick={() => onDetailSelect(isSelected ? null : detail)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className={`truncate max-w-[160px] ${isSelected ? 'text-slate-800 font-bold' : 'text-slate-600'}`} title={detail}>{detail}</span>
                  <span className="text-slate-400 ml-2 shrink-0">{pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: catColors[selectedCategory] }} />
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-800 shrink-0 w-28 text-right">{formatWonFull(amount)}</span>
            </div>
          )
        }) : (
          <p className="text-xs text-slate-400 py-2">{detailSearch ? '검색 결과가 없습니다.' : '내역이 없습니다.'}</p>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add components/DrilldownSummary.tsx
git commit -m "feat: add DrilldownSummary component for category/item breakdown"
```

---

### Task 3: Rewrite MonthlyClient — unified 3-row dashboard

**Files:**
- Modify: `components/MonthlyClient.tsx`

**Step 1: Rewrite MonthlyClient**

New structure:
- Row 1: KpiCards (with selectedMonth and selectedCategory)
- Row 2: Chart (left) + DrilldownSummary (right) in one white card
- Row 3: Expense table with sortable headers

State:
- `selectedCategory` — from KPI card click
- `selectedMonth` — from chart bar click
- `selectedDetail` — from drilldown item click
- `searchQuery` — table search
- `sortKey` / `sortDir` — table sort

```tsx
'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData, MonthlyData, ExpenseItem } from '@/lib/types'
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
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs max-w-[200px]">
                    {e.memo ? <span className="block truncate" title={e.memo}>{e.memo}</span> : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs">{e.method || <span className="text-slate-300">—</span>}</td>
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
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. CategorySection and CategoryDetailChart are no longer imported.

**Step 3: Commit**

```bash
git add components/MonthlyClient.tsx
git commit -m "feat: rewrite MonthlyClient as unified 3-row dashboard"
```

---

### Task 4: Clean up unused components

**Files:**
- Delete: `components/Dashboard.tsx`
- Delete: `components/CategorySection.tsx`
- Delete: `components/CategoryDetailChart.tsx`
- Delete: `components/CategoryDetailTable.tsx`
- Modify: `components/DrilldownPanel.tsx` (keep for now — used by monthly tab redirect, but no longer imported by MonthlyClient)

**Step 1: Remove unused imports and files**

Check that no other file imports these components:

```bash
grep -r "CategorySection\|CategoryDetailChart\|CategoryDetailTable\|from.*Dashboard" components/ app/ --include="*.tsx" --include="*.ts" -l
```

Delete files that are no longer imported anywhere.

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no dead code warnings

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused Dashboard, CategorySection, CategoryDetailChart, CategoryDetailTable"
```

---

### Task 5: Verify and deploy

**Step 1: Full build verification**

Run: `npm run build`
Expected: Clean build, no warnings

**Step 2: Verify all pages still work**

- `/` — new unified dashboard
- `/compare` — year comparison (should be unaffected)
- `/search` — search page (should be unaffected)
- `/admin` — admin page (should be unaffected)
- `/monthly` — should redirect to `/`

**Step 3: Commit and push**

```bash
git push
```
