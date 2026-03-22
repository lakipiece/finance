# Dashboard v2 Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비고(memo) 필드 추가, 차트→테이블 드릴스루, 월별/연도별 분류·내역 비교 차트, 검색 기본 연도 및 비고 컬럼 표시.

**Architecture:** DB 스키마 변경(memo 컬럼) → 타입/집계/파싱/API 순서로 기반 수정 → UI 컴포넌트 확장. Task 1~3이 기반이고 나머지 Tasks는 독립적으로 실행 가능. 새 라우트 없음.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (PostgreSQL), Recharts, `@supabase/ssr`

---

## File Map

| File | Action |
|------|--------|
| `lib/types.ts` | Modify — `ExpenseItem`, `RawExpenseRow`에 `memo: string` 추가 |
| `lib/aggregateExpenses.ts` | Modify — `toExpenseItem`에 memo 매핑 추가 |
| `lib/parseExcel.ts` | Modify — row[9] 읽어서 memo 파싱 |
| `lib/parseExcelBuffer.ts` | Modify — row[9] 읽어서 memo 파싱 |
| `app/api/insert/route.ts` | Modify — insert payload에 memo 추가 |
| `app/api/sheets/route.ts` | Modify — Google Sheets range A:J로 확장 + rows.push에 memo 추가 |
| `app/api/upload/route.ts` | No change — parseExcelBuffer에 위임하므로 Task 2만으로 충분 |
| `components/ExpenseTable.tsx` | Modify — 비고 컬럼 + `selectedDetail` prop |
| `components/CategoryDetailChart.tsx` | Modify — 바 클릭 핸들러 + `onDetailSelect` prop |
| `components/Dashboard.tsx` | Modify — `selectedDetail` 상태 + 헤더 텍스트 |
| `components/SearchClient.tsx` | Modify — 최신 연도 기본값 + 비고 컬럼 |
| `components/DrilldownPanel.tsx` | Modify — 비고 컬럼 + `allExpenses`/`monthlyList` props + 월별 추이 차트 |
| `components/MonthlyClient.tsx` | Modify — `allExpenses`, `monthlyList` DrilldownPanel에 전달 |
| `components/CompareCharts.tsx` | Modify — `detailSearch` 상태 + 검색 인풋 |

---

## Task 1: 타입 + 집계 레이어 — memo 필드 추가

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/aggregateExpenses.ts`

**Context:**
- `lib/types.ts`에 `ExpenseItem`(line 17)과 `RawExpenseRow`(line 45) 인터페이스가 있음
- `lib/aggregateExpenses.ts` line 50-52의 `toExpenseItem` 함수가 `RawExpenseRow` → `ExpenseItem` 변환. 현재 `memo` 필드 없음
- DB에는 Supabase SQL Editor에서 직접 컬럼 추가 필요: `ALTER TABLE expenses ADD COLUMN memo TEXT NOT NULL DEFAULT '';`

- [ ] **Step 1: Supabase에 memo 컬럼 추가**

Supabase 대시보드 SQL Editor에서 실행:
```sql
ALTER TABLE expenses ADD COLUMN memo TEXT NOT NULL DEFAULT '';
```

- [ ] **Step 2: `lib/types.ts` 수정 — ExpenseItem에 memo 추가**

`ExpenseItem` 인터페이스에서 `detail: string` 다음 줄에 추가:
```ts
export interface ExpenseItem {
  year: number
  date: string
  month: number
  category: string
  detail: string
  memo: string    // 추가
  method: string
  amount: number
}
```

`RawExpenseRow` 인터페이스에서 `detail: string` 다음 줄에 추가:
```ts
export interface RawExpenseRow {
  year: number
  month: number
  expense_date: string
  category: string
  detail: string
  memo: string    // 추가
  method: string
  amount: number
}
```

- [ ] **Step 3: `lib/aggregateExpenses.ts` 수정 — toExpenseItem에 memo 매핑**

line 51의 `toExpenseItem` 함수를 수정:
```ts
function toExpenseItem(e: RawExpenseRow): ExpenseItem {
  return {
    year: e.year,
    date: e.expense_date,
    month: e.month,
    category: e.category,
    detail: e.detail,
    memo: e.memo ?? '',
    method: e.method,
    amount: e.amount,
  }
}
```

- [ ] **Step 4: 타입 체크**

```bash
cd g:/Dev/test && npx tsc --noEmit 2>&1 | head -30
```

Expected: 에러 없음 (또는 이 Task와 무관한 기존 에러만)

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/aggregateExpenses.ts
git commit -m "feat: add memo field to ExpenseItem, RawExpenseRow, toExpenseItem"
```

---

## Task 2: Excel 파싱 — memo(비고) 컬럼 읽기

**Files:**
- Modify: `lib/parseExcel.ts`
- Modify: `lib/parseExcelBuffer.ts`

**Context:**
- 엑셀 구조: A=날짜(0), B=월ref(1), C-F=숨김(2-5), G=결제수단(6), H=금액(7), I=작성자(8), J=비고(9)
- `parseExcel.ts` line 53-56에서 row[4]=cat, row[5]=detail, row[6]=method, row[7]=amount 읽음
- `parseExcelBuffer.ts`도 동일한 패턴
- 두 파일 모두 `allExpenses.push({...})` 안에 `memo` 추가 필요

- [ ] **Step 1: `lib/parseExcel.ts` 수정**

기존 변수 선언 부분(row[4]~row[7] 읽는 곳) 다음에 memo 추가:
```ts
const memo   = row[9] != null ? String(row[9]).trim() : ''
```

`allExpenses.push(...)` 호출을 수정하여 `memo` 포함:
```ts
allExpenses.push({
  year: 2022,  // 기존 year 값 유지
  date: dateStr,
  month: monthNum,
  category: cat,
  detail,
  memo,          // 추가
  method,
  amount,
})
```

- [ ] **Step 2: `lib/parseExcelBuffer.ts` 수정**

동일하게 `row[9]`에서 memo 읽고 push에 포함:
```ts
const memo = row[9] != null ? String(row[9]).trim() : ''
```

`allExpenses.push(...)` 또는 `rows.push(...)` 안에 `memo` 추가.

- [ ] **Step 3: 타입 체크**

```bash
cd g:/Dev/test && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add lib/parseExcel.ts lib/parseExcelBuffer.ts
git commit -m "feat: parse memo field from Excel column J (row[9])"
```

---

## Task 3: API 라우트 — memo 추가

**Files:**
- Modify: `app/api/insert/route.ts`
- Modify: `app/api/sheets/route.ts`
- No change: `app/api/upload/route.ts` (parseExcelBuffer에 위임하므로 Task 2에서 자동 처리)

**Context:**
- `app/api/insert/route.ts` line 34-42의 `toInsert` 배열에 `memo` 누락됨. 이 라우트는 미리보기 후 실제 저장 시 호출됨 (Excel 업로드, Sheets 모두 이 라우트로 INSERT)
- `app/api/sheets/route.ts`는 Google Sheets에서 직접 rows를 파싱. range가 `A:H`라 J열(비고)을 읽지 못함. rows.push에도 memo 없음.
- `app/api/upload/route.ts`는 parseExcelBuffer를 호출하기만 하고 INSERT는 하지 않음 — Task 2로 충분

- [ ] **Step 1: `app/api/insert/route.ts` 수정**

`toInsert` 배열에서 `method: r.method || null` 다음에 `memo: r.memo ?? ''` 추가:
```ts
const toInsert = rows.map(r => ({
  year: r.year,
  month: r.month,
  expense_date: r.expense_date,
  category: r.category,
  detail: r.detail || null,
  method: r.method || null,
  memo: r.memo ?? '',    // 추가
  amount: r.amount,
}))
```

- [ ] **Step 2: `app/api/sheets/route.ts` — range 확장 + memo 파싱**

**2a.** line 68의 range를 `A:H` → `A:J`로 변경:
```ts
range: `${sheetName}!A:J`,
```

**2b.** line 79의 `if (!row || row.length < 5) continue` 조건은 유지 (J열 없어도 계속 처리하되 memo는 빈 문자열).

**2c.** line 85-88의 변수 선언 부분에 memo 추가:
```ts
const cat = (row[4] ?? '').trim()
const detail = (row[5] ?? '').trim()
const method = (row[6] ?? '').trim()
const rawAmt = row[7] ?? ''
// row[8] = 작성자 (사용 안 함)
const memo = (row[9] ?? '').trim()   // 추가 — J열 비고
```

**2d.** line 117-125의 `rows.push({...})`에 memo 추가:
```ts
rows.push({
  year: yearNum,
  month: monthNum,
  expense_date: expenseDate,
  category: cat,
  detail,
  memo,          // 추가
  method,
  amount: Math.round(amount),
})
```

- [ ] **Step 3: 타입 체크**

```bash
cd g:/Dev/test && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add app/api/insert/route.ts app/api/sheets/route.ts
git commit -m "feat: include memo in insert payload and expand Sheets range to A:J"
```

---

## Task 4: ExpenseTable — 비고 컬럼 + selectedDetail 필터

**Files:**
- Modify: `components/ExpenseTable.tsx`

**Context:**
- 현재 Props: `expenses: ExpenseItem[]`, `selectedCategory: string | null`
- 현재 컬럼: #, 날짜, 분류, 내역, 결제수단, 금액
- 비고 컬럼을 내역과 결제수단 사이에 추가
- `selectedDetail: string | null` prop 추가 → `filtered`에서 `e.detail === selectedDetail` 추가 필터

- [ ] **Step 1: Props 인터페이스 업데이트**

```ts
interface Props {
  expenses: ExpenseItem[]
  selectedCategory: string | null
  selectedDetail: string | null   // 추가
}
```

함수 시그니처 업데이트:
```ts
export default function ExpenseTable({ expenses, selectedCategory, selectedDetail }: Props) {
```

- [ ] **Step 2: filtered 로직 업데이트 + page 리셋**

기존:
```ts
const filtered = selectedCategory
  ? expenses.filter(e => e.category === selectedCategory)
  : expenses
```

변경 — category+detail 동시 필터, selectedDetail 변경 시 page 리셋:
```ts
const filtered = expenses.filter(e => {
  if (selectedCategory && e.category !== selectedCategory) return false
  if (selectedDetail && e.detail !== selectedDetail) return false
  return true
})

// selectedDetail이 바뀌면 page를 1로 리셋
const prevDetailRef = useRef(selectedDetail)
if (prevDetailRef.current !== selectedDetail) {
  prevDetailRef.current = selectedDetail
  // setPage는 render 중 호출 불가 — useEffect 사용
}
```

`useState` import 아래에 `useRef` import 추가 필요. 그리고 별도 useEffect로 리셋:
```ts
import { useState, useRef, useEffect } from 'react'
```

컴포넌트 본문 `page` 상태 아래에:
```ts
useEffect(() => { setPage(1) }, [selectedDetail, selectedCategory])
```

- [ ] **Step 3: 테이블 헤더에 비고 컬럼 추가**

결제수단 `<th>` 바로 앞에:
```tsx
<th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">비고</th>
```

- [ ] **Step 4: 테이블 바디에 비고 셀 추가**

결제수단 `<td>` 바로 앞에:
```tsx
<td className="py-2.5 px-3 text-slate-400 text-xs max-w-[200px]">
  {e.memo ? (
    <span
      className="block truncate"
      title={e.memo.length > 20 ? e.memo : undefined}
    >
      {e.memo}
    </span>
  ) : (
    <span className="text-slate-200">—</span>
  )}
</td>
```

- [ ] **Step 5: 타입 체크**

```bash
cd g:/Dev/test && npx tsc --noEmit 2>&1 | head -30
```

Note: Dashboard.tsx가 아직 `selectedDetail` prop을 전달하지 않아서 TypeScript 에러가 나올 수 있음. 임시로 `selectedDetail={null}` 하드코딩하거나 Task 5를 바로 이어서 진행.

- [ ] **Step 6: Commit**

```bash
git add components/ExpenseTable.tsx
git commit -m "feat: add memo column and selectedDetail filter to ExpenseTable"
```

---

## Task 5: CategoryDetailChart + Dashboard — 차트 클릭 드릴스루

**Files:**
- Modify: `components/CategoryDetailChart.tsx`
- Modify: `components/Dashboard.tsx`

**Context:**
- `CategoryDetailChart.tsx`: 현재 Bar의 Cell에 클릭 핸들러 없음. Props에 `onDetailSelect` 없음
- `Dashboard.tsx`: `handleCategorySelect` 함수 있음(line 26). `selectedDetail` 상태 없음. `ExpenseTable`에 `selectedDetail` 전달 안 함
- 선택된 바는 선명하게, 나머지는 흐리게 표시
- 분류가 바뀌면 selectedDetail 초기화

- [ ] **Step 1: `components/CategoryDetailChart.tsx` — Props 업데이트**

```ts
interface Props {
  allExpenses: ExpenseItem[]
  selectedCategory: string | null
  selectedDetail: string | null         // 추가
  onDetailSelect: (detail: string | null) => void  // 추가
}
```

함수 시그니처:
```ts
export default function CategoryDetailChart({ allExpenses, selectedCategory, selectedDetail, onDetailSelect }: Props) {
```

- [ ] **Step 2: `components/CategoryDetailChart.tsx` — Cell에 클릭 핸들러 추가**

기존 Bar 섹션:
```tsx
<Bar dataKey="value" radius={[0, 4, 4, 0]}>
  {data.map((_, i) => (
    <Cell key={i} fill={color} opacity={1 - i * 0.12} />
  ))}
</Bar>
```

변경 — 클릭 토글 + 선택 시 opacity 강조:
```tsx
<Bar dataKey="value" radius={[0, 4, 4, 0]} style={{ cursor: 'pointer' }}>
  {data.map((entry, i) => {
    const isSelected = selectedDetail === entry.name
    const isOtherSelected = selectedDetail !== null && !isSelected
    return (
      <Cell
        key={i}
        fill={color}
        opacity={isOtherSelected ? 0.4 : (isSelected ? 1 : 1 - i * 0.12)}
        onClick={() => onDetailSelect(isSelected ? null : entry.name)}
        style={{ cursor: 'pointer' }}
      />
    )
  })}
</Bar>
```

- [ ] **Step 3: `components/Dashboard.tsx` — selectedDetail 상태 추가**

`useState` import는 이미 있음. `selectedCategory` 상태 선언 아래에:
```ts
const [selectedDetail, setSelectedDetail] = useState<string | null>(null)
```

`handleCategorySelect` 함수 수정 — 분류 변경 시 detail 초기화:
```ts
function handleCategorySelect(cat: string) {
  setSelectedCategory((prev) => (prev === cat ? null : cat))
  setSelectedDetail(null)
}
```

- [ ] **Step 4: `components/Dashboard.tsx` — CategoryDetailChart에 props 전달**

```tsx
<CategoryDetailChart
  allExpenses={data.allExpenses}
  selectedCategory={selectedCategory}
  selectedDetail={selectedDetail}
  onDetailSelect={setSelectedDetail}
/>
```

- [ ] **Step 5: `components/Dashboard.tsx` — ExpenseTable에 selectedDetail 전달 + 헤더 업데이트**

ExpenseTable 섹션:
```tsx
<div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
  <h2 className="text-base font-semibold text-slate-700 mb-4">
    {selectedDetail
      ? `${selectedCategory} > ${selectedDetail} 지출 내역`
      : selectedCategory
      ? `${selectedCategory} 주요 지출 내역`
      : '주요 지출 내역'}
  </h2>
  <ExpenseTable
    expenses={sortedExpenses}
    selectedCategory={selectedCategory}
    selectedDetail={selectedDetail}
  />
</div>
```

- [ ] **Step 6: 타입 체크**

```bash
cd g:/Dev/test && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: Commit**

```bash
git add components/CategoryDetailChart.tsx components/Dashboard.tsx
git commit -m "feat: chart bar click drills through to expense table filter"
```

---

## Task 6: SearchClient — 최신 연도 기본값 + 비고 컬럼

**Files:**
- Modify: `components/SearchClient.tsx`

**Context:**
- 현재 `year` 상태 초기값 `'전체'` (line 17)
- `availableYears`는 `useMemo`로 이미 계산됨 (line 19-22, 오름차순 정렬)
- 최신 연도 = `availableYears[availableYears.length - 1]`
- `useRef` 플래그로 사용자가 변경한 경우 덮어쓰지 않음
- 결과 테이블에 비고 컬럼 추가 (내역과 결제수단 사이)

- [ ] **Step 1: useRef import 추가**

파일 상단 import에 `useRef` 추가:
```ts
import { useState, useMemo, useRef, useEffect } from 'react'
```

- [ ] **Step 2: 최신 연도 자동 설정 로직 추가**

`year` state 선언 아래:
```ts
const initializedRef = useRef(false)

useEffect(() => {
  if (!initializedRef.current && availableYears.length > 0) {
    initializedRef.current = true
    setYear(String(availableYears[availableYears.length - 1]))
  }
}, [availableYears])
```

- [ ] **Step 3: 결과 테이블 헤더에 비고 컬럼 추가**

현재 테이블 헤더(line 85-91):
```tsx
<th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">날짜</th>
<th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">분류</th>
<th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">내역</th>
<th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">결제수단</th>
<th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">금액</th>
```

결제수단 앞에 추가:
```tsx
<th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">비고</th>
```

- [ ] **Step 4: 결과 테이블 바디에 비고 셀 추가**

결제수단 `<td>` 바로 앞에:
```tsx
<td className="py-2 px-3 text-slate-400 text-xs max-w-[200px]">
  {e.memo ? (
    <span
      className="block truncate"
      title={e.memo.length > 20 ? e.memo : undefined}
    >
      {e.memo}
    </span>
  ) : (
    <span className="text-slate-200">—</span>
  )}
</td>
```

- [ ] **Step 5: 타입 체크**

```bash
cd g:/Dev/test && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add components/SearchClient.tsx
git commit -m "feat: search defaults to latest year and shows memo column"
```

---

## Task 7: DrilldownPanel — 비고 컬럼 + 월별 추이 차트

**Files:**
- Modify: `components/DrilldownPanel.tsx`
- Modify: `components/MonthlyClient.tsx`

**Context:**
- `DrilldownPanel.tsx`: 현재 Props는 `monthData`, `expenses`, `onClose`. 지출 테이블에 비고 컬럼 없음
- `MonthlyClient.tsx`: DrilldownPanel에 `monthData`, `expenses`, `onClose`만 전달 중. `allExpenses`와 `monthlyList`를 추가로 전달해야 함
- 월별 추이 차트: Recharts `BarChart` 사용. 분류 선택 시 12개월 bar 표시. 세부 내역 선택 시 해당 내역의 월별 합계로 전환.
- `MonthlyData` 타입: `{ month: string, 고정비: number, 대출상환: number, 변동비: number, 여행공연비: number, total: number }`

### Sub-task 7a: MonthlyClient — props 전달

- [ ] **Step 1: `components/MonthlyClient.tsx` 수정**

DrilldownPanel 컴포넌트 호출 부분을 찾아서 두 props 추가:
```tsx
<DrilldownPanel
  key={selectedMonth ?? 'all'}
  monthData={displayMonthData}
  expenses={displayExpenses}
  allExpenses={data.allExpenses}       // 추가 — 항상 전체 연도
  monthlyList={data.monthlyList}       // 추가 — 12개월 데이터
  onClose={selectedMonth !== null ? () => setSelectedMonth(null) : null}
/>
```

### Sub-task 7b: DrilldownPanel — Props + 비고 컬럼

- [ ] **Step 2: `components/DrilldownPanel.tsx` — Recharts import 추가**

파일 상단에 Recharts import 한 줄만 추가 (기존 `MonthlyData`, `ExpenseItem` type import는 이미 있으므로 건드리지 말 것):
```ts
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
```

- [ ] **Step 3: Props 인터페이스 업데이트**

```ts
interface Props {
  monthData: MonthlyData
  expenses: ExpenseItem[]
  allExpenses: ExpenseItem[]    // 추가 — 항상 전체 연도
  monthlyList: MonthlyData[]    // 추가 — 12개월
  onClose: (() => void) | null
}
```

함수 시그니처:
```ts
export default function DrilldownPanel({ monthData, expenses, allExpenses, monthlyList, onClose }: Props) {
```

- [ ] **Step 4: selectedTrendDetail 상태 추가**

기존 `detailSearch` 상태 아래:
```ts
const [selectedTrendDetail, setSelectedTrendDetail] = useState<string | null>(null)
```

분류 카드 클릭 핸들러에서 `selectedTrendDetail` 초기화 추가:
```ts
onClick={() => {
  setSelectedCat(prev => prev === cat ? null : cat)
  setDetailSearch('')
  setSelectedTrendDetail(null)   // 추가
}}
```

- [ ] **Step 5: 월별 추이 차트 데이터 계산 추가**

`detailSummary` 계산 아래에 추가:
```ts
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
```

- [ ] **Step 6: 월별 추이 차트 JSX 추가**

세부 내역 목록(`detailSummary`) 렌더 부분 **위에** 추가:
```tsx
{/* Monthly trend chart — shown when category is selected */}
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
```

- [ ] **Step 7: 세부 내역 행에 클릭 핸들러 추가 + 선택 강조**

`detailSummary.map(([detail, amount]) => ...)` 안의 `<div key={detail}>` 수정:
```tsx
<div
  key={detail}
  className={`flex items-center gap-3 cursor-pointer rounded-lg px-2 py-0.5 transition-colors ${
    selectedTrendDetail === detail ? 'bg-slate-100' : 'hover:bg-slate-50'
  }`}
  onClick={() => setSelectedTrendDetail(prev => prev === detail ? null : detail)}
>
```

내역 이름 텍스트에 선택 시 강조 추가:
```tsx
<span
  className={`text-slate-600 truncate max-w-[160px] ${selectedTrendDetail === detail ? 'font-semibold' : ''}`}
  title={isLong ? detail : undefined}
>
```

- [ ] **Step 8: 지출 내역 테이블에 비고 컬럼 추가**

테이블 헤더에서 결제수단 `<th>` 앞에:
```tsx
<th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">비고</th>
```

테이블 바디에서 결제수단 `<td>` 앞에:
```tsx
<td className="py-2 px-3 text-slate-400 text-xs max-w-[180px]">
  {e.memo ? (
    <span
      className="block truncate"
      title={e.memo.length > 20 ? e.memo : undefined}
    >
      {e.memo}
    </span>
  ) : (
    <span className="text-slate-200">—</span>
  )}
</td>
```

- [ ] **Step 9: 타입 체크**

```bash
cd g:/Dev/test && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 10: Commit**

```bash
git add components/DrilldownPanel.tsx components/MonthlyClient.tsx
git commit -m "feat: monthly trend chart and memo column in DrilldownPanel"
```

---

## Task 8: CompareCharts — 내역 검색 필터

**Files:**
- Modify: `components/CompareCharts.tsx`

**Context:**
- 현재 `subDetailData`가 분류 선택 시 Top 20 항목을 보여주는 수직 BarChart 렌더
- `detailSearch` 상태를 추가해서 검색어로 필터링
- `selectedCategory` prop이 변경되면 `detailSearch` 초기화 (`useEffect`)
- 검색 인풋은 서브 바차트 섹션 헤더 아래에 위치

- [ ] **Step 1: useEffect import 추가**

파일 상단:
```ts
import { useState, useEffect } from 'react'
```

- [ ] **Step 2: detailSearch 상태 추가**

컴포넌트 본문 맨 위:
```ts
const [detailSearch, setDetailSearch] = useState('')

useEffect(() => {
  setDetailSearch('')
}, [selectedCategory])
```

- [ ] **Step 3: subDetailData 계산에 detailSearch 필터 적용**

기존 `.slice(0, 20)` 전에 필터 추가:
```ts
.filter(item =>
  detailSearch === '' ||
  item.detail.toLowerCase().includes(detailSearch.toLowerCase())
)
.slice(0, 20)
```

즉, `return Array.from(allDetails).map(...)` 체인을 수정:
```ts
return Array.from(allDetails)
  .map(detail => {
    const entry: Record<string, any> = { detail }
    for (const year of readyYears) {
      entry[year] = yearData[year].allExpenses
        .filter(e => e.category === selectedCategory && e.detail === detail)
        .reduce((s, e) => s + e.amount, 0)
    }
    return entry
  })
  .sort((a, b) => {
    const sumA = readyYears.reduce((s, y) => s + (a[y] || 0), 0)
    const sumB = readyYears.reduce((s, y) => s + (b[y] || 0), 0)
    return sumB - sumA
  })
  .filter(item =>
    detailSearch === '' ||
    item.detail.toLowerCase().includes(detailSearch.toLowerCase())
  )
  .slice(0, 20)
```

- [ ] **Step 4: 검색 인풋 JSX 추가**

서브 바차트 JSX에서 `<p className="text-xs ...">세부 항목별...</p>` 아래, `<ResponsiveContainer>` 위에 추가:
```tsx
<div className="mb-3">
  <input
    type="text"
    value={detailSearch}
    onChange={e => setDetailSearch(e.target.value)}
    placeholder="내역 검색 (예: 스타벅스)..."
    className="w-full max-w-sm text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
  />
</div>
```

- [ ] **Step 5: 타입 체크**

```bash
cd g:/Dev/test && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add components/CompareCharts.tsx
git commit -m "feat: detail search filter in year comparison chart"
```

---

## Final Checklist

- [ ] Supabase `expenses.memo` 컬럼이 추가됐는지 확인
- [ ] 관리자 페이지에서 엑셀 재업로드 → 비고 데이터 채워졌는지 확인
- [ ] 대시보드 주요 지출 내역 테이블에 비고 컬럼 표시 확인
- [ ] 분류 선택 → Top10 바 클릭 → 해당 내역으로 테이블 필터 확인
- [ ] 월별 탭 → 분류 카드 클릭 → 월별 추이 차트 표시 확인
- [ ] 월별 탭 → 세부 내역 클릭 → 해당 항목 월별 추이로 전환 확인
- [ ] 연도비교 탭 → 분류 선택 → 검색어 입력 → 바차트 필터 확인
- [ ] 검색 탭 → 초기 로드 시 최신 연도 선택됨 확인
- [ ] 검색 탭 결과 테이블에 비고 컬럼 표시 확인
- [ ] Vercel 빌드 체크 후 push: `npm run build` 또는 `npx tsc --noEmit`

---

## Commit Summary

| Task | Commit |
|------|--------|
| 1 | `feat: add memo field to ExpenseItem, RawExpenseRow, toExpenseItem` |
| 2 | `feat: parse memo field from Excel column J (row[9])` |
| 3 | `feat: include memo in insert payload and expand Sheets range to A:J` |
| 4 | `feat: add memo column and selectedDetail filter to ExpenseTable` |
| 5 | `feat: chart bar click drills through to expense table filter` |
| 6 | `feat: search defaults to latest year and shows memo column` |
| 7 | `feat: monthly trend chart and memo column in DrilldownPanel` |
| 8 | `feat: detail search filter in year comparison chart` |
