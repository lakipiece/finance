# Dashboard v2 Phase 2 Design

**Date:** 2026-03-21
**Status:** Approved

## Goal

Phase 2 adds three capabilities to the household budget dashboard:

1. **Excel upload UI** — drag-and-drop xlsx upload with parse preview → Supabase insert
2. **Google Sheets sync** — Sheets API-based import with preview → Supabase insert
3. **Year comparison tab** — multi-year overlay charts (line + grouped bar)

All admin/import functionality sits behind Supabase Auth. The existing tabs and data flow remain unchanged.

---

## Constraints & Assumptions

- Supabase `expenses` table already has a `year` column (integer)
- Excel files follow the same column layout as the existing 2022 가계부.xlsx
- Google Sheets API key stored in env var (`GOOGLE_SHEETS_API_KEY`)
- `fetchData()` in `lib/fetchData.ts` is not modified — it continues to return all-years data for the overview tab
- Duplicate detection: skip rows where `(year, expense_date, category, detail, amount)` already exists in Supabase

---

## Architecture

### Data Layer

Three new files alongside the existing `fetchData.ts`:

**`lib/aggregateExpenses.ts`** — shared aggregation function extracted from `fetchData.ts`
```ts
export function aggregateExpenses(rows: RawExpenseRow[]): DashboardData
```
Both `fetchData.ts` and `fetchYearData.ts` call this instead of duplicating the logic.

**`lib/fetchYearData.ts`**
```ts
export async function fetchYearData(year: number): Promise<DashboardData>
// SELECT * FROM expenses WHERE year = year
// → passes rows to aggregateExpenses()
```

**`lib/fetchYears.ts`**
```ts
export async function fetchAvailableYears(): Promise<number[]>
// SELECT DISTINCT year FROM expenses ORDER BY year ASC
```

**`lib/parseExcelBuffer.ts`** — new upload-safe parser
```ts
export function parseExcelBuffer(buffer: ArrayBuffer, year: number): RawExpenseRow[]
// Same column mapping as parseExcel.ts but reads from in-memory buffer
// Returns raw rows (not aggregated) for preview + Supabase insert
```

**`lib/types.ts`** — add `RawExpenseRow`:
```ts
export interface RawExpenseRow {
  year: number
  month: number
  expense_date: string
  category: string
  detail: string
  method: string
  amount: number
}
```

---

### Authentication

**Supabase Auth** (email + password). No new auth library — use `@supabase/ssr` for server-side session handling.

- `lib/supabase-server.ts` — server-side Supabase client using cookies
- `app/login/page.tsx` — login form (client component)
- `app/admin/page.tsx` — reads session server-side; redirects to `/login` if unauthenticated

**TabNav change:**
```
개요 | 월별분석 | 연도비교 | 검색 | 관리
```
`관리` link in TabNav points to `/admin`. No auth check in TabNav itself — the server redirect handles it.

---

### Admin Page (`/admin`)

**`app/admin/page.tsx`** — server component
- Reads Supabase session via `lib/supabase-server.ts`
- If no session → `redirect('/login')`
- Fetches available years + record counts for the summary section
- Renders `<AdminClient />`

**`components/AdminClient.tsx`** — client component with three sections:

**Section A — Excel Upload**
- Drag-and-drop zone (or click to browse), accepts `.xlsx`
- On file select: POST to `/api/upload` as `multipart/form-data`
- Server parses with `parseExcelBuffer()` → returns `{ rows, year, duplicateCount }`
- Client shows **preview modal**: row count, year detected, duplicate count, sample table (first 10 rows)
- "저장" button → POST to `/api/insert` with rows → Supabase upsert skipping duplicates

**Section B — Google Sheets Sync**
- Three inputs: Spreadsheet ID, Sheet name (default: "지출내역"), Year (number)
- "데이터 가져오기" button → POST to `/api/sheets` with `{ spreadsheetId, sheetName, year }`
- Server API route fetches via Google Sheets API → parses rows → returns same preview payload
- Same preview modal and save flow as Excel upload

**Section C — Stored Data Summary**
- Cards showing each year with record count
- Years with no data shown as empty/dashed cards
- Refreshes after a successful save

**API Routes:**
```
app/api/upload/route.ts   — POST: receives xlsx buffer, returns parsed preview
app/api/sheets/route.ts   — POST: calls Google Sheets API, returns parsed preview
app/api/insert/route.ts   — POST: receives RawExpenseRow[], inserts to Supabase (skips duplicates)
```

All API routes check for a valid Supabase session before processing.

---

### Year Comparison Tab (`/compare`)

**`app/compare/page.tsx`** — server component
- Calls `fetchAvailableYears()`
- If no years → shows empty state
- Passes available years to `<CompareClient />`

**`components/CompareClient.tsx`** — client component
- **Year selector**: checkbox per available year (disabled + greyed if unavailable)
- On selection change → `fetch('/api/year-data?year=YYYY')` for newly checked years; drops unchecked
- Year colors: each year gets a color from a fixed sequence (Tableau palette)

**`app/api/year-data/route.ts`**
```ts
GET /api/year-data?year=2022
// Calls fetchYearData(year), returns DashboardData as JSON
// Auth not required (read-only public data)
```

**Charts (both using Recharts):**

1. **월별 지출 비교** — `LineChart`
   - X axis: 1월~12월
   - One `<Line>` per selected year, each with its year color
   - Tooltip shows all selected years' values for that month

2. **카테고리별 연도 비교** — `BarChart` with grouped bars
   - X axis: 4 categories
   - One bar group per category, bars colored by year
   - Shows annual total per category per year

---

## File Map

| Action | File | Notes |
|--------|------|-------|
| Create | `lib/aggregateExpenses.ts` | Extracted from fetchData.ts |
| Create | `lib/fetchYearData.ts` | Year-filtered data fetch |
| Create | `lib/fetchYears.ts` | Available years query |
| Create | `lib/parseExcelBuffer.ts` | Upload-safe Excel parser |
| Create | `lib/supabase-server.ts` | SSR Supabase client |
| Create | `app/login/page.tsx` | Login form |
| Create | `app/admin/page.tsx` | Admin shell (server, auth-gated) |
| Create | `components/AdminClient.tsx` | Upload + Sheets + summary UI |
| Create | `app/api/upload/route.ts` | xlsx parse endpoint |
| Create | `app/api/sheets/route.ts` | Google Sheets API proxy |
| Create | `app/api/insert/route.ts` | Supabase insert endpoint |
| Create | `app/api/year-data/route.ts` | Year data fetch endpoint |
| Replace | `app/compare/page.tsx` | Real implementation (was placeholder) |
| Create | `components/CompareClient.tsx` | Multi-year comparison UI |
| Modify | `components/TabNav.tsx` | Add 관리 tab |
| Modify | `lib/fetchData.ts` | Delegate to aggregateExpenses() |
| Modify | `lib/types.ts` | Add RawExpenseRow |

---

## Out of Scope (Phase 3+)

- Deleting year data from the admin UI
- Editing individual expense rows
- Multiple user accounts / per-user data isolation
- Mobile-optimized upload flow
