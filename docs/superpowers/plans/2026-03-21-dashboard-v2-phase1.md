# Dashboard v2 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tab navigation, theme picker, chart improvements, and search to the existing Next.js household ledger dashboard.

**Architecture:** Split the monolithic Dashboard component into per-tab pages under the Next.js App Router. A ThemeContext provides palette state globally; all chart components read colors from it. The existing Supabase data layer stays unchanged.

**Tech Stack:** Next.js 14 App Router, React Context, Recharts, Tailwind CSS, TypeScript, Supabase

> **Note on testing:** This project has no test framework. Verification steps use the dev server (`npm run dev`) and browser inspection instead of automated tests.

---

## File Map

| Status | File | Responsibility |
|--------|------|----------------|
| Create | `lib/palettes.ts` | 12 palette presets + Palette type |
| Create | `lib/ThemeContext.tsx` | React Context, ThemeProvider, useTheme hook |
| Create | `components/TabNav.tsx` | Header tab navigation (client) |
| Create | `components/ThemePicker.tsx` | Palette dropdown in header (client) |
| Create | `components/HeaderBar.tsx` | Client header shell (title + TabNav + ThemePicker) |
| Create | `components/CategoryDetailChart.tsx` | TOP5 horizontal bar chart (client) |
| Create | `components/CategoryDetailTable.tsx` | Category×detail aggregate table (client) |
| Create | `components/MonthlyClient.tsx` | Monthly tab client component |
| Create | `components/SearchClient.tsx` | Search tab client component |
| Create | `app/monthly/page.tsx` | Monthly analysis tab route |
| Create | `app/compare/page.tsx` | Year comparison tab route (placeholder) |
| Create | `app/search/page.tsx` | Search tab route |
| Modify | `app/layout.tsx` | Add ThemeProvider + HeaderBar |
| Modify | `app/page.tsx` | No change needed (already minimal) |
| Modify | `components/Dashboard.tsx` | Overview layout — remove header/PaymentChart/TrendChart, add CategoryDetailChart |
| Modify | `components/MonthlyChart.tsx` | Replace CAT_COLORS import with useTheme() |
| Modify | `components/CategorySection.tsx` | Replace CAT_COLORS import with useTheme() |
| Modify | `components/DrilldownPanel.tsx` | Replace CAT_COLORS import with useTheme() |
| Delete | `components/PaymentChart.tsx` | Removed per spec |
| Delete | `components/TrendChart.tsx` | Not used in any tab |
| Delete | `app/palettes/page.tsx` | Replaced by ThemePicker |

---

## Task 1: lib/palettes.ts — Palette presets

**Files:**
- Create: `lib/palettes.ts`

- [ ] **Step 1: Create the palette definitions**

```typescript
// lib/palettes.ts
export interface Palette {
  id: string
  name: string
  colors: [string, string, string, string]  // [고정비, 대출상환, 변동비, 여행공연비]
  headerGradient: string
}

export const PALETTES: Palette[] = [
  { id: 'tableau',    name: 'Tableau 10',     colors: ['#4E79A7','#E15759','#59A14F','#F28E2B'], headerGradient: 'linear-gradient(135deg, #2D3E50 0%, #4E79A7 100%)' },
  { id: 'd3',         name: 'D3 Category10',  colors: ['#1F77B4','#D62728','#2CA02C','#FF7F0E'], headerGradient: 'linear-gradient(135deg, #0D3B6E 0%, #1F77B4 100%)' },
  { id: 'observable', name: 'Observable',     colors: ['#4269D0','#FF725C','#6CC5B0','#EFB118'], headerGradient: 'linear-gradient(135deg, #1A237E 0%, #4269D0 100%)' },
  { id: 'pastel',     name: 'Pastel Soft',    colors: ['#7EB8F7','#F4A7A3','#81D4C0','#F9C97C'], headerGradient: 'linear-gradient(135deg, #4A5568 0%, #718096 100%)' },
  { id: 'material',   name: 'Material Design',colors: ['#42A5F5','#EF5350','#26A69A','#FFA726'], headerGradient: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)' },
  { id: 'cool-ocean', name: 'Cool Ocean',     colors: ['#0EA5E9','#06B6D4','#10B981','#6366F1'], headerGradient: 'linear-gradient(135deg, #0C4A6E 0%, #0EA5E9 100%)' },
  { id: 'nordic',     name: 'Nordic Frost',   colors: ['#7DD3FC','#C4B5FD','#86EFAC','#FED7AA'], headerGradient: 'linear-gradient(135deg, #1E3A5F 0%, #2E5C8A 100%)' },
  { id: 'earth',      name: 'Earth Tones',    colors: ['#92400E','#065F46','#1E40AF','#78350F'], headerGradient: 'linear-gradient(135deg, #1C1917 0%, #44403C 100%)' },
  { id: 'vivid',      name: 'Vivid Pop',      colors: ['#3B82F6','#EF4444','#10B981','#F59E0B'], headerGradient: 'linear-gradient(135deg, #1E1B4B 0%, #3730A3 100%)' },
  { id: 'muted',      name: 'Muted Classic',  colors: ['#6B8CAE','#C47D7D','#6DAE8C','#C4A96D'], headerGradient: 'linear-gradient(135deg, #2D3748 0%, #4A5568 100%)' },
  { id: 'purple',     name: 'Purple Suite',   colors: ['#7C3AED','#A855F7','#C084FC','#E879F9'], headerGradient: 'linear-gradient(135deg, #2E1065 0%, #7C3AED 100%)' },
  { id: 'retro',      name: 'Retro Studio',   colors: ['#E76F51','#264653','#2A9D8F','#E9C46A'], headerGradient: 'linear-gradient(135deg, #264653 0%, #2A9D8F 100%)' },
]

export const DEFAULT_PALETTE = PALETTES[9] // Muted Classic
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to palettes.ts

- [ ] **Step 3: Commit**

```bash
git add lib/palettes.ts
git commit -m "feat: add palette preset definitions"
```

---

## Task 2: lib/ThemeContext.tsx — React Context

**Files:**
- Create: `lib/ThemeContext.tsx`

- [ ] **Step 1: Create context, provider, and hook**

```typescript
// lib/ThemeContext.tsx
'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import type { Palette } from './palettes'
import { PALETTES, DEFAULT_PALETTE } from './palettes'
import { CATEGORIES } from './utils'

interface ThemeCtx {
  palette: Palette
  setPalette: (p: Palette) => void
  catColors: Record<string, string>
}

const ThemeContext = createContext<ThemeCtx>({
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
  catColors: Object.fromEntries(CATEGORIES.map((cat, i) => [cat, DEFAULT_PALETTE.colors[i]])),
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>(DEFAULT_PALETTE)

  useEffect(() => {
    const saved = localStorage.getItem('dashboard-theme')
    if (saved) {
      const found = PALETTES.find((p) => p.id === saved)
      if (found) setPaletteState(found)
    }
  }, [])

  function setPalette(p: Palette) {
    setPaletteState(p)
    localStorage.setItem('dashboard-theme', p.id)
  }

  const catColors = Object.fromEntries(
    CATEGORIES.map((cat, i) => [cat, palette.colors[i]])
  )

  return (
    <ThemeContext.Provider value={{ palette, setPalette, catColors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/ThemeContext.tsx
git commit -m "feat: add ThemeContext with palette state and useTheme hook"
```

---

## Task 3: components/TabNav.tsx — Tab navigation

**Files:**
- Create: `components/TabNav.tsx`

- [ ] **Step 1: Create tab navigation component**

```typescript
// components/TabNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: '개요',     href: '/' },
  { label: '월별분석', href: '/monthly' },
  { label: '연도비교', href: '/compare' },
  { label: '검색',     href: '/search' },
]

export default function TabNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1">
      {TABS.map((tab) => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white/90 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/TabNav.tsx
git commit -m "feat: add tab navigation component"
```

---

## Task 4: components/ThemePicker.tsx — Palette dropdown

**Files:**
- Create: `components/ThemePicker.tsx`

- [ ] **Step 1: Create palette picker dropdown**

```typescript
// components/ThemePicker.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { PALETTES } from '@/lib/palettes'

export default function ThemePicker() {
  const { palette, setPalette } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white text-sm"
        title="테마 선택"
      >
        <span className="flex gap-0.5">
          {palette.colors.map((c, i) => (
            <span key={i} className="w-3 h-3 rounded-full inline-block" style={{ background: c }} />
          ))}
        </span>
        <span className="hidden sm:inline text-xs text-white/70">{palette.name}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50">
          <p className="text-xs text-slate-400 font-medium px-1 mb-2">테마 선택</p>
          <div className="grid grid-cols-2 gap-2">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                onClick={() => { setPalette(p); setOpen(false) }}
                className={`flex items-center gap-2 p-2 rounded-xl text-left transition-colors hover:bg-slate-50 ${
                  palette.id === p.id ? 'ring-2 ring-blue-400 bg-slate-50' : ''
                }`}
              >
                <span className="flex gap-0.5 flex-shrink-0">
                  {p.colors.map((c, i) => (
                    <span key={i} className="w-3.5 h-3.5 rounded-sm inline-block" style={{ background: c }} />
                  ))}
                </span>
                <span className="text-xs text-slate-700 font-medium truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ThemePicker.tsx
git commit -m "feat: add theme picker dropdown"
```

---

## Task 5: components/HeaderBar.tsx + update app/layout.tsx

**Files:**
- Create: `components/HeaderBar.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create HeaderBar client component**

```typescript
// components/HeaderBar.tsx
'use client'

import TabNav from './TabNav'
import ThemePicker from './ThemePicker'
import { useTheme } from '@/lib/ThemeContext'

export default function HeaderBar() {
  const { palette } = useTheme()
  return (
    <header
      className="text-white py-5 px-6 shadow-lg"
      style={{ background: palette.headerGradient }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/60 text-xs font-medium tracking-widest mb-0.5">HOUSEHOLD LEDGER</p>
            <h1 className="text-2xl font-bold">가계부 대시보드</h1>
          </div>
          <ThemePicker />
        </div>
        <TabNav />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Update app/layout.tsx**

Replace the entire file content:

```typescript
// app/layout.tsx
import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/lib/ThemeContext'
import HeaderBar from '@/components/HeaderBar'

const notoSans = Noto_Sans_KR({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '가계부 대시보드',
  description: '가계부 지출 분석 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${notoSans.className} bg-slate-50 min-h-screen`}>
        <ThemeProvider>
          <HeaderBar />
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Start dev server and verify header renders**

Run: `npm run dev`
Open: http://localhost:3000
Expected: Header shows gradient background, 4 tabs (개요/월별분석/연도비교/검색), theme picker button on the right

- [ ] **Step 4: Commit**

```bash
git add components/HeaderBar.tsx app/layout.tsx
git commit -m "feat: add themed header with tab nav and theme picker"
```

---

## Task 6: Update chart components to use useTheme()

**Files:**
- Modify: `components/MonthlyChart.tsx`
- Modify: `components/CategorySection.tsx`
- Modify: `components/DrilldownPanel.tsx`

- [ ] **Step 1: Update MonthlyChart.tsx**

Remove `CAT_COLORS` from import, add `useTheme`:

```typescript
// At top of MonthlyChart.tsx — change:
import { CAT_COLORS, CATEGORIES, formatWonFull } from '@/lib/utils'
// to:
import { CATEGORIES, formatWonFull } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'
```

Inside the component, add:
```typescript
export default function MonthlyChart({ monthlyList, selectedMonth, onMonthSelect }: Props) {
  const { catColors } = useTheme()
  // Replace all CAT_COLORS with catColors below
```

Replace every occurrence of `CAT_COLORS` with `catColors` in MonthlyChart.tsx (appears in `fill={CAT_COLORS[cat]}`).

- [ ] **Step 2: Update CategorySection.tsx**

Same pattern — add `useTheme`, replace `CAT_COLORS` with `catColors`:

```typescript
// Add import
import { useTheme } from '@/lib/ThemeContext'
// Remove CAT_COLORS from utils import

// Inside component:
const { catColors } = useTheme()
// Replace CAT_COLORS[...] with catColors[...]
```

Note: CategorySection uses `CAT_COLORS` in 3 places:
1. `fill={CAT_COLORS[entry.name]}` in Pie Cell
2. `stroke={selectedCategory === entry.name ? '#1e3a5f' : '#fff'}` — keep as is
3. `const color = selectedCategory ? (CAT_COLORS[selectedCategory] ?? '#3B82F6') : (CAT_COLORS[row.name] ?? '#3B82F6')` — replace both

- [ ] **Step 3: Update DrilldownPanel.tsx**

```typescript
// Add import
import { useTheme } from '@/lib/ThemeContext'
// Remove CAT_COLORS from utils import

// Inside component:
const { catColors } = useTheme()
// Replace CAT_COLORS with catColors in the two places it's used:
// 1. background: `${catColors[cat]}14`
// 2. background: catColors[cat]
```

- [ ] **Step 4: Verify in browser**

Check http://localhost:3000 — chart colors should still match Muted Classic.
Click a different palette in ThemePicker — all chart colors should update immediately.

- [ ] **Step 5: Commit**

```bash
git add components/MonthlyChart.tsx components/CategorySection.tsx components/DrilldownPanel.tsx
git commit -m "feat: connect chart components to ThemeContext"
```

---

## Task 7: components/CategoryDetailChart.tsx — TOP5 horizontal bar

**Files:**
- Create: `components/CategoryDetailChart.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/CategoryDetailChart.tsx
'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { ExpenseItem } from '@/lib/types'
import { formatWonFull } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  allExpenses: ExpenseItem[]
  selectedCategory: string | null
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700">{payload[0].payload.name}</p>
      <p className="text-slate-500 mt-0.5">{formatWonFull(payload[0].value)}</p>
    </div>
  )
}

export default function CategoryDetailChart({ allExpenses, selectedCategory }: Props) {
  const { catColors } = useTheme()

  const filtered = selectedCategory
    ? allExpenses.filter((e) => e.category === selectedCategory)
    : allExpenses

  const agg: Record<string, number> = {}
  for (const e of filtered) {
    const key = e.detail || '기타'
    agg[key] = (agg[key] ?? 0) + e.amount
  }

  const data = Object.entries(agg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)

  const color = selectedCategory ? (catColors[selectedCategory] ?? '#6B8CAE') : '#6B8CAE'

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
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
          dataKey="name"
          width={90}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '…' : v}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} opacity={1 - i * 0.12} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/CategoryDetailChart.tsx
git commit -m "feat: add CategoryDetailChart TOP5 horizontal bar"
```

---

## Task 8: Update components/Dashboard.tsx — Overview layout

**Files:**
- Modify: `components/Dashboard.tsx`

Remove: header section, TrendChart, PaymentChart, `selectedMonth` drilldown state (move to monthly tab).
Add: CategoryDetailChart beside CategorySection.

- [ ] **Step 1: Replace Dashboard.tsx content**

```typescript
// components/Dashboard.tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData } from '@/lib/types'
import KpiCards from './KpiCards'
import ExpenseTable from './ExpenseTable'

const MonthlyChart = dynamic(() => import('./MonthlyChart'), { ssr: false, loading: () => <ChartPlaceholder h={300} /> })
const CategorySection = dynamic(() => import('./CategorySection'), { ssr: false, loading: () => <ChartPlaceholder h={260} /> })
const CategoryDetailChart = dynamic(() => import('./CategoryDetailChart'), { ssr: false, loading: () => <ChartPlaceholder h={220} /> })

function ChartPlaceholder({ h }: { h: number }) {
  return <div className="animate-pulse bg-slate-100 rounded-xl" style={{ height: h }} />
}

interface Props {
  data: DashboardData
}

export default function Dashboard({ data }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  function handleCategorySelect(cat: string) {
    setSelectedCategory((prev) => (prev === cat ? null : cat))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <KpiCards data={data} />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1">월별 지출 현황</h2>
        <MonthlyChart
          monthlyList={data.monthlyList}
          selectedMonth={null}
          onMonthSelect={() => {}}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">분류별 지출</h2>
          <CategorySection
            data={data}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">
            {selectedCategory ? `${selectedCategory} 내역 TOP 5` : '전체 내역 TOP 5'}
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            {selectedCategory ? '좌측 도넛 분류 클릭으로 필터' : '좌측 도넛 클릭시 분류별 TOP5'}
          </p>
          <CategoryDetailChart
            allExpenses={data.allExpenses}
            selectedCategory={selectedCategory}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">주요 지출 내역 TOP 20</h2>
        <ExpenseTable expenses={data.topExpenses} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify overview in browser**

http://localhost:3000 — should show: KPI cards, monthly bar chart, donut+TOP5 grid, TOP20 table.
Click donut → TOP5 bar updates.

- [ ] **Step 3: Commit**

```bash
git add components/Dashboard.tsx
git commit -m "feat: refactor overview dashboard — remove PaymentChart/TrendChart, add CategoryDetailChart"
```

---

## Task 9: components/CategoryDetailTable.tsx — Category×detail table

**Files:**
- Create: `components/CategoryDetailTable.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/CategoryDetailTable.tsx
'use client'

import { useState } from 'react'
import type { ExpenseItem } from '@/lib/types'
import { CATEGORIES, formatWonFull } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  allExpenses: ExpenseItem[]
}

export default function CategoryDetailTable({ allExpenses }: Props) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0])
  const { catColors } = useTheme()

  const filtered = allExpenses.filter((e) => e.category === activeCategory)
  const agg: Record<string, number> = {}
  for (const e of filtered) {
    const key = e.detail || '기타'
    agg[key] = (agg[key] ?? 0) + e.amount
  }
  const rows = Object.entries(agg)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  const total = rows.reduce((s, r) => s + r.amount, 0)
  const color = catColors[activeCategory] ?? '#6B8CAE'

  return (
    <div>
      {/* Category tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            style={activeCategory === cat ? { background: catColors[cat] } : {}}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">내역</th>
              <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">금액</th>
              <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">비율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const pct = total > 0 ? ((row.amount / total) * 100).toFixed(1) : '0'
              return (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 text-slate-700">{row.name}</td>
                  <td className="py-2 px-3 text-right font-medium text-slate-800">
                    {formatWonFull(row.amount)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-xs text-slate-400">{pct}%</span>
                    <div className="mt-0.5 h-1 w-16 ml-auto bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/CategoryDetailTable.tsx
git commit -m "feat: add CategoryDetailTable with category tab switching"
```

---

## Task 10: components/MonthlyClient.tsx + app/monthly/page.tsx

**Files:**
- Create: `components/MonthlyClient.tsx`
- Create: `app/monthly/page.tsx`

- [ ] **Step 1: Create MonthlyClient.tsx**

```typescript
// components/MonthlyClient.tsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData } from '@/lib/types'
import DrilldownPanel from './DrilldownPanel'
import CategoryDetailTable from './CategoryDetailTable'

const MonthlyChart = dynamic(() => import('./MonthlyChart'), { ssr: false, loading: () => <div className="animate-pulse bg-slate-100 rounded-xl h-[300px]" /> })

interface Props {
  data: DashboardData
}

export default function MonthlyClient({ data }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  function handleMonthSelect(month: number) {
    setSelectedMonth((prev) => (prev === month ? null : month))
  }

  const monthExpenses = selectedMonth
    ? data.allExpenses.filter((e) => e.month === selectedMonth)
    : []

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1">월별 지출 현황</h2>
        <p className="text-xs text-slate-400 mb-4">막대를 클릭하면 해당 월 상세 내역을 볼 수 있습니다</p>
        <MonthlyChart
          monthlyList={data.monthlyList}
          selectedMonth={selectedMonth}
          onMonthSelect={handleMonthSelect}
        />
      </div>

      {selectedMonth && (
        <DrilldownPanel
          monthData={data.monthlyList[selectedMonth - 1]}
          expenses={monthExpenses}
          onClose={() => setSelectedMonth(null)}
        />
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">분류별 내역 집계</h2>
        <CategoryDetailTable allExpenses={data.allExpenses} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create app/monthly/page.tsx**

```typescript
// app/monthly/page.tsx
import { fetchData } from '@/lib/fetchData'
import MonthlyClient from '@/components/MonthlyClient'

export const dynamic = 'force-dynamic'

export default async function MonthlyPage() {
  const data = await fetchData()
  return <MonthlyClient data={data} />
}
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:3000/monthly
Expected: Monthly bar chart + drilldown on click + category detail table with tabs

- [ ] **Step 4: Commit**

```bash
git add components/MonthlyClient.tsx app/monthly/page.tsx
git commit -m "feat: add monthly analysis tab with drilldown and category detail table"
```

---

## Task 11: app/compare/page.tsx — Year comparison placeholder

**Files:**
- Create: `app/compare/page.tsx`

- [ ] **Step 1: Create placeholder page**

```typescript
// app/compare/page.tsx
export default function ComparePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 text-center">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 inline-block">
        <div className="text-5xl mb-4">🗓</div>
        <h2 className="text-xl font-bold text-slate-700 mb-2">연도 비교</h2>
        <p className="text-slate-400 text-sm">다중 연도 데이터 업로드 기능과 함께 2단계에서 제공될 예정입니다.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000/compare — shows placeholder message.

- [ ] **Step 3: Commit**

```bash
git add app/compare/page.tsx
git commit -m "feat: add year comparison tab placeholder"
```

---

## Task 12: components/SearchClient.tsx + app/search/page.tsx

**Files:**
- Create: `components/SearchClient.tsx`
- Create: `app/search/page.tsx`

- [ ] **Step 1: Create SearchClient.tsx**

```typescript
// components/SearchClient.tsx
'use client'

import { useState, useMemo } from 'react'
import type { ExpenseItem } from '@/lib/types'
import { CATEGORIES, formatWonFull, CAT_BADGE } from '@/lib/utils'

interface Props {
  allExpenses: ExpenseItem[]
}

const MONTH_OPTIONS = ['전체', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

export default function SearchClient({ allExpenses }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('전체')
  const [month, setMonth] = useState('전체')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    // MONTH_OPTIONS index matches e.month: '1월' is at index 1 (Jan=1 in DB)
    const monthNum = month === '전체' ? null : MONTH_OPTIONS.indexOf(month)
    return allExpenses.filter((e) => {
      if (q && !e.detail.toLowerCase().includes(q)) return false
      if (category !== '전체' && e.category !== category) return false
      if (monthNum !== null && e.month !== monthNum) return false
      return true
    }).sort((a, b) => b.amount - a.amount)
  }, [allExpenses, query, category, month])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="내역 검색..."
            className="flex-1 min-w-48 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option>전체</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {MONTH_OPTIONS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <p className="text-sm text-slate-400 mb-4">검색 결과 {results.length}건</p>
        {results.length === 0 ? (
          <p className="text-center text-slate-400 py-12">검색 결과가 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">날짜</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">분류</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">내역</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">결제수단</th>
                  <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">금액</th>
                </tr>
              </thead>
              <tbody>
                {results.map((e, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap">{e.date}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>
                        {e.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700">{e.detail}</td>
                    <td className="py-2 px-3 text-slate-400">{e.method}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {formatWonFull(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create app/search/page.tsx**

```typescript
// app/search/page.tsx
import { fetchData } from '@/lib/fetchData'
import SearchClient from '@/components/SearchClient'

export const dynamic = 'force-dynamic'

export default async function SearchPage() {
  const data = await fetchData()
  return <SearchClient allExpenses={data.allExpenses} />
}
```

- [ ] **Step 3: Verify in browser**

Open http://localhost:3000/search
- Type a search term → results filter in real time
- Select a category → narrows results
- Select a month → narrows results
- Empty search with no results → shows "검색 결과가 없습니다"

- [ ] **Step 4: Commit**

```bash
git add components/SearchClient.tsx app/search/page.tsx
git commit -m "feat: add search tab with real-time filtering"
```

---

## Task 13: Cleanup

**Files:**
- Delete: `components/PaymentChart.tsx`
- Delete: `components/TrendChart.tsx`
- Delete: `app/palettes/page.tsx`

- [ ] **Step 1: Delete unused files**

```bash
rm components/PaymentChart.tsx
rm components/TrendChart.tsx
rm app/palettes/page.tsx
```

- [ ] **Step 2: Verify no build errors**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors or missing module errors

- [ ] **Step 3: Final browser check**

Verify all 4 tabs work:
- `/` — overview with KPI, monthly chart, donut+TOP5, TOP20 table
- `/monthly` — monthly chart with drilldown, category detail table
- `/compare` — placeholder message
- `/search` — search with real-time filtering
- ThemePicker → select different palettes → all charts update + header gradient changes + preference persists after reload

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove unused PaymentChart, TrendChart, and palettes page"
```
