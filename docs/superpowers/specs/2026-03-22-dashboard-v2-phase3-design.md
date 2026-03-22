# Dashboard v2 Phase 3 Design

## Goal

비고(memo) 필드 추가, 차트→테이블 드릴스루, 월별/연도별 분류·내역 비교, 검색 개선.

## Architecture

Next.js 14 App Router 기반. DB 스키마 변경(memo 컬럼 추가) → 타입/파싱/API 수정 → UI 컴포넌트 확장. 새 라우트 없음. 모든 변경은 기존 파일 수정.

## Tech Stack

Next.js 14, TypeScript, Tailwind CSS, Supabase (PostgreSQL), Recharts, `@supabase/ssr`

---

## Part 1: 비고(memo) 필드 추가

### 데이터 흐름

엑셀 J열(row[9]) → `parseExcel` / `parseExcelBuffer` → `ExpenseItem.memo` → Supabase `expenses.memo` → UI 표시

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

### 파싱 변경

`lib/parseExcel.ts` 및 `lib/parseExcelBuffer.ts`:
- `row[9]`를 `memo`로 읽음 (`row[9] != null ? String(row[9]).trim() : ''`)
- `allExpenses.push(...)` 에 `memo` 포함

### API 변경 (`app/api/insert/route.ts`, `app/api/sheets/route.ts`, `app/api/upload/route.ts`)

insert payload에 `memo: r.memo ?? ''` 추가.

`lib/fetchData.ts` / `lib/fetchYearData.ts`:
- Supabase select에서 자동으로 memo 포함됨 (`select('*')` 사용 중이므로 변경 불필요)

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
- `selectedCategory` 변경 시 `selectedDetail` 초기화
- `CategoryDetailChart`에 `onDetailSelect` 전달
- `ExpenseTable`에 `selectedDetail` 전달
- 섹션 헤더: `selectedDetail ? \`${selectedCategory} > ${selectedDetail} 지출 내역\` : selectedCategory ? \`${selectedCategory} 주요 지출 내역\` : '주요 지출 내역'`

**`components/ExpenseTable.tsx`**:
- Props에 `selectedDetail: string | null` 추가
- `filtered`: category 필터 + detail 필터 동시 적용

---

## Part 3: 월별 분류/내역별 비교 차트

### 흐름

월별 탭 → 분류 카드 클릭(예: 변동비) → DrilldownPanel 안에 "변동비 월별 추이" 막대차트 표시 → 세부 내역 항목 클릭(예: "스타벅스") → 차트가 "스타벅스 월별 추이"로 전환

### 컴포넌트 변경

**`components/DrilldownPanel.tsx`**:
- Props에 `monthlyList: MonthlyData[]` 추가 (12개 월별 데이터)
- `selectedTrendDetail: string | null` 상태 추가
- 분류 카드 클릭 시 `selectedTrendDetail` 초기화
- 분류가 선택된 경우, 세부 내역 목록 위에 Recharts `BarChart` 추가:
  - 분류가 선택되고 `selectedTrendDetail === null`: `monthlyList`에서 해당 분류(category)의 월별 합계 표시
  - `selectedTrendDetail`이 있으면: `allExpenses`에서 해당 내역+분류로 필터 후 month별 합계 계산해서 표시
  - 차트 제목: `"${selectedTrendDetail ?? selectedCat} 월별 추이"`
- 세부 내역 행에 클릭 핸들러 추가: `setSelectedTrendDetail(prev => prev === detail ? null : detail)`
- 선택된 내역 행은 시각적으로 강조 (배경색)

**`components/MonthlyClient.tsx`**:
- `DrilldownPanel`에 `monthlyList={data.monthlyList}` prop 추가

---

## Part 4: 연도비교 분류/내역 검색 필터

### 흐름

연도비교 탭 → 분류 선택(예: 변동비) → 서브 바차트 위에 검색 인풋 표시 → "스타벅스" 입력 → 바차트가 "스타벅스"만 연도별로 필터해서 표시

### 컴포넌트 변경

**`components/CompareCharts.tsx`**:
- `detailSearch: string` 상태 추가 (내부 상태, props 불필요)
- `selectedCategory`가 null → null로 초기화 (`useEffect` 또는 `useMemo`)
- 분류가 선택된 경우, 서브 바차트 위에 검색 인풋 렌더:
  ```
  <input placeholder="내역 검색..." value={detailSearch} onChange={...} />
  ```
- 서브 바차트 데이터 계산 시 `detailSearch`로 필터:
  - 빈 문자열이면 기존 Top 20 표시
  - 입력값 포함하는 항목만 표시 (대소문자 무시)

---

## Part 5: 검색 개선

### 변경

**`components/SearchClient.tsx`**:
- `year` 초기 상태: `'전체'` → `availableYears`가 로드된 후 최신 연도로 자동 설정
  - `availableYears`는 이미 `useMemo`로 계산됨
  - `useEffect([availableYears])` 로 초기값 설정: `setYear(String(availableYears[availableYears.length - 1]))`
- 결과 테이블에 비고(memo) 컬럼 추가 (Part 1과 연동)

---

## File Map

| File | Action | 이유 |
|------|--------|------|
| `lib/types.ts` | Modify | `ExpenseItem`에 `memo: string` 추가 |
| `lib/parseExcel.ts` | Modify | row[9] 읽어서 memo 파싱 |
| `lib/parseExcelBuffer.ts` | Modify | row[9] 읽어서 memo 파싱 |
| `app/api/insert/route.ts` | Modify | insert payload에 memo 추가 |
| `app/api/sheets/route.ts` | Modify | insert payload에 memo 추가 |
| `app/api/upload/route.ts` | Modify | insert payload에 memo 추가 |
| `components/ExpenseTable.tsx` | Modify | `selectedDetail` prop + 비고 컬럼 |
| `components/SearchClient.tsx` | Modify | 최신 연도 기본값 + 비고 컬럼 |
| `components/DrilldownPanel.tsx` | Modify | `monthlyList` prop + 월별 추이 차트 + 비고 컬럼 |
| `components/CategoryDetailChart.tsx` | Modify | `onDetailSelect` 콜백 + 클릭 핸들러 |
| `components/Dashboard.tsx` | Modify | `selectedDetail` 상태 + 헤더 텍스트 |
| `components/MonthlyClient.tsx` | Modify | `monthlyList` DrilldownPanel에 전달 |
| `components/CompareCharts.tsx` | Modify | `detailSearch` 상태 + 검색 인풋 |
