# Dashboard v2 Phase 2 Design

**Date:** 2026-03-21
**Status:** Approved

## Goal

Phase 2 adds three capabilities to the household ledger dashboard:

1. **Excel upload UI** — drag-and-drop xlsx upload with parse preview → Supabase insert
2. **Google Sheets sync** — Sheets API-based import with preview → Supabase insert
3. **Year comparison tab** — multi-year overlay charts (line + grouped bar)

All admin/import sits behind Supabase Auth. The existing four tabs remain functionally unchanged.

---

## Dependencies to Install

```bash
npm install @supabase/ssr googleapis
```

- `@supabase/ssr` — required for cookie-based session handling in middleware + server components
- `googleapis` — required for Google Sheets API calls in `/api/sheets`

---

## Constraints & Assumptions

- `expenses` table already has a `year` column (integer)
- Excel files follow the same column layout as the existing 2022 가계부.xlsx (col[0]=date, col[1]=month-col (KST trick), col[4]=category, col[5]=detail, col[6]=method, col[7]=amount)
- `parseExcelBuffer.ts` replicates the same `monthFromMolCol` KST +9h trick from `parseExcel.ts`; the `year` parameter is always user-supplied (overrides file content)
- Google Sheets range fetched: `{sheetName}!A:H` (same 8-column layout); service account JSON in env var `GOOGLE_SERVICE_ACCOUNT_JSON`; user shares spreadsheet with the service account email
- **개요 tab with multi-year data**: `fetchData()` continues to fetch all years combined. After a second year is imported the 개요 tab will show cross-year aggregates — this is acceptable for Phase 2. A year selector for 개요 is out of scope.
- **Supabase clients**: `lib/supabase.ts` (service role key, `'server-only'`) remains untouched and continues to be used by `fetchData.ts` and all existing data reads. Two new clients are added alongside it:
  - `lib/supabase-server.ts` — cookie-based client for session reading in server components + API routes
  - `lib/supabase-client.ts` — anon key browser client for login form actions
  - Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (new, browser-safe), `SUPABASE_SERVICE_ROLE_KEY` (existing), `GOOGLE_SERVICE_ACCOUNT_JSON`
- **Duplicate detection**: The `expenses` table must have a unique constraint on `(year, expense_date, category, COALESCE(detail,''), amount)` — this constraint is created once via Supabase SQL editor before Phase 2 is deployed. The API insert uses Supabase `upsert({ onConflict: ... })` and counts skipped rows.
- **Preview → insert handoff**: Client re-posts full parsed `RawExpenseRow[]` to `/api/insert`. The `/api/insert` route validates the Supabase session before processing. Body size limit raised to 20MB via `next.config.mjs`: `experimental.serverActions.bodySizeLimit: '20mb'` (also applies to all Server Actions). Note: Pages Router `config.api.bodyParser` syntax does NOT work in App Router routes.
- **`/api/year-data` auth**: Unauthenticated by intentional design — only aggregated totals are exposed, no individual expense rows.
- **`CategoryTotal` type**: Unchanged (four named properties). `CompareClient` references the four known keys directly.
- Max upload file size: 10 MB; accepted MIME: `.xlsx` only (validated client-side before upload)

---

## Data Types

**`RawExpenseRow`** — added to `lib/types.ts`:
```ts
export interface RawExpenseRow {
  year: number
  month: number        // 1–12
  expense_date: string // 'YYYY-MM-DD'
  category: string     // '고정비' | '대출상환' | '변동비' | '여행공연비'
  detail: string       // '' if absent (never null)
  method: string       // '' if absent (never null)
  amount: number       // positive integer (won)
}
```

**`ParsePreviewResponse`** — added to `lib/types.ts`:
```ts
export interface ParsePreviewResponse {
  rows: RawExpenseRow[]      // full parsed dataset (re-posted to /api/insert on confirm)
  totalCount: number
  duplicateCount: number     // rows already in Supabase (cross-checked server-side)
  sampleRows: RawExpenseRow[] // first 10 rows for display in modal
  year: number
}
```

---

## Architecture

### Data Layer

**`lib/aggregateExpenses.ts`** (new) — extracted from `fetchData.ts`
```ts
export function aggregateExpenses(rows: RawExpenseRow[]): DashboardData
```

**`lib/fetchData.ts`** — internally refactored to call `aggregateExpenses()`; external interface unchanged. Still uses `lib/supabase.ts` (service role).

**`lib/fetchYearData.ts`** (new)
```ts
export async function fetchYearData(year: number): Promise<DashboardData>
// supabase.from('expenses').select('*').eq('year', year)
// → aggregateExpenses(rows)
```

**`lib/fetchYears.ts`** (new)
```ts
export async function fetchAvailableYears(): Promise<{ year: number; count: number }[]>
// SELECT year, COUNT(*) FROM expenses GROUP BY year ORDER BY year ASC
```

**`lib/parseExcelBuffer.ts`** (new)
```ts
export function parseExcelBuffer(buffer: Buffer, year: number): RawExpenseRow[]
// XLSX.read(buffer, { type: 'buffer', cellDates: true })   ← must use 'buffer' not 'array'
// Same column mapping + monthFromMolCol KST trick as parseExcel.ts
// year param is always user-supplied; replaces any year value derived from the file
```

---

### Authentication

**`middleware.ts`** (new, project root)
- Calls `updateSession()` from `@supabase/ssr` to refresh session cookies on every request
- `matcher`: applies to all routes except `/_next/`, `/api/`, and static assets

**`lib/supabase-server.ts`** (new) — cookie-based server client using `createServerClient` from `@supabase/ssr`

**`lib/supabase-client.ts`** (new) — browser client using `createBrowserClient` from `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**`app/login/page.tsx`** (new) — email + password form (client component)
- On submit: calls `supabase.auth.signInWithPassword()`
- Success → `router.push('/admin')`
- Failure → inline error message below the form

**`app/admin/page.tsx`** (new) — server component
- Must export `export const dynamic = 'force-dynamic'` to prevent Next.js from statically rendering the page at build time (which would cause the session check to always see no session)
- Reads session via `lib/supabase-server.ts`
- No session → `redirect('/login')`
- `await fetchAvailableYears()` → pass to `<AdminClient />`

---

### Admin Page (`/admin`)

**`components/AdminClient.tsx`** (new) — three sections:

**Section A — Excel Upload**
- Drag-and-drop zone + click-to-browse; MIME + size validated client-side
- On file select → POST `/api/upload` as `multipart/form-data`
- Server: `req.formData()` → extract file blob → `arrayBuffer()` → `parseExcelBuffer()` → cross-check Supabase for duplicates → return `ParsePreviewResponse`
- Opens `<PreviewModal />` with result
- "저장" → POST `/api/insert` with `{ rows }` → show `{ inserted, skipped }` toast

**Section B — Google Sheets Sync**
- Inputs: Spreadsheet ID, Sheet name (default: `지출내역`), Year
- "데이터 가져오기" → POST `/api/sheets` with `{ spreadsheetId, sheetName, year }`
- Server: initialise `google.auth.GoogleAuth` from `GOOGLE_SERVICE_ACCOUNT_JSON`, fetch range, parse columns, cross-check duplicates → return `ParsePreviewResponse`
- Same preview modal + save flow as Excel

**Section C — Stored Data Summary**
- Year cards grid from `availableYears` prop; after save, calls `/api/years` (GET) to refresh counts

**`components/PreviewModal.tsx`** (new) — shared modal
- Shows: year, totalCount, duplicateCount, sample table (first 10 rows with date/category/detail/amount columns)
- Buttons: "저장 (N건)" / "취소"

**API Routes:**

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `app/api/upload/route.ts` | POST | Required | Receives xlsx via formData, returns `ParsePreviewResponse` |
| `app/api/sheets/route.ts` | POST | Required | Calls Google Sheets API, returns `ParsePreviewResponse` |
| `app/api/insert/route.ts` | POST | Required | Upserts `RawExpenseRow[]`, returns `{inserted, skipped}`. Body parser: 20MB limit |
| `app/api/year-data/route.ts` | GET | None | `?year=YYYY` → `DashboardData` JSON (aggregated only) |
| `app/api/years/route.ts` | GET | Required | Returns `{year, count}[]` for admin summary refresh |

---

### Year Comparison Tab (`/compare`)

**`app/compare/page.tsx`** — replace placeholder; server component
- `await fetchAvailableYears()` → pass to `<CompareClient />`
- If empty → "아직 데이터가 없습니다" empty state

**`components/CompareClient.tsx`** (new) — client component
- Year checkboxes: one per available year, disabled (greyed) if `count === 0`
- Year colors: `['#4E79A7','#E15759','#59A14F','#F28E2B','#76B7B2']` cycling
- On checkbox change → `Promise.all(selectedYears.map(y => fetch('/api/year-data?year='+y)))`, per-year loading skeleton while fetching
- State: `Record<number, DashboardData>`

**Charts:**
1. **월별 지출 비교** — `LineChart`: X=1~12월, one `<Line>` per year in its color; tooltip shows all years
2. **카테고리별 연도 비교** — `BarChart` (grouped): X=4 categories, one `<Bar>` per year; annual totals

---

## `TabNav.tsx` Change

Add `{ label: '관리', href: '/admin' }` as the 5th entry in the `TABS` array. The tab is always visible to all users (including unauthenticated). Unauthenticated users who click it are redirected to `/login` by `app/admin/page.tsx`. No client-side conditional rendering in TabNav — the server redirect is the sole access control mechanism.

---

## File Map

| Action | File | Notes |
|--------|------|-------|
| Create | `middleware.ts` | Session refresh; matcher excludes `/_next`, `/api`, static |
| Create | `lib/aggregateExpenses.ts` | Shared aggregation logic |
| Create | `lib/fetchYearData.ts` | Year-filtered fetch |
| Create | `lib/fetchYears.ts` | Available years + counts |
| Create | `lib/parseExcelBuffer.ts` | Upload-safe xlsx parser (replicates KST trick) |
| Create | `lib/supabase-server.ts` | Cookie-based server Supabase client |
| Create | `lib/supabase-client.ts` | Browser Supabase client (anon key) |
| Create | `app/login/page.tsx` | Email/password login form |
| Create | `app/admin/page.tsx` | Auth-gated admin shell (server) |
| Create | `components/AdminClient.tsx` | Upload + Sheets + summary UI |
| Create | `components/PreviewModal.tsx` | Shared parse preview modal |
| Create | `app/api/upload/route.ts` | xlsx parse endpoint |
| Create | `app/api/sheets/route.ts` | Google Sheets API proxy |
| Create | `app/api/insert/route.ts` | Supabase upsert endpoint (20MB body) |
| Create | `app/api/year-data/route.ts` | Per-year DashboardData (no auth) |
| Create | `app/api/years/route.ts` | Admin year summary refresh |
| Replace | `app/compare/page.tsx` | Real implementation (was placeholder) |
| Create | `components/CompareClient.tsx` | Multi-year comparison UI |
| Modify | `components/TabNav.tsx` | Add 관리 as 5th tab |
| Modify | `lib/fetchData.ts` | Delegate to aggregateExpenses() internally |
| Modify | `lib/types.ts` | Add RawExpenseRow, ParsePreviewResponse |

## Pre-deployment DB Step

Run once in Supabase SQL editor before deploying Phase 2:
```sql
ALTER TABLE expenses
ADD CONSTRAINT expenses_dedup_key
UNIQUE (year, expense_date, category, COALESCE(detail, ''), amount);
```

---

## Out of Scope (Phase 3+)

- Deleting year data from the admin UI
- Editing individual expense rows
- Year selector on 개요/월별분석/검색 tabs
- Multiple user accounts / per-user data isolation
- Mobile-optimized upload flow
