# Local Docker Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Supabase + Vercel 스택을 postgres.js + Auth.js + Docker로 교체하여 미니PC 로컬에서 실행

**Architecture:** Next.js 앱과 PostgreSQL을 각각 Docker 컨테이너로 실행. Supabase JS 클라이언트는 postgres.js(직접 SQL)로, Supabase Auth는 Auth.js Credentials Provider로 교체. 볼륨 마운트로 DB 파일을 호스트에 직접 저장하여 백업 용이하게 구성.

**Tech Stack:** Next.js 14, postgres.js, next-auth v5 (beta), bcryptjs, Docker Compose

---

## Task 1: 패키지 교체

**Files:**
- Modify: `package.json`

**Step 1: Supabase 패키지 제거, 신규 패키지 설치**

```bash
npm uninstall @supabase/ssr @supabase/supabase-js
npm install postgres next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

**Step 2: 설치 확인**

```bash
npm ls postgres next-auth bcryptjs
```

Expected: 세 패키지 모두 표시됨

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: replace supabase with postgres + next-auth + bcryptjs"
```

---

## Task 2: DB 클라이언트 교체 (lib/db.ts)

**Files:**
- Create: `lib/db.ts`
- Delete: `lib/supabase.ts`, `lib/supabase-server.ts`, `lib/supabase-client.ts`

**Step 1: lib/db.ts 생성**

```ts
// lib/db.ts
import 'server-only'
import postgres from 'postgres'

let _sql: ReturnType<typeof postgres> | undefined

function getClient() {
  if (!_sql) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('Missing DATABASE_URL')
    _sql = postgres(url)
  }
  return _sql
}

export function getSql() {
  return getClient()
}
```

**Step 2: 기존 supabase 파일 삭제**

```bash
rm lib/supabase.ts lib/supabase-server.ts lib/supabase-client.ts
```

**Step 3: Commit**

```bash
git add lib/db.ts lib/supabase.ts lib/supabase-server.ts lib/supabase-client.ts
git commit -m "feat: add postgres.js db client, remove supabase clients"
```

---

## Task 3: Auth.js 설정

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`

**Step 1: lib/auth.ts 생성**

```ts
// lib/auth.ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { getSql } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const sql = getSql()
        const [user] = await sql<{ id: string; email: string; password_hash: string }[]>`
          SELECT id, email, password_hash FROM users WHERE email = ${credentials.email as string}
        `
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password as string, user.password_hash)
        if (!valid) return null
        return { id: user.id, email: user.email }
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
})
```

**Step 2: route handler 생성**

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

**Step 3: Commit**

```bash
git add lib/auth.ts app/api/auth/
git commit -m "feat: add Auth.js with credentials provider"
```

---

## Task 4: middleware.ts 교체

**Files:**
- Modify: `middleware.ts`

**Step 1: middleware.ts 전체 교체**

```ts
// middleware.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const isExempt = pathname.startsWith('/login') || pathname.startsWith('/api/auth')

  if (!isLoggedIn && !isExempt) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: replace supabase auth middleware with auth.js"
```

---

## Task 5: 로그인 페이지 교체

**Files:**
- Modify: `app/login/page.tsx`

**Step 1: login page 전체 교체**

```tsx
// app/login/page.tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

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

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
    } else {
      router.push('/')
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

**Step 2: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: replace supabase auth login with next-auth credentials"
```

---

## Task 6: API 라우트 인증 헬퍼 및 공통 패턴

API 라우트에서 Supabase Auth 체크(`createSupabaseServerClient().auth.getUser()`)를 Auth.js로 교체할 때 공통 패턴:

```ts
// 기존 패턴 (삭제)
import { createSupabaseServerClient } from '@/lib/supabase-server'
const client = createSupabaseServerClient()
const { data: { user } } = await client.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// 새 패턴
import { auth } from '@/lib/auth'
const session = await auth()
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

DB 쿼리 패턴:
```ts
// 기존 패턴 (삭제)
import { supabase } from '@/lib/supabase'
const { data } = await supabase.from('table').select('*').order('name')

// 새 패턴
import { getSql } from '@/lib/db'
const sql = getSql()
const data = await sql`SELECT * FROM table ORDER BY name`
```

---

## Task 7: API 라우트 교체 — expenses/summary/category-details

**Files:**
- Modify: `app/api/expenses/route.ts`
- Modify: `app/api/summary/route.ts`
- Modify: `app/api/category-details/route.ts`
- Modify: `app/api/insert/route.ts`
- Modify: `app/api/upload/route.ts`
- Modify: `app/api/sheets/route.ts`
- Modify: `app/api/years/route.ts`

**Step 1: app/api/expenses/route.ts 교체**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const yearStr = params.get('year')
  const category = params.get('category')
  const detail = params.get('detail')
  const month = params.get('month')

  const year = yearStr ? parseInt(yearStr) : null
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  const sql = getSql()

  const rows = await sql`
    SELECT year, month, expense_date, category, detail, memo, method, amount, member
    FROM expenses
    WHERE year = ${year}
    ${category ? sql`AND category = ${category}` : sql``}
    ${detail ? sql`AND detail = ${detail}` : sql``}
    ${month ? sql`AND month = ${parseInt(month)}` : sql``}
    ORDER BY expense_date
  `

  const expenses = rows.map((e: any) => ({
    year: e.year,
    date: e.expense_date ?? '',
    month: e.month,
    category: e.category ?? '',
    detail: e.detail ?? '',
    memo: e.memo ?? '',
    method: e.method ?? '',
    amount: e.amount ?? 0,
    member: e.member ?? null,
  }))

  return NextResponse.json({ expenses })
}
```

**Step 2: app/api/summary/route.ts 교체**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get('year')
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  const sql = getSql()
  const rows = await sql`
    SELECT month, category, SUM(amount) as amount
    FROM expenses
    WHERE year = ${parseInt(year)}
    GROUP BY month, category
    ORDER BY month, category
  `
  return NextResponse.json({ summary: rows })
}
```

**Step 3: app/api/category-details/route.ts 교체**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const year = params.get('year')
  const category = params.get('category')
  if (!year || !category) return NextResponse.json({ error: 'year and category required' }, { status: 400 })

  const sql = getSql()
  const rows = await sql`
    SELECT month, detail, SUM(amount) as amount
    FROM expenses
    WHERE year = ${parseInt(year)} AND category = ${category}
    GROUP BY month, detail
    ORDER BY month, detail
  `
  return NextResponse.json({ details: rows })
}
```

**Step 4: app/api/insert/route.ts 교체**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { year, expenses } = await req.json()
  if (!year || !expenses?.length) return NextResponse.json({ error: 'invalid payload' }, { status: 400 })

  const sql = getSql()
  await sql`DELETE FROM expenses WHERE year = ${year}`

  const toInsert = expenses.map((e: any) => ({
    year: e.year,
    month: e.month,
    expense_date: e.expense_date ?? null,
    category: e.category,
    detail: e.detail ?? '',
    memo: e.memo ?? '',
    method: e.method ?? '',
    amount: e.amount,
    member: e.member ?? null,
  }))

  await sql`INSERT INTO expenses ${sql(toInsert)}`
  return NextResponse.json({ inserted: toInsert.length })
}
```

**Step 5: app/api/upload/route.ts 및 app/api/sheets/route.ts — count 쿼리 교체**

`supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('year', year)` 패턴을:

```ts
const sql = getSql()
const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM expenses WHERE year = ${year}`
```

로 교체. 각 파일에서 `supabase` import를 `getSql` import로 변경 후 해당 라인만 교체.

**Step 6: app/api/years/route.ts 교체**

```ts
import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET() {
  const sql = getSql()
  const rows = await sql`SELECT DISTINCT year FROM expenses ORDER BY year DESC`
  return NextResponse.json({ years: rows.map((r: any) => r.year) })
}
```

**Step 7: Commit**

```bash
git add app/api/expenses/ app/api/summary/ app/api/category-details/ app/api/insert/ app/api/upload/ app/api/sheets/ app/api/years/
git commit -m "feat: migrate expenses API routes to postgres.js"
```

---

## Task 8: API 라우트 교체 — portfolio accounts/securities

**Files:**
- Modify: `app/api/portfolio/accounts/route.ts`
- Modify: `app/api/portfolio/securities/route.ts`
- Modify: `app/api/portfolio/account-securities/route.ts`

**Step 1: app/api/portfolio/accounts/route.ts 교체**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM accounts ORDER BY name`
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, broker, owner, type, currency } = await req.json()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO accounts (name, broker, owner, type, currency)
    VALUES (${name}, ${broker}, ${owner ?? null}, ${type ?? null}, ${currency ?? 'KRW'})
    RETURNING *
  `
  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const sql = getSql()

  const fields = Object.entries(updates)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => sql`${sql(k)} = ${v as any}`)

  if (fields.length === 0) return NextResponse.json({ error: 'no fields' }, { status: 400 })

  const setClauses = fields.reduce((a, b) => sql`${a}, ${b}`)
  const [row] = await sql`UPDATE accounts SET ${setClauses} WHERE id = ${id} RETURNING *`
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const sql = getSql()
  await sql`DELETE FROM accounts WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
```

**Step 2: app/api/portfolio/securities/route.ts 교체**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM securities ORDER BY ticker`
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker, name, asset_class, country, style, sector, currency, url, memo } = await req.json()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO securities (ticker, name, asset_class, country, style, sector, currency, url, memo)
    VALUES (${ticker}, ${name}, ${asset_class ?? null}, ${country ?? null}, ${style ?? null}, ${sector ?? null}, ${currency ?? 'USD'}, ${url ?? null}, ${memo ?? null})
    ON CONFLICT (ticker) DO UPDATE SET
      name = EXCLUDED.name, asset_class = EXCLUDED.asset_class, country = EXCLUDED.country,
      style = EXCLUDED.style, sector = EXCLUDED.sector, currency = EXCLUDED.currency,
      url = EXCLUDED.url, memo = EXCLUDED.memo
    RETURNING *
  `
  return NextResponse.json(row, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...updates } = await req.json()
  const sql = getSql()
  const allowed = ['name','asset_class','country','style','sector','currency','url','memo']
  const fields = Object.entries(updates)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => sql`${sql(k)} = ${v as any}`)

  if (fields.length === 0) return NextResponse.json({ error: 'no fields' }, { status: 400 })
  const setClauses = fields.reduce((a, b) => sql`${a}, ${b}`)
  const [row] = await sql`UPDATE securities SET ${setClauses} WHERE id = ${id} RETURNING *`
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  const sql = getSql()
  await sql`DELETE FROM securities WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
```

**Step 3: app/api/portfolio/account-securities/route.ts 교체**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM account_securities`
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_id } = await req.json()
  const sql = getSql()
  await sql`
    INSERT INTO account_securities (account_id, security_id)
    VALUES (${account_id}, ${security_id})
    ON CONFLICT (account_id, security_id) DO NOTHING
  `
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_ids } = await req.json()
  const sql = getSql()
  await sql`DELETE FROM account_securities WHERE account_id = ${account_id}`
  if (security_ids?.length) {
    const rows = security_ids.map((sid: string) => ({ account_id, security_id: sid }))
    await sql`INSERT INTO account_securities ${sql(rows)}`
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_id } = await req.json()
  const sql = getSql()
  await sql`DELETE FROM account_securities WHERE account_id = ${account_id} AND security_id = ${security_id}`
  return NextResponse.json({ ok: true })
}
```

**Step 4: Commit**

```bash
git add app/api/portfolio/accounts/ app/api/portfolio/securities/ app/api/portfolio/account-securities/
git commit -m "feat: migrate accounts/securities/account-securities API routes to postgres.js"
```

---

## Task 9: API 라우트 교체 — portfolio snapshots/holdings

**Files:**
- Modify: `app/api/portfolio/snapshots/route.ts`
- Modify: `app/api/portfolio/snapshots/[id]/route.ts`
- Modify: `app/api/portfolio/holdings/route.ts`

**Step 1: app/api/portfolio/snapshots/route.ts 교체**

```ts
import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM snapshots ORDER BY date DESC`
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, memo, clone_from } = await req.json()
  const sql = getSql()

  const [snapshot] = await sql`
    INSERT INTO snapshots (date, memo)
    VALUES (${date ?? new Date().toISOString().slice(0, 10)}, ${memo ?? null})
    RETURNING *
  `

  if (clone_from) {
    const sourceHoldings = await sql`
      SELECT account_id, security_id, quantity, avg_price, total_invested, source
      FROM holdings
      WHERE snapshot_id = ${clone_from} AND quantity > 0
    `
    if (sourceHoldings.length > 0) {
      const cloned = sourceHoldings.map((h: any) => ({
        ...h,
        snapshot_id: snapshot.id,
        snapshot_date: snapshot.date,
        updated_at: new Date().toISOString(),
      }))
      try {
        await sql`INSERT INTO holdings ${sql(cloned)}`
      } catch {
        await sql`DELETE FROM snapshots WHERE id = ${snapshot.id}`
        return NextResponse.json({ error: 'clone failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json(snapshot, { status: 201 })
}
```

**Step 2: app/api/portfolio/snapshots/[id]/route.ts 교체**

```ts
import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const sql = getSql()
  const data = await sql`
    SELECT h.*, 
      row_to_json(s) as security,
      row_to_json(a) as account
    FROM holdings h
    JOIN securities s ON s.id = h.security_id
    JOIN accounts a ON a.id = h.account_id
    WHERE h.snapshot_id = ${params.id} AND h.quantity > 0
    ORDER BY h.account_id
  `
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = getSql()
  await sql`DELETE FROM holdings WHERE snapshot_id = ${params.id}`
  await sql`DELETE FROM snapshots WHERE id = ${params.id}`
  return NextResponse.json({ ok: true })
}
```

**Step 3: app/api/portfolio/holdings/route.ts 교체**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`
    SELECT h.*,
      row_to_json(a) as account,
      row_to_json(s) as security
    FROM holdings h
    JOIN accounts a ON a.id = h.account_id
    JOIN securities s ON s.id = h.security_id
    ORDER BY h.updated_at DESC
  `
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_id, quantity, avg_price, total_invested, snapshot_date, snapshot_id } = await req.json()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO holdings (account_id, security_id, quantity, avg_price, total_invested, snapshot_date, snapshot_id, source, updated_at)
    VALUES (${account_id}, ${security_id}, ${quantity}, ${avg_price ?? null}, ${total_invested ?? null}, ${snapshot_date}, ${snapshot_id}, 'manual', NOW())
    ON CONFLICT (account_id, security_id, snapshot_id) DO UPDATE SET
      quantity = EXCLUDED.quantity,
      avg_price = EXCLUDED.avg_price,
      total_invested = EXCLUDED.total_invested,
      snapshot_date = EXCLUDED.snapshot_date,
      updated_at = NOW()
    RETURNING *
  `
  return NextResponse.json(row, { status: 201 })
}
```

**Step 4: Commit**

```bash
git add app/api/portfolio/snapshots/ app/api/portfolio/holdings/
git commit -m "feat: migrate snapshots/holdings API routes to postgres.js"
```

---

## Task 10: API 라우트 교체 — dividends/sells/targets/prices/import

**Files:**
- Modify: `app/api/portfolio/dividends/route.ts`
- Modify: `app/api/portfolio/sells/route.ts`
- Modify: `app/api/portfolio/targets/route.ts`
- Modify: `app/api/portfolio/prices/refresh/ticker/route.ts`
- Modify: `app/api/portfolio/import/route.ts`

**Step 1: dividends/route.ts 교체**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`
    SELECT d.*,
      json_build_object('ticker', s.ticker, 'name', s.name) as security,
      json_build_object('name', a.name, 'broker', a.broker) as account
    FROM dividends d
    JOIN securities s ON s.id = d.security_id
    JOIN accounts a ON a.id = d.account_id
    ORDER BY d.paid_at DESC
  `
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { security_id, account_id, paid_at, amount, currency, tax, memo } = await req.json()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO dividends (security_id, account_id, paid_at, amount, currency, tax, memo)
    VALUES (${security_id}, ${account_id}, ${paid_at}, ${amount}, ${currency ?? 'USD'}, ${tax ?? null}, ${memo ?? null})
    RETURNING *
  `
  return NextResponse.json(row, { status: 201 })
}
```

**Step 2: sells/route.ts 교체**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`
    SELECT sl.*,
      json_build_object('ticker', s.ticker, 'name', s.name) as security,
      json_build_object('name', a.name, 'broker', a.broker) as account
    FROM sells sl
    JOIN securities s ON s.id = sl.security_id
    JOIN accounts a ON a.id = sl.account_id
    ORDER BY sl.sold_at DESC
  `
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { security_id, account_id, sold_at, quantity, avg_cost_krw, sell_price_krw, realized_pnl_krw, memo } = await req.json()
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO sells (security_id, account_id, sold_at, quantity, avg_cost_krw, sell_price_krw, realized_pnl_krw, memo)
    VALUES (${security_id}, ${account_id}, ${sold_at}, ${quantity}, ${avg_cost_krw ?? null}, ${sell_price_krw ?? null}, ${realized_pnl_krw ?? null}, ${memo ?? null})
    RETURNING *
  `
  return NextResponse.json(row, { status: 201 })
}
```

**Step 3: targets/route.ts 교체**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  const data = await sql`SELECT * FROM target_allocations ORDER BY level, key`
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const sql = getSql()
  await sql`
    INSERT INTO target_allocations ${sql(body)}
    ON CONFLICT (level, key) DO UPDATE SET target_pct = EXCLUDED.target_pct
  `
  return NextResponse.json({ ok: true })
}
```

**Step 4: prices/refresh/ticker/route.ts — upsert 교체**

해당 파일에서 `supabase.from('price_history').upsert(...)` 부분만 교체:

```ts
await sql`
  INSERT INTO price_history (ticker, date, price, currency)
  VALUES (${ticker}, ${date}, ${price}, ${currency})
  ON CONFLICT (ticker, date) DO UPDATE SET price = EXCLUDED.price, currency = EXCLUDED.currency
`
```

**Step 5: import/route.ts 교체**

Supabase upsert/select/insert 패턴을 SQL로 교체:

```ts
// securities upsert
const securitiesResult = await sql`
  INSERT INTO securities ${sql(securitiesPayload)}
  ON CONFLICT (ticker) DO UPDATE SET name = EXCLUDED.name, ...
  RETURNING id, ticker
`

// accounts find-or-create
let [account] = await sql`SELECT id FROM accounts WHERE broker = ${broker} AND type = ${accType}`
if (!account) {
  [account] = await sql`INSERT INTO accounts (name, broker, owner, type) VALUES (...) RETURNING id`
}

// holdings upsert
await sql`
  INSERT INTO holdings ${sql(holdingsPayload)}
  ON CONFLICT (account_id, security_id) DO UPDATE SET ...
`
```

실제 import/route.ts 파일을 읽어서 구체적인 payload 구조에 맞게 조정 필요.

**Step 6: Commit**

```bash
git add app/api/portfolio/dividends/ app/api/portfolio/sells/ app/api/portfolio/targets/ app/api/portfolio/prices/ app/api/portfolio/import/
git commit -m "feat: migrate remaining portfolio API routes to postgres.js"
```

---

## Task 11: users 테이블 마이그레이션 스크립트

**Files:**
- Create: `scripts/setup-auth.ts`

**Step 1: scripts/setup-auth.ts 생성**

```ts
// scripts/setup-auth.ts
// 실행: npx tsx --env-file=.env.local scripts/setup-auth.ts
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

const sql = postgres(process.env.DATABASE_URL!)

async function main() {
  // users 테이블 생성
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email         text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      created_at    timestamptz DEFAULT now()
    )
  `
  console.log('users table created')

  // 기존 Supabase 계정 이메일/비밀번호로 초기 유저 생성
  // 환경변수 ADMIN_EMAIL, ADMIN_PASSWORD로 주입
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    console.log('Set ADMIN_EMAIL and ADMIN_PASSWORD to create initial user')
    await sql.end()
    return
  }

  const hash = await bcrypt.hash(password, 12)
  await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${hash})
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `
  console.log(`User created: ${email}`)
  await sql.end()
}

main().catch(console.error)
```

**Step 2: package.json에 스크립트 추가**

```json
"setup-auth": "tsx --env-file=.env.local scripts/setup-auth.ts"
```

**Step 3: Commit**

```bash
git add scripts/setup-auth.ts package.json
git commit -m "feat: add users table setup script for auth.js"
```

---

## Task 12: Dockerfile 작성

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

**Step 1: next.config.mjs에 standalone 출력 추가**

```js
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['xlsx'],
    serverActions: { bodySizeLimit: '20mb' },
  },
}
```

**Step 2: Dockerfile 생성**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**Step 3: .dockerignore 생성**

```
.git
node_modules
.next
.env*
data/
```

**Step 4: Commit**

```bash
git add Dockerfile .dockerignore next.config.mjs
git commit -m "feat: add dockerfile with next.js standalone build"
```

---

## Task 13: docker-compose.yml 작성

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

**Step 1: docker-compose.yml 생성**

```yaml
services:
  db:
    image: postgres:16-alpine
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: ledger
      POSTGRES_USER: ledger
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ledger"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://ledger:${DB_PASSWORD}@db:5432/ledger
      AUTH_SECRET: ${AUTH_SECRET}
      NEXTAUTH_URL: https://fin.lakipiece.com
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
```

**Step 2: .env.example 생성**

```env
# docker compose용 환경변수
# cp .env.example .env 후 값 채우기

DB_PASSWORD=your-strong-password-here
AUTH_SECRET=   # openssl rand -base64 32

# Next.js 앱에서 추가로 필요한 환경변수가 있으면 app.environment에 추가
```

**Step 3: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: add docker-compose with volume-mounted postgres"
```

---

## Task 14: DB 마이그레이션 (Supabase → 로컬 PostgreSQL)

미니PC에서 실행.

**Step 1: Supabase에서 DB 덤프 (로컬 개발 머신에서)**

```bash
# Supabase 프로젝트 DB URL은 Supabase 대시보드 > Settings > Database에서 확인
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  --no-owner --no-acl \
  -t expenses -t accounts -t securities -t holdings \
  -t snapshots -t sells -t dividends -t target_allocations \
  -t price_history -t account_securities \
  > dump.sql
```

**Step 2: 미니PC에서 Docker 실행 및 복원**

```bash
# data 디렉토리 생성
mkdir -p data/postgres

# .env 파일 생성
cp .env.example .env
# DB_PASSWORD, AUTH_SECRET 값 채우기

# DB 컨테이너만 먼저 실행
docker compose up db -d

# dump 복원
cat dump.sql | docker compose exec -T db psql -U ledger ledger

# users 테이블 생성 + 초기 유저 생성
ADMIN_EMAIL=your@email.com ADMIN_PASSWORD=yourpassword npm run setup-auth
```

**Step 3: 앱 실행**

```bash
docker compose up -d --build
```

**Step 4: 확인**

```bash
# 로그 확인
docker compose logs -f app

# 브라우저에서 http://localhost:3000 접속 후 로그인 테스트
```

---

## Task 15: .env.local 정리 및 빌드 확인

**Files:**
- Modify: `.env.local` (또는 `.env.local.example`)

**Step 1: .env.local.example 업데이트**

```env
# 로컬 개발용
DATABASE_URL=postgresql://ledger:password@localhost:5432/ledger
AUTH_SECRET=dev-secret-at-least-32-chars-long
NEXTAUTH_URL=http://localhost:3000
```

**Step 2: 로컬 빌드 테스트**

```bash
npm run build
```

Expected: 에러 없이 빌드 성공

**Step 3: Commit**

```bash
git add .env.local.example
git commit -m "chore: update env example for postgres+authjs"
```

---

## 완료 후 Cloudflare Tunnel 설정

미니PC의 Cloudflare Tunnel 설정에서 `fin.lakipiece.com` → `localhost:3000` 라우팅 추가.

기존 WordPress 등 다른 서비스와 동일한 방식으로 추가하면 됨.

---

## 백업 방법 (참고)

```bash
# 파일 시스템 백업 (DB 중지 후)
docker compose stop db
cp -r data/postgres data/postgres-backup-$(date +%Y%m%d)
docker compose start db

# 논리 백업 (운영 중에도 가능)
docker compose exec db pg_dump -U ledger ledger > backup-$(date +%Y%m%d).sql
```
