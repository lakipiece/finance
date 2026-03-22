# Dashboard v2 Phase 3 Design

## Goal

비고(memo) 필드 추가, 차트→테이블 드릴스루, 월별/연도별 분류·내역 비교, 검색 개선.

## Architecture

Next.js 14 App Router 기반. DB 스키마 변경(memo 컬럼 추가) → 타입/파싱/API/집계 수정 → UI 컴포넌트 확장. 새 라우트 없음. 모든 변경은 기존 파일 수정.

## Tech Stack

Next.js 14, TypeScript, Tailwind CSS, Supabase (PostgreSQL), Recharts, `@supabase/ssr`

---

## Part 1: 비고(memo) 필드 추가

### 데이터 흐름

엑셀 J열(row[9]) → `parseExcel` / `parseExcelBuffer` → `ExpenseItem.memo` → Supabase `expenses.memo` → `aggregateExpenses` → UI 표시

### DB 변경

Supabase `expenses` 테이블에 컬럼 추가:
```sql
ALTER TABLE expenses ADD COLUMN memo TEXT NOT NULL DEFAULT '';
```

### 타입 변경 (`lib/types.ts`)

`ExpenseItem`에 `memo: string` 추가:
```ts
export interface ExpenseItem {
  year: number
  date: string
  month: number
  category: string
  detail: string
  memo: string   // 추가
  method: string
  amount: number
}
```

`RawExpenseRow`에도 `memo: string` 추가:
```ts
export interface RawExpenseRow {
  // ...기존 필드...
  memo: string   // 추가
}
```

### 파싱 변경

`lib/parseExcel.ts` 및 `lib/parseExcelBuffer.ts`:
- `row[9]`를 `memo`로 읽음: `const memo = row[9] != null ? String(row[9]).trim() : ''`
- `allExpenses.push(...)` 에 `memo` 포함

### 집계 변경 (`lib/aggregateExpenses.ts`)

`toExpenseItem` 함수에서 `memo: e.memo ?? ''` 추가:
```ts
return {
  year: e.year, date: e.expense_date, month: e.month,
  category: e.category, detail: e.detail, memo: e.memo ?? '',
  method: e.method, amount: e.amount
}
```

### API 변경 (`app/api/insert/route.ts`, `app/api/sheets/route.ts`, `app/api/upload/route.ts`)

insert payload에 `memo: r.memo ?? ''` 추가.

`lib/fetchData.ts` / `lib/fetchYearData.ts`:
- `select('*')` 사용 중이므로 변경 불필요. `aggregateExpenses`가 memo를 매핑.

### UI 변경 — 비고 컬럼 추가

**`components/ExpenseTable.tsx`**: 내역(detail)과 결제수단(method) 사이에 비고(memo) 컬럼 추가. 긴 텍스트는 `truncate` + `title` tooltip.

**`components/SearchClient.tsx`**: 동일하게 비고 컬럼 추가.

**`components/DrilldownPanel.tsx`**: 지출 내역 테이블에 비고 컬럼 추가.

### 데이터 재업로드

비고 데이터는 관리자 페이지에서 엑셀을 다시 업로드하면 자동 교체됨 (delete-then-insert 방식).

---

## Part 2: 차트 → 테이블 드릴스루

### 흐름

대시보드 → 분류 선택(예: 고정비) → CategoryDetailChart 바 클릭(예: "식비") → ExpenseTable이 고정비+식비로 필터됨

### 컴포넌트 변경

**`components/CategoryDetailChart.tsx`**:
- Props에 `onDetailSelect: (detail: string | null) => void` 추가
- 각 Bar의 `Cell`에 `cursor="pointer"` + `onClick` 핸들러 추가
- 같은 바를 다시 클릭하면 선택 해제 (토글)
- 선택된 바는 opacity 1, 나머지는 0.4로 표시

**`components/Dashboard.tsx`**:
- `selectedDetail: string | null` 상태 추가
- `selectedDetail` 초기화는 `handleCategorySelect` 함수 내에서 수행: 분류 변경/해제 시 `setSelectedDetail(null)` 호출
- `CategoryDetailChart`에 `onDetailSelect` 전달
- `ExpenseTable`에 `selectedDetail` 전달
- 섹션 헤더: `selectedDetail ? \`${selectedCategory} > ${selectedDetail} 지출 내역\` : selectedCategory ? \`${selectedCategory} 주요 지출 내역\` : '주요 지출 내역'`

**`components/ExpenseTable.tsx`**:
- Props에 `selectedDetail: string | null` 추가
- `filtered`: category 필터 후 추가로 `selectedDetail`로 `e.detail === selectedDetail` 필터

---

## Part 3: 월별 분류/내역별 비교 차트

### 흐름

월별 탭 → 분류 카드 클릭(예: 변동비) → DrilldownPanel 안에 "변동비 월별 추이" 막대차트 표시 → 세부 내역 항목 클릭(예: "스타벅스") → 차트가 "스타벅스 월별 추이"로 전환

### Props 설계

`DrilldownPanel`에 두 개의 별도 expenses props:
- `expenses: ExpenseItem[]` — 기존 그대로. 월 선택 시 해당 월만, 누적 시 전체. **지출 내역 테이블**에 사용.
- `allExpenses: ExpenseItem[]` — 항상 전체 연도 데이터. **월별 추이 차트** 계산에 사용. 월 선택 여부와 무관.

이렇게 분리하면 월이 선택된 상태에서도 12개월 전체 추이를 올바르게 표시할 수 있음.

### 컴포넌트 변경

**`components/DrilldownPanel.tsx`**:
- Props에 `monthlyList: MonthlyData[]` 추가 (12개 월별 데이터)
- Props에 `allExpenses: ExpenseItem[]` 추가 (항상 전체 연도)
- `selectedTrendDetail: string | null` 상태 추가
- 분류 카드 클릭 시 `selectedTrendDetail` 초기화 (기존 `setDetailSearch('')`와 함께)
- 분류가 선택된 경우, 세부 내역 목록 **위에** Recharts `BarChart` 추가:
  - `selectedTrendDetail === null`: `monthlyList`에서 해당 분류(cat)의 월별 합계 12개 표시. `MonthlyData`는 `고정비`, `변동비`, `대출상환`, `여행공연비`, `total` 등 분류명을 key로 가지므로 `monthlyList[i][cat as keyof MonthlyData] as number`로 접근 (`lib/types.ts` 참조).
  - `selectedTrendDetail !== null`: `allExpenses`에서 `category === selectedCat && detail === selectedTrendDetail`로 필터 후 month별 합계 계산
  - 차트 제목: `"${selectedTrendDetail ?? selectedCat} 월별 추이"`
  - 차트 높이: 160px, XAxis 레이블은 기존 `MonthlyData.month`의 한국어 형식(`1월`, `2월` …)과 일치시키기 위해 `['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']` 사용, YAxis는 숨김, Tooltip은 `formatWonFull`
  - `detailSearch`로 인해 선택된 내역 행이 목록에서 사라진 경우 `selectedTrendDetail`은 유지하되 차트 제목으로만 표시 (행 강조는 사라짐) — 별도 초기화 로직 불필요
- 세부 내역 행에 클릭 핸들러 추가: `setSelectedTrendDetail(prev => prev === detail ? null : detail)`
- 선택된 내역 행은 시각적으로 강조 (배경색 + 볼드)

**참고**: 세부 내역 목록의 퍼센트 막대는 기존 그대로 `monthData[selectedCat]` 기준(월 범위 또는 누적 범위)으로 표시. 월별 추이 차트는 항상 연간 전체 기준으로 표시. 두 섹션은 각자 독립적인 스코프를 가짐.

**`components/MonthlyClient.tsx`**:
- `DrilldownPanel`에 `monthlyList={data.monthlyList}` 추가
- `DrilldownPanel`에 `allExpenses={data.allExpenses}` 추가

---

## Part 4: 연도비교 분류/내역 검색 필터

### 흐름

연도비교 탭 → 분류 선택(예: 변동비) → 서브 바차트 위에 검색 인풋 표시 → "스타벅스" 입력 → 바차트가 "스타벅스"만 연도별로 필터해서 표시

### 컴포넌트 변경

**`components/CompareCharts.tsx`**:
- `detailSearch: string` 내부 상태 추가
- `selectedCategory` prop 변경 시 `detailSearch` 초기화:
  ```ts
  useEffect(() => { setDetailSearch('') }, [selectedCategory])
  ```
- 분류가 선택된 경우, 서브 바차트 위에 검색 인풋 렌더:
  ```
  <input placeholder="내역 검색..." value={detailSearch} onChange={e => setDetailSearch(e.target.value)} />
  ```
- 서브 바차트 데이터 계산 시 `detailSearch`로 필터:
  - 빈 문자열이면 기존 Top 20 전체 표시
  - 입력값 포함하는 항목만 표시 (`.toLowerCase().includes(detailSearch.toLowerCase())`)

---

## Part 5: 검색 개선

### 변경

**`components/SearchClient.tsx`**:
- `year` 초기 상태는 `'전체'`로 유지하되, `availableYears` 로드 후 최신 연도로 한 번만 초기화:
  ```ts
  const initializedRef = useRef(false)
  useEffect(() => {
    if (!initializedRef.current && availableYears.length > 0) {
      initializedRef.current = true
      setYear(String(availableYears[availableYears.length - 1]))
    }
  }, [availableYears])
  ```
  `useRef` 플래그로 사용자가 이미 연도를 변경한 경우 덮어쓰지 않음.
- 결과 테이블에 비고(memo) 컬럼 추가 (Part 1과 연동)

---

## File Map

| File | Action | 이유 |
|------|--------|------|
| `lib/types.ts` | Modify | `ExpenseItem`, `RawExpenseRow`에 `memo: string` 추가 |
| `lib/parseExcel.ts` | Modify | row[9] 읽어서 memo 파싱 |
| `lib/parseExcelBuffer.ts` | Modify | row[9] 읽어서 memo 파싱 |
| `lib/aggregateExpenses.ts` | Modify | `toExpenseItem`에서 `memo` 필드 매핑 |
| `app/api/insert/route.ts` | Modify | insert payload에 memo 추가 |
| `app/api/sheets/route.ts` | Modify | insert payload에 memo 추가 |
| `app/api/upload/route.ts` | Modify | insert payload에 memo 추가 |
| `components/ExpenseTable.tsx` | Modify | `selectedDetail` prop + 비고 컬럼 |
| `components/SearchClient.tsx` | Modify | 최신 연도 기본값 + 비고 컬럼 |
| `components/DrilldownPanel.tsx` | Modify | `monthlyList`/`allExpenses` props + 월별 추이 차트 + 비고 컬럼 |
| `components/CategoryDetailChart.tsx` | Modify | `onDetailSelect` 콜백 + 클릭 핸들러 |
| `components/Dashboard.tsx` | Modify | `selectedDetail` 상태 + 헤더 텍스트 |
| `components/MonthlyClient.tsx` | Modify | `monthlyList`, `allExpenses` DrilldownPanel에 전달 |
| `components/CompareCharts.tsx` | Modify | `detailSearch` 상태 + 검색 인풋 |
