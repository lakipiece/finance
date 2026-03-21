# Dashboard v2 Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase Auth-gated Excel/Google Sheets upload UI and multi-year comparison charts to the existing Next.js 14 household budget dashboard.

**Architecture:** A shared `aggregateExpenses()` function is extracted from `fetchData.ts`; `fetchYearData()` and `fetchYears()` are added alongside it. Auth uses `@supabase/ssr` with a `middleware.ts` session refresher. The `/admin` page (server-gated) handles xlsx upload and Google Sheets sync via API routes. The `/compare` page (public) fetches per-year `DashboardData` from `/api/year-data` and overlays them on shared Recharts charts.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (`@supabase/ssr`), `xlsx`, `googleapis`, Recharts, Tailwind CSS

> **Note on testing:** No test framework — verification uses `npm run dev` and browser inspection.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `next.config.mjs` | Add `experimental.serverActions.bodySizeLimit` |
| Modify | `lib/types.ts` | Add `RawExpenseRow`, `ParsePreviewResponse` |
| Create | `lib/aggregateExpenses.ts` | Shared aggregation logic (extracted from fetchData) |
| Modify | `lib/fetchData.ts` | Delegate to `aggregateExpenses()` internally |
| Create | `lib/fetchYearData.ts` | Year-filtered `DashboardData` fetch |
| Create | `lib/fetchYears.ts` | `fetchAvailableYears()` query |
| Create | `lib/parseExcelBuffer.ts` | Upload-safe xlsx parser (Buffer, KST trick) |
| Create | `middleware.ts` | Supabase session refresh on every request |
| Create | `lib/supabase-server.ts` | Cookie-based server Supabase client |
| Create | `lib/supabase-client.ts` | Browser Supabase client (anon key) |
| Create | `app/login/page.tsx` | Email/password login form |
| Create | `app/admin/page.tsx` | Auth-gated admin shell (server, force-dynamic) |
| Create | `components/AdminClient.tsx` | Upload + Sheets + summary UI (client) |
| Create | `components/PreviewModal.tsx` | Shared parse preview modal |
| Create | `app/api/upload/route.ts` | xlsx parse → `ParsePreviewResponse` |
| Create | `app/api/sheets/route.ts` | Google Sheets API proxy → `ParsePreviewResponse` |
| Create | `app/api/insert/route.ts` | Supabase insert (dedup, 20MB body) |
| Create | `app/api/years/route.ts` | Year counts for admin refresh |
| Create | `app/api/year-data/route.ts` | Per-year `DashboardData` (no auth) |
| Replace | `app/compare/page.tsx` | Real year comparison (was placeholder) |
| Create | `components/CompareClient.tsx` | Year selector + data fetch orchestration |
| Create | `components/CompareCharts.tsx` | Recharts line + grouped bar (SSR-safe dynamic import) |
| Modify | `components/TabNav.tsx` | Add 관리 as 5th tab |

---

## Task 1: Install dependencies + update next.config.mjs

**Files:**
- Modify: `next.config.mjs`

- [ ] **Step 1: Install packages**

```bash
npm install @supabase/ssr googleapis
```

Expected: packages added to `node_modules/`, `package.json` updated.

- [ ] **Step 2: Update next.config.mjs**

Replace the entire file:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['xlsx'],
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
}

export default nextConfig
```

- [ ] **Step 3: Add NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local**

Open `.env.local` and add the line (get the value from Supabase dashboard → Project Settings → API → anon/public key):

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

`GOOGLE_SERVICE_ACCOUNT_JSON` must be the full JSON string of the service account key file (from Google Cloud Console → IAM → Service Accounts → Keys → Add Key → JSON). The user must share their spreadsheet with the service account's email.

- [ ] **Step 4: Verify dev server still starts**

```bash
npm run dev
```

Expected: Server starts on port 3001 (or 3000), no errors.

- [ ] **Step 5: Commit**

```bash
git add next.config.mjs package.json package-lock.json
git commit -m "chore: add @supabase/ssr googleapis, raise body size limit to 20mb"
```

---

## Task 2: lib/types.ts — Add RawExpenseRow + ParsePreviewResponse

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add two new interfaces to lib/types.ts**

Append to the end of the existing file:

```typescript
export interface RawExpenseRow {
  year: number
  month: number        // 1–12
  expense_date: string // 'YYYY-MM-DD'
  category: string     // '고정비' | '대출상환' | '변동비' | '여행공연비'
  detail: string       // '' if absent (never null)
  method: string       // '' if absent (never null)
  amount: number       // positive integer (won)
}

export interface ParsePreviewResponse {
  rows: RawExpenseRow[]
  totalCount: number
  duplicateCount: number
  sampleRows: RawExpenseRow[] // first 10 rows
  year: number
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add RawExpenseRow and ParsePreviewResponse types"
```

---

## Task 3: lib/aggregateExpenses.ts + refactor lib/fetchData.ts

**Files:**
- Create: `lib/aggregateExpenses.ts`
- Modify: `lib/fetchData.ts`

- [ ] **Step 1: Create lib/aggregateExpenses.ts**

```typescript
import 'server-only'
import type { DashboardData, MonthlyData, CategoryTotal, ExpenseItem, DetailItem, RawExpenseRow } from './types'

const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export function aggregateExpenses(rows: RawExpenseRow[]): DashboardData {
  const monthly: Record<number, Record<string, number>> = {}
  const methods: Record<string, number> = {}
  const detailByCat: Record<string, Record<string, number>> = {}

  for (const e of rows) {
    const { month, category, detail, method, amount } = e
    if (!category || !amount) continue

    if (!monthly[month]) monthly[month] = {}
    monthly[month][category] = (monthly[month][category] ?? 0) + amount

    if (method) methods[method] = (methods[method] ?? 0) + amount

    if (!detailByCat[category]) detailByCat[category] = {}
    const key = detail || '기타'
    detailByCat[category][key] = (detailByCat[category][key] ?? 0) + amount
  }

  const monthlyList: MonthlyData[] = MONTH_NAMES.map((name, i) => {
    const m = i + 1
    const d = monthly[m] ?? {}
    const 고정비 = d['고정비'] ?? 0
    const 대출상환 = d['대출상환'] ?? 0
    const 변동비 = d['변동비'] ?? 0
    const 여행공연비 = d['여행공연비'] ?? 0
    return { month: name, 고정비, 대출상환, 변동비, 여행공연비, total: 고정비 + 대출상환 + 변동비 + 여행공연비 }
  })

  const total = monthlyList.reduce((s, m) => s + m.total, 0)

  const categoryTotals: CategoryTotal = {
    고정비: monthlyList.reduce((s, m) => s + m.고정비, 0),
    대출상환: monthlyList.reduce((s, m) => s + m.대출상환, 0),
    변동비: monthlyList.reduce((s, m) => s + m.변동비, 0),
    여행공연비: monthlyList.reduce((s, m) => s + m.여행공연비, 0),
  }

  const maxMonth = monthlyList.reduce((a, b) => a.total > b.total ? a : b)

  function toExpenseItem(e: RawExpenseRow): ExpenseItem {
    return { date: e.expense_date, month: e.month, category: e.category, detail: e.detail, method: e.method, amount: e.amount }
  }

  const sorted = [...rows].sort((a, b) => b.amount - a.amount)
  const topExpenses = sorted.slice(0, 20).map(toExpenseItem)
  const allExpenses = rows.map(toExpenseItem)

  function toDetailItems(cat: string): DetailItem[] {
    return Object.entries(detailByCat[cat] ?? {})
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
  }

  return {
    total,
    monthlyAvg: Math.round(total / 12),
    maxMonth,
    categoryTotals,
    monthlyList,
    paymentMethods: methods,
    topExpenses,
    variableDetail: toDetailItems('변동비'),
    fixedDetail: toDetailItems('고정비'),
    allExpenses,
  }
}
```

- [ ] **Step 2: Refactor lib/fetchData.ts to delegate to aggregateExpenses()**

Replace the entire file:

```typescript
import 'server-only'
import { supabase } from './supabase'
import { aggregateExpenses } from './aggregateExpenses'
import type { DashboardData, RawExpenseRow } from './types'

export async function fetchData(): Promise<DashboardData> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')

  if (error) throw new Error(`Supabase 오류: ${error.message}`)
  if (!data || data.length === 0) throw new Error('데이터가 없습니다.')

  const rows: RawExpenseRow[] = data.map((e: any) => ({
    year: e.year ?? 0,
    month: e.month,
    expense_date: e.expense_date ?? '',
    category: e.category ?? '',
    detail: e.detail ?? '',
    method: e.method ?? '',
    amount: e.amount ?? 0,
  }))

  return aggregateExpenses(rows)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Verify overview tab still works**

Open http://localhost:3001 — KPI cards, monthly chart, donut chart should all render with the same data as before.

- [ ] **Step 5: Commit**

```bash
git add lib/aggregateExpenses.ts lib/fetchData.ts
git commit -m "refactor: extract aggregateExpenses() shared function from fetchData"
```

---

## Task 4: lib/fetchYearData.ts + lib/fetchYears.ts

**Files:**
- Create: `lib/fetchYearData.ts`
- Create: `lib/fetchYears.ts`

- [ ] **Step 1: Create lib/fetchYearData.ts**

```typescript
import 'server-only'
import { supabase } from './supabase'
import { aggregateExpenses } from './aggregateExpenses'
import type { DashboardData, RawExpenseRow } from './types'

export async function fetchYearData(year: number): Promise<DashboardData> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('year', year)

  if (error) throw new Error(`Supabase 오류: ${error.message}`)

  const rows: RawExpenseRow[] = (data ?? []).map((e: any) => ({
    year: e.year ?? year,
    month: e.month,
    expense_date: e.expense_date ?? '',
    category: e.category ?? '',
    detail: e.detail ?? '',
    method: e.method ?? '',
    amount: e.amount ?? 0,
  }))

  return aggregateExpenses(rows)
}
```

- [ ] **Step 2: Create lib/fetchYears.ts**

```typescript
import 'server-only'
import { supabase } from './supabase'

export async function fetchAvailableYears(): Promise<{ year: number; count: number }[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('year')

  if (error || !data) return []

  const counts: Record<number, number> = {}
  for (const row of data) {
    if (row.year) counts[row.year] = (counts[row.year] ?? 0) + 1
  }

  return Object.entries(counts)
    .map(([year, count]) => ({ year: Number(year), count }))
    .sort((a, b) => a.year - b.year)
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/fetchYearData.ts lib/fetchYears.ts
git commit -m "feat: add fetchYearData and fetchAvailableYears"
```

---

## Task 5: lib/parseExcelBuffer.ts

**Files:**
- Create: `lib/parseExcelBuffer.ts`

- [ ] **Step 1: Create lib/parseExcelBuffer.ts**

This replicates the KST month trick from `parseExcel.ts` but reads from a Node.js `Buffer` instead of the filesystem.

```typescript
import 'server-only'
import * as XLSX from 'xlsx'
import type { RawExpenseRow } from './types'

function toDateString(val: unknown): string {
  if (val instanceof Date) {
    const y = val.getUTCFullYear()
    const m = String(val.getUTCMonth() + 1).padStart(2, '0')
    const d = String(val.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return ''
}

// The month column stores the last day of the previous month in KST.
// Reading via UTC gives the previous month → add 9h (KST) → next month = actual month.
const KST_MS = 9 * 60 * 60 * 1000
function monthFromMolCol(val: unknown): number | null {
  if (!(val instanceof Date)) return null
  const kst = new Date(val.getTime() + KST_MS)
  const raw = kst.getUTCMonth() + 1
  return (raw % 12) + 1
}

export function parseExcelBuffer(buffer: Buffer, year: number): RawExpenseRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  const ws = wb.Sheets['지출내역']
  if (!ws) throw new Error('시트 "지출내역"을 찾을 수 없습니다.')

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]

  const result: RawExpenseRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const dateVal = row[0]
    const monthVal = row[1]
    const cat = row[4] != null ? String(row[4]).trim() : null
    const detail = row[5] != null ? String(row[5]).trim() : ''
    const method = row[6] != null ? String(row[6]).trim() : ''
    const rawAmt = row[7]

    if (!cat || rawAmt == null) continue

    const amount = typeof rawAmt === 'number' ? rawAmt : parseFloat(String(rawAmt))
    if (isNaN(amount) || amount <= 0) continue

    const monthNum = monthFromMolCol(monthVal)
    if (!monthNum) continue

    result.push({
      year,
      month: monthNum,
      expense_date: toDateString(dateVal),
      category: cat,
      detail,
      method,
      amount: Math.round(amount),
    })
  }

  return result
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/parseExcelBuffer.ts
git commit -m "feat: add parseExcelBuffer for web upload xlsx parsing"
```

---

## Task 6: Auth infrastructure — middleware + Supabase clients

**Files:**
- Create: `middleware.ts`
- Create: `lib/supabase-server.ts`
- Create: `lib/supabase-client.ts`

- [ ] **Step 1: Create middleware.ts (project root)**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove this line
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Create lib/supabase-server.ts**

```typescript
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component — cookie writes are ignored
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create lib/supabase-client.ts**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Verify existing pages still load**

```bash
npm run dev
```

Open http://localhost:3001 — overview tab should still render correctly. The middleware should run without errors (check terminal for middleware logs).

- [ ] **Step 6: Commit**

```bash
git add middleware.ts lib/supabase-server.ts lib/supabase-client.ts
git commit -m "feat: add Supabase SSR auth middleware and server/browser clients"
```

---

## Task 7: app/login/page.tsx

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Create app/login/page.tsx**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
    } else {
      router.push('/admin')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-800 mb-1">관리자 로그인</h1>
        <p className="text-sm text-slate-400 mb-6">가계부 데이터 관리 페이지</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3001/login — login form should render. Enter wrong credentials → inline error message. (Don't test real login yet — admin page isn't built.)

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: add login page with Supabase auth"
```

---

## Task 8: API routes — /api/upload, /api/sheets, /api/insert, /api/years, /api/year-data

**Files:**
- Create: `app/api/upload/route.ts`
- Create: `app/api/sheets/route.ts`
- Create: `app/api/insert/route.ts`
- Create: `app/api/years/route.ts`
- Create: `app/api/year-data/route.ts`

- [ ] **Step 1: Create app/api/upload/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { parseExcelBuffer } from '@/lib/parseExcelBuffer'
import { supabase } from '@/lib/supabase'
import type { ParsePreviewResponse, RawExpenseRow } from '@/lib/types'

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const yearStr = formData.get('year') as string | null

  if (!file || !yearStr) {
    return NextResponse.json({ error: '파일과 연도를 모두 입력해주세요.' }, { status: 400 })
  }

  const year = parseInt(yearStr)
  if (isNaN(year)) return NextResponse.json({ error: '연도가 올바르지 않습니다.' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let rows: RawExpenseRow[]
  try {
    rows = parseExcelBuffer(buffer, year)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 })
  }

  // Check duplicates against existing Supabase rows
  const { data: existing } = await supabase
    .from('expenses')
    .select('expense_date, category, detail, amount')
    .eq('year', year)

  const existingSet = new Set(
    (existing ?? []).map((e: any) =>
      `${e.expense_date}|${e.category}|${e.detail ?? ''}|${e.amount}`
    )
  )

  const duplicateCount = rows.filter(r =>
    existingSet.has(`${r.expense_date}|${r.category}|${r.detail}|${r.amount}`)
  ).length

  const response: ParsePreviewResponse = {
    rows,
    totalCount: rows.length,
    duplicateCount,
    sampleRows: rows.slice(0, 10),
    year,
  }

  return NextResponse.json(response)
}
```

- [ ] **Step 2: Create app/api/sheets/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { google } from 'googleapis'
import type { ParsePreviewResponse, RawExpenseRow } from '@/lib/types'

function toDateString(val: string): string {
  // Expects 'YYYY-MM-DD' or similar formatted string from Sheets FORMATTED_VALUE
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { spreadsheetId, sheetName, year } = await req.json()

  if (!spreadsheetId || !sheetName || !year) {
    return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 })
  }

  const yearNum = parseInt(String(year))
  if (isNaN(yearNum)) return NextResponse.json({ error: '연도가 올바르지 않습니다.' }, { status: 400 })

  let credentials: any
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!)
  } catch {
    return NextResponse.json({ error: 'Google 서비스 계정 설정이 올바르지 않습니다.' }, { status: 500 })
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  const sheets = google.sheets({ version: 'v4', auth })

  let values: string[][]
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:H`,
      valueRenderOption: 'FORMATTED_VALUE',
    })
    values = (response.data.values ?? []) as string[][]
  } catch (err: any) {
    return NextResponse.json({ error: `Google Sheets 오류: ${err.message}` }, { status: 422 })
  }

  const rows: RawExpenseRow[] = []
  for (let i = 1; i < values.length; i++) {
    const row = values[i]
    if (!row || row.length < 8) continue

    const dateStr = row[0] ?? ''
    const cat = (row[4] ?? '').trim()
    const detail = (row[5] ?? '').trim()
    const method = (row[6] ?? '').trim()
    const rawAmt = row[7] ?? ''

    if (!cat || !rawAmt) continue

    const amount = parseFloat(String(rawAmt).replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) continue

    // Derive month from the date string in col[0]
    const expenseDate = toDateString(dateStr)
    const monthNum = expenseDate ? new Date(expenseDate).getMonth() + 1 : null
    if (!monthNum) continue

    rows.push({
      year: yearNum,
      month: monthNum,
      expense_date: expenseDate,
      category: cat,
      detail,
      method,
      amount: Math.round(amount),
    })
  }

  // Check duplicates
  const { data: existing } = await supabase
    .from('expenses')
    .select('expense_date, category, detail, amount')
    .eq('year', yearNum)

  const existingSet = new Set(
    (existing ?? []).map((e: any) =>
      `${e.expense_date}|${e.category}|${e.detail ?? ''}|${e.amount}`
    )
  )

  const duplicateCount = rows.filter(r =>
    existingSet.has(`${r.expense_date}|${r.category}|${r.detail}|${r.amount}`)
  ).length

  const response: ParsePreviewResponse = {
    rows,
    totalCount: rows.length,
    duplicateCount,
    sampleRows: rows.slice(0, 10),
    year: yearNum,
  }

  return NextResponse.json(response)
}
```

- [ ] **Step 3: Create app/api/insert/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import type { RawExpenseRow } from '@/lib/types'

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows, year }: { rows: RawExpenseRow[]; year: number } = await req.json()

  if (!rows || !year) return NextResponse.json({ error: '데이터가 없습니다.' }, { status: 400 })

  // Re-check duplicates server-side before inserting
  const { data: existing } = await supabase
    .from('expenses')
    .select('expense_date, category, detail, amount')
    .eq('year', year)

  const existingSet = new Set(
    (existing ?? []).map((e: any) =>
      `${e.expense_date}|${e.category}|${e.detail ?? ''}|${e.amount}`
    )
  )

  const toInsert = rows.filter(r =>
    !existingSet.has(`${r.expense_date}|${r.category}|${r.detail}|${r.amount}`)
  )

  if (toInsert.length > 0) {
    const { error } = await supabase.from('expenses').insert(
      toInsert.map(r => ({
        year: r.year,
        month: r.month,
        expense_date: r.expense_date,
        category: r.category,
        detail: r.detail || null,
        method: r.method || null,
        amount: r.amount,
      }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inserted: toInsert.length, skipped: rows.length - toInsert.length })
}
```

- [ ] **Step 4: Create app/api/years/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { fetchAvailableYears } from '@/lib/fetchYears'

export async function GET(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const years = await fetchAvailableYears()
  return NextResponse.json(years)
}
```

- [ ] **Step 5: Create app/api/year-data/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { fetchYearData } from '@/lib/fetchYearData'

export async function GET(req: NextRequest) {
  const yearStr = req.nextUrl.searchParams.get('year')
  const year = yearStr ? parseInt(yearStr) : null

  if (!year || isNaN(year)) {
    return NextResponse.json({ error: 'year 파라미터가 필요합니다.' }, { status: 400 })
  }

  const data = await fetchYearData(year)
  return NextResponse.json(data)
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/upload/route.ts app/api/sheets/route.ts app/api/insert/route.ts app/api/years/route.ts app/api/year-data/route.ts
git commit -m "feat: add upload, sheets, insert, years, year-data API routes"
```

---

## Task 9: components/PreviewModal.tsx

**Files:**
- Create: `components/PreviewModal.tsx`

- [ ] **Step 1: Create components/PreviewModal.tsx**

```typescript
'use client'

import type { ParsePreviewResponse } from '@/lib/types'
import { formatWonFull } from '@/lib/utils'

interface Props {
  preview: ParsePreviewResponse
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

export default function PreviewModal({ preview, onConfirm, onCancel, loading }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">파싱 결과 미리보기</h2>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-slate-500">연도: <strong className="text-slate-700">{preview.year}</strong></span>
            <span className="text-slate-500">총 행수: <strong className="text-slate-700">{preview.totalCount}건</strong></span>
            <span className="text-slate-500">중복: <strong className="text-amber-600">{preview.duplicateCount}건 제외</strong></span>
            <span className="text-slate-500">저장 예정: <strong className="text-green-600">{preview.totalCount - preview.duplicateCount}건</strong></span>
          </div>
        </div>

        {/* Sample rows table */}
        <div className="overflow-auto flex-1 p-6">
          <p className="text-xs text-slate-400 mb-3">처음 10행 미리보기</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">날짜</th>
                <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">분류</th>
                <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">내역</th>
                <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">결제</th>
                <th className="text-right py-2 px-2 text-xs text-slate-400 font-medium">금액</th>
              </tr>
            </thead>
            <tbody>
              {preview.sampleRows.map((row, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="py-1.5 px-2 text-slate-400 text-xs">{row.expense_date}</td>
                  <td className="py-1.5 px-2 text-slate-600">{row.category}</td>
                  <td className="py-1.5 px-2 text-slate-700 max-w-[160px] truncate">{row.detail || '-'}</td>
                  <td className="py-1.5 px-2 text-slate-400">{row.method || '-'}</td>
                  <td className="py-1.5 px-2 text-right font-medium text-slate-800">{formatWonFull(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer buttons */}
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || preview.totalCount - preview.duplicateCount === 0}
            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {loading ? '저장 중...' : `저장 (${preview.totalCount - preview.duplicateCount}건)`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/PreviewModal.tsx
git commit -m "feat: add PreviewModal component for upload/sheets preview"
```

---

## Task 10: components/AdminClient.tsx + app/admin/page.tsx

**Files:**
- Create: `components/AdminClient.tsx`
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Create components/AdminClient.tsx**

```typescript
'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import PreviewModal from './PreviewModal'
import type { ParsePreviewResponse } from '@/lib/types'

interface YearSummary { year: number; count: number }

interface Props {
  initialYears: YearSummary[]
}

export default function AdminClient({ initialYears }: Props) {
  const router = useRouter()

  // Excel upload state
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear())
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Google Sheets state
  const [sheetId, setSheetId] = useState('')
  const [sheetName, setSheetName] = useState('지출내역')
  const [sheetYear, setSheetYear] = useState(new Date().getFullYear())
  const [sheetsLoading, setSheetsLoading] = useState(false)
  const [sheetsError, setSheetsError] = useState('')

  // Preview state (shared)
  const [preview, setPreview] = useState<ParsePreviewResponse | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState('')

  // Year summary state
  const [years, setYears] = useState<YearSummary[]>(initialYears)

  async function handleFileUpload(file: File) {
    setUploadError('')
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('year', String(uploadYear))

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const json = await res.json()
    setUploading(false)

    if (!res.ok) { setUploadError(json.error ?? '업로드 실패'); return }
    setPreview(json)
  }

  async function handleSheetsImport() {
    setSheetsError('')
    setSheetsLoading(true)

    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId: sheetId, sheetName, year: sheetYear }),
    })
    const json = await res.json()
    setSheetsLoading(false)

    if (!res.ok) { setSheetsError(json.error ?? '가져오기 실패'); return }
    setPreview(json)
  }

  async function handleConfirmSave() {
    if (!preview) return
    setSaving(true)

    const res = await fetch('/api/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: preview.rows, year: preview.year }),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) { alert(json.error ?? '저장 실패'); return }

    setSaveSuccess(`${json.inserted}건 저장 완료 (${json.skipped}건 중복 제외)`)
    setPreview(null)

    // Refresh year summary
    const yearsRes = await fetch('/api/years')
    if (yearsRes.ok) setYears(await yearsRes.json())
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">데이터 관리</h1>
          <p className="text-sm text-slate-400 mt-0.5">가계부 데이터 업로드 및 관리</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          로그아웃
        </button>
      </div>

      {saveSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
          {saveSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Section A: Excel Upload */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">📂 엑셀 업로드</h2>
          <p className="text-xs text-slate-400 mb-4">xlsx 파일 업로드 후 미리보기에서 확인</p>

          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-1">연도</label>
            <input
              type="number"
              value={uploadYear}
              onChange={(e) => setUploadYear(parseInt(e.target.value))}
              className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-slate-300 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleFileUpload(file)
            }}
          >
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm text-slate-500">
              {uploading ? '파싱 중...' : '파일을 드래그하거나 클릭해서 선택'}
            </p>
            <p className="text-xs text-slate-400 mt-1">.xlsx 형식, 최대 10MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
            }}
          />
          {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}
        </div>

        {/* Section B: Google Sheets */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">🔗 Google Sheets 연동</h2>
          <p className="text-xs text-slate-400 mb-4">서비스 계정으로 시트 데이터를 가져옵니다</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">스프레드시트 ID</label>
              <input
                type="text"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="URL에서 /d/ 뒤의 ID"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">시트 이름</label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">연도</label>
              <input
                type="number"
                value={sheetYear}
                onChange={(e) => setSheetYear(parseInt(e.target.value))}
                className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              onClick={handleSheetsImport}
              disabled={sheetsLoading || !sheetId}
              className="w-full py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {sheetsLoading ? '가져오는 중...' : '데이터 가져오기'}
            </button>
            {sheetsError && <p className="text-xs text-red-500">{sheetsError}</p>}
          </div>
        </div>
      </div>

      {/* Section C: Stored data summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">📊 저장된 데이터</h2>
        {years.length === 0 ? (
          <p className="text-sm text-slate-400">아직 저장된 데이터가 없습니다.</p>
        ) : (
          <div className="flex gap-4 flex-wrap">
            {years.map((y) => (
              <div key={y.year} className="bg-slate-50 rounded-xl px-6 py-4 text-center min-w-24">
                <div className="text-2xl font-bold text-slate-800">{y.year}</div>
                <div className="text-xs text-slate-400 mt-1">{y.count.toLocaleString()}건</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <PreviewModal
          preview={preview}
          onConfirm={handleConfirmSave}
          onCancel={() => setPreview(null)}
          loading={saving}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create app/admin/page.tsx**

```typescript
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { fetchAvailableYears } from '@/lib/fetchYears'
import AdminClient from '@/components/AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const years = await fetchAvailableYears()

  return <AdminClient initialYears={years} />
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Add 관리 tab to TabNav**

In `components/TabNav.tsx`, change the `TABS` array to add the 관리 entry:

```typescript
const TABS = [
  { label: '개요',     href: '/' },
  { label: '월별분석', href: '/monthly' },
  { label: '연도비교', href: '/compare' },
  { label: '검색',     href: '/search' },
  { label: '관리',     href: '/admin' },
]
```

- [ ] **Step 5: Verify admin page works end-to-end**

```bash
npm run dev
```

1. Open http://localhost:3001/admin — should redirect to `/login`
2. Log in with valid Supabase credentials (create a user in Supabase dashboard → Authentication → Users → Invite if needed)
3. After login → should land on `/admin` with upload UI and year summary
4. Upload the existing `data/2022 가계부.xlsx` with year = 2022 → preview modal should appear with ~1200+ rows and matching duplicate count (all duplicates since data is already in Supabase)
5. Cancel the modal — no data should be inserted

- [ ] **Step 6: Commit**

```bash
git add components/AdminClient.tsx app/admin/page.tsx components/TabNav.tsx
git commit -m "feat: add admin page with Excel upload and Google Sheets sync"
```

---

## Task 11: Year comparison tab — CompareClient + page

**Files:**
- Replace: `app/compare/page.tsx`
- Create: `components/CompareClient.tsx`

- [ ] **Step 1: Create components/CompareClient.tsx**

```typescript
'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData } from '@/lib/types'

const CompareCharts = dynamic(() => import('./CompareCharts'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-slate-100 rounded-xl h-64" />,
})

interface YearSummary { year: number; count: number }

const YEAR_COLORS = ['#4E79A7', '#E15759', '#59A14F', '#F28E2B', '#76B7B2']

interface Props {
  availableYears: YearSummary[]
}

export default function CompareClient({ availableYears }: Props) {
  const [selectedYears, setSelectedYears] = useState<number[]>([])
  const [yearData, setYearData] = useState<Record<number, DashboardData>>({})
  const [loading, setLoading] = useState<Record<number, boolean>>({})

  async function fetchYear(year: number) {
    if (yearData[year]) return
    setLoading(prev => ({ ...prev, [year]: true }))
    const res = await fetch(`/api/year-data?year=${year}`)
    if (res.ok) {
      const data = await res.json()
      setYearData(prev => ({ ...prev, [year]: data }))
    }
    setLoading(prev => ({ ...prev, [year]: false }))
  }

  function toggleYear(year: number) {
    setSelectedYears(prev => {
      if (prev.includes(year)) return prev.filter(y => y !== year)
      fetchYear(year)
      return [...prev, year]
    })
  }

  const colorMap = Object.fromEntries(
    availableYears.map((y, i) => [y.year, YEAR_COLORS[i % YEAR_COLORS.length]])
  )

  if (availableYears.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 inline-block">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">데이터가 없습니다</h2>
          <p className="text-slate-400 text-sm">관리 탭에서 연도별 데이터를 업로드하면 비교할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Year selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-4 flex items-center gap-6 flex-wrap">
        <span className="text-sm font-semibold text-slate-600">연도 선택</span>
        <div className="flex gap-3 flex-wrap">
          {availableYears.map((y) => {
            const isSelected = selectedYears.includes(y.year)
            const color = colorMap[y.year]
            const isLoading = loading[y.year]
            return (
              <button
                key={y.year}
                onClick={() => toggleYear(y.year)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isSelected ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                style={isSelected ? { background: color } : {}}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ background: isSelected ? 'rgba(255,255,255,0.6)' : color }}
                />
                {y.year}
                {isLoading && <span className="text-xs opacity-70">...</span>}
              </button>
            )
          })}
        </div>
      </div>

      {selectedYears.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
          <p className="text-slate-400 text-sm">위에서 비교할 연도를 선택하세요</p>
        </div>
      ) : (
        <CompareCharts
          selectedYears={selectedYears}
          yearData={yearData}
          colorMap={colorMap}
          loading={loading}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create components/CompareCharts.tsx**

```typescript
'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import type { DashboardData } from '@/lib/types'
import { formatWonFull } from '@/lib/utils'

const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const CATEGORIES = ['고정비', '대출상환', '변동비', '여행공연비'] as const

interface Props {
  selectedYears: number[]
  yearData: Record<number, DashboardData>
  colorMap: Record<number, string>
  loading: Record<number, boolean>
}

export default function CompareCharts({ selectedYears, yearData, colorMap, loading }: Props) {
  const readyYears = selectedYears.filter(y => yearData[y] && !loading[y])

  // Build monthly line chart data: [{month:'1월', 2022:total, 2023:total}, ...]
  const monthlyData = MONTH_LABELS.map((month, i) => {
    const entry: Record<string, any> = { month }
    for (const year of readyYears) {
      const m = yearData[year].monthlyList[i]
      entry[year] = m?.total ?? 0
    }
    return entry
  })

  // Build category grouped bar data: [{category:'고정비', 2022:amt, 2023:amt}, ...]
  const categoryData = CATEGORIES.map((cat) => {
    const entry: Record<string, any> = { category: cat }
    for (const year of readyYears) {
      entry[year] = yearData[year].categoryTotals[cat] ?? 0
    }
    return entry
  })

  if (readyYears.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
        <div className="animate-pulse text-slate-400 text-sm">데이터 로딩 중...</div>
      </div>
    )
  }

  return (
    <>
      {/* Monthly line chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1">월별 지출 비교</h2>
        <p className="text-xs text-slate-400 mb-4">선택한 연도별 월간 지출 합계</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthlyData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 10000)}만`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatWonFull(value), `${name}년`]}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
            <Legend formatter={(value) => <span style={{ color: '#64748b', fontSize: 12 }}>{value}년</span>} />
            {readyYears.map((year) => (
              <Line
                key={year}
                type="monotone"
                dataKey={year}
                stroke={colorMap[year]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category grouped bar chart */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1">카테고리별 연도 비교</h2>
        <p className="text-xs text-slate-400 mb-4">카테고리별 연간 지출 합계</p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={categoryData} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 10000)}만`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              formatter={(value: number, name: string) => [formatWonFull(value), `${name}년`]}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
            />
            <Legend formatter={(value) => <span style={{ color: '#64748b', fontSize: 12 }}>{value}년</span>} />
            {readyYears.map((year) => (
              <Bar key={year} dataKey={year} fill={colorMap[year]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Replace app/compare/page.tsx**

```typescript
import { fetchAvailableYears } from '@/lib/fetchYears'
import CompareClient from '@/components/CompareClient'

export const dynamic = 'force-dynamic'

export default async function ComparePage() {
  const availableYears = await fetchAvailableYears()
  return <CompareClient availableYears={availableYears} />
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Verify compare tab in browser**

Open http://localhost:3001/compare:
- 2022 checkbox should appear (data exists)
- Click 2022 → loading → line chart and category bar chart appear
- Charts show correct data

- [ ] **Step 6: Commit**

```bash
git add components/CompareClient.tsx components/CompareCharts.tsx app/compare/page.tsx
git commit -m "feat: add year comparison tab with multi-year line and bar charts"
```

---

## Task 12: Pre-deploy DB step + .gitignore

- [ ] **Step 1: Run unique index SQL in Supabase**

Open Supabase dashboard → SQL Editor → run:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS expenses_dedup_key
ON expenses (year, expense_date, category, COALESCE(detail, ''), amount);
```

Expected: Index created successfully.

- [ ] **Step 2: Add .superpowers to .gitignore**

```bash
echo ".superpowers/" >> .gitignore
```

- [ ] **Step 3: Final build verification**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Final browser verification**

Open http://localhost:3001 and verify all 5 tabs:
- `/` — overview with KPI, charts
- `/monthly` — monthly chart + drilldown + category table
- `/compare` — year checkboxes, charts
- `/search` — search filters
- `/admin` → redirects to `/login`; login works; upload + Sheets UI renders; year summary visible

- [ ] **Step 5: Final commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to .gitignore, DB dedup index"
```
