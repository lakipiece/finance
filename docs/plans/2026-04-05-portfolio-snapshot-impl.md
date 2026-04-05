# Portfolio Snapshot Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 포트폴리오 관리를 스냅샷 기반으로 전환하고, 매도/배당 수익 관리와 상단 네비게이션 구조를 개선한다.

**Architecture:** `snapshots` 테이블이 holdings 그룹을 묶는 앵커 역할. `holdings`에 `snapshot_id` 추가. 매도(`sells`)·배당(`dividends`) 별도 테이블. HeaderBar에서 가계부/포트폴리오 최상위 전환, PortfolioNav를 4개 메뉴로 재편.

**Tech Stack:** Next.js 14 App Router, Supabase (서버 클라이언트), Recharts, TailwindCSS, TypeScript

---

## Task 1: Supabase — 신규 테이블 DDL

**Files:**
- Create: `docs/sql/2026-04-05-snapshot-migration.sql`

**Step 1: SQL 파일 작성**

```sql
-- 1. 스냅샷 그룹 테이블
CREATE TABLE snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 2. 매도 기록
CREATE TABLE sells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES snapshots(id),
  security_id uuid REFERENCES securities(id) NOT NULL,
  account_id uuid REFERENCES accounts(id) NOT NULL,
  sold_at date NOT NULL,
  quantity numeric NOT NULL,
  avg_cost_krw numeric,
  sell_price_krw numeric,
  realized_pnl_krw numeric,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 3. 배당/분배금
CREATE TABLE dividends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id uuid REFERENCES securities(id) NOT NULL,
  account_id uuid REFERENCES accounts(id) NOT NULL,
  paid_at date NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  tax numeric NOT NULL DEFAULT 0,
  memo text,
  created_at timestamptz DEFAULT now()
);

-- 4. holdings에 snapshot_id 추가
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS snapshot_id uuid REFERENCES snapshots(id);

-- 5. 기존 holdings → 초기 스냅샷으로 마이그레이션
WITH initial AS (
  INSERT INTO snapshots (date, memo)
  SELECT MAX(snapshot_date), '초기 마이그레이션'
  FROM holdings
  RETURNING id
)
UPDATE holdings
SET snapshot_id = (SELECT id FROM initial)
WHERE snapshot_id IS NULL;
```

**Step 2: Supabase SQL 에디터에서 실행**

위 SQL을 Supabase Dashboard > SQL Editor에서 직접 실행. 오류 없이 완료되면 다음 스텝.

**Step 3: 확인**

```sql
SELECT COUNT(*) FROM snapshots;       -- 1 이상
SELECT COUNT(*) FROM holdings WHERE snapshot_id IS NOT NULL;  -- 전체 holdings 수
```

**Step 4: Commit**

```bash
git add docs/sql/2026-04-05-snapshot-migration.sql
git commit -m "sql: snapshot migration DDL"
```

---

## Task 2: TypeScript 타입 추가

**Files:**
- Modify: `lib/portfolio/types.ts`

**Step 1: 타입 추가**

`lib/portfolio/types.ts` 파일 하단에 추가:

```typescript
export interface Snapshot {
  id: string
  date: string
  memo: string | null
  created_at: string
}

export interface Sell {
  id: string
  snapshot_id: string | null
  security_id: string
  account_id: string
  sold_at: string
  quantity: number
  avg_cost_krw: number | null
  sell_price_krw: number | null
  realized_pnl_krw: number | null
  memo: string | null
  security?: Security
  account?: Account
}

export interface Dividend {
  id: string
  security_id: string
  account_id: string
  paid_at: string
  amount: number
  currency: string
  tax: number
  memo: string | null
  security?: Security
  account?: Account
}

export interface SnapshotWithStats {
  snapshot: Snapshot
  total_market_value: number
  prev_market_value: number | null  // 직전 스냅샷 평가금액 (없으면 null)
}
```

기존 `Holding` 인터페이스에 필드 추가:

```typescript
// 기존 Holding 인터페이스의 기존 필드들 유지하고 아래 추가
snapshot_id?: string | null
```

**Step 2: Commit**

```bash
git add lib/portfolio/types.ts
git commit -m "feat: add Snapshot, Sell, Dividend types"
```

---

## Task 3: 네비게이션 — 최상위 가계부/포트폴리오 전환

**Files:**
- Modify: `components/HeaderBar.tsx`
- Modify: `components/TabNav.tsx`
- Create: `components/TopModeToggle.tsx`

**Step 1: TopModeToggle 컴포넌트 작성**

```typescript
// components/TopModeToggle.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function TopModeToggle() {
  const pathname = usePathname()
  const isPortfolio = pathname.startsWith('/portfolio')

  return (
    <div className="flex items-center gap-1 bg-white/10 rounded-full p-0.5">
      <Link
        href="/"
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
          !isPortfolio ? 'bg-white text-slate-700' : 'text-white/70 hover:text-white'
        }`}
      >
        가계부
      </Link>
      <Link
        href="/portfolio"
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
          isPortfolio ? 'bg-white text-slate-700' : 'text-white/70 hover:text-white'
        }`}
      >
        포트폴리오
      </Link>
    </div>
  )
}
```

**Step 2: HeaderBar 수정**

```typescript
// components/HeaderBar.tsx
'use client'

import TabNav from './TabNav'
import TopModeToggle from './TopModeToggle'
import YearPicker from './YearPicker'
import { useTheme } from '@/lib/ThemeContext'
import { usePathname } from 'next/navigation'

export default function HeaderBar() {
  const { palette } = useTheme()
  const pathname = usePathname()
  const isPortfolio = pathname.startsWith('/portfolio')

  return (
    <header
      className="text-white py-4 px-4 md:px-6 shadow-lg"
      style={{ background: palette.headerGradient }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-white/60 text-[10px] md:text-xs font-medium tracking-widest mb-0.5">
                HOUSEHOLD LEDGER
              </p>
              <h1 className="text-lg md:text-2xl font-bold">
                {isPortfolio ? '포트폴리오' : '가계부 대시보드'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <TopModeToggle />
            {!isPortfolio && <YearPicker />}
          </div>
        </div>
        <TabNav />
      </div>
    </header>
  )
}
```

**Step 3: TabNav 수정 — 모드별 탭 분리**

```typescript
// components/TabNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LEDGER_TABS = [
  { label: '대시보드', href: '/' },
  { label: '연도비교', href: '/compare' },
  { label: '검색', href: '/search' },
  { label: '관리', href: '/admin' },
]

const PORTFOLIO_TABS = [
  { label: '대시보드', href: '/portfolio' },
  { label: '스냅샷', href: '/portfolio/snapshots' },
  { label: '수익', href: '/portfolio/income' },
  { label: '관리', href: '/portfolio/settings' },
]

export default function TabNav() {
  const pathname = usePathname()
  const isPortfolio = pathname.startsWith('/portfolio')
  const tabs = isPortfolio ? PORTFOLIO_TABS : LEDGER_TABS

  return (
    <nav className="flex gap-1" aria-label="탭 네비게이션">
      {tabs.map((tab) => {
        const active = tab.href === '/' || tab.href === '/portfolio'
          ? pathname === tab.href
          : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
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

**Step 4: PortfolioNav 삭제 (TabNav가 대체)**

`app/portfolio/layout.tsx`에서 PortfolioNav 제거:

```typescript
// app/portfolio/layout.tsx
export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

**Step 5: 빌드 확인**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add components/HeaderBar.tsx components/TabNav.tsx components/TopModeToggle.tsx app/portfolio/layout.tsx
git commit -m "feat: top-level 가계부/포트폴리오 navigation toggle"
```

---

## Task 4: Snapshot API Routes

**Files:**
- Create: `app/api/portfolio/snapshots/route.ts`
- Create: `app/api/portfolio/snapshots/[id]/route.ts`

**Step 1: 목록 조회 + 생성 API**

```typescript
// app/api/portfolio/snapshots/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase
    .from('snapshots')
    .select('*')
    .order('date', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { date, memo, clone_from } = body  // clone_from: 복제할 snapshot_id

  // 스냅샷 레코드 생성
  const { data: snapshot, error } = await supabase
    .from('snapshots')
    .insert({ date: date ?? new Date().toISOString().slice(0, 10), memo })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // clone_from이 있으면 해당 스냅샷의 holdings 복제
  if (clone_from) {
    const { data: sourceHoldings } = await supabase
      .from('holdings')
      .select('account_id, security_id, quantity, avg_price, total_invested, source')
      .eq('snapshot_id', clone_from)
      .gt('quantity', 0)

    if (sourceHoldings && sourceHoldings.length > 0) {
      const cloned = sourceHoldings.map(h => ({
        ...h,
        snapshot_id: snapshot.id,
        snapshot_date: snapshot.date,
        updated_at: new Date().toISOString(),
      }))
      await supabase.from('holdings').insert(cloned)
    }
  }

  return NextResponse.json(snapshot, { status: 201 })
}
```

**Step 2: 단일 스냅샷 조회 + 삭제 API**

```typescript
// app/api/portfolio/snapshots/[id]/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { data: holdings } = await supabase
    .from('holdings')
    .select('*, security:securities(*), account:accounts(*)')
    .eq('snapshot_id', params.id)
    .gt('quantity', 0)
    .order('account_id')
  return NextResponse.json(holdings ?? [])
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase.from('holdings').delete().eq('snapshot_id', params.id)
  await supabase.from('snapshots').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}
```

**Step 3: Commit**

```bash
git add app/api/portfolio/snapshots/
git commit -m "feat: snapshot CRUD API routes"
```

---

## Task 5: Sells / Dividends API Routes

**Files:**
- Create: `app/api/portfolio/sells/route.ts`
- Create: `app/api/portfolio/dividends/route.ts`

**Step 1: Sells API**

```typescript
// app/api/portfolio/sells/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase
    .from('sells')
    .select('*, security:securities(ticker,name), account:accounts(name,broker)')
    .order('sold_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { security_id, account_id, sold_at, quantity, avg_cost_krw, sell_price_krw, realized_pnl_krw, memo } = body
  if (!security_id || !account_id || !sold_at || !quantity) {
    return NextResponse.json({ error: 'security_id, account_id, sold_at, quantity 필수' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sells')
    .insert({ security_id, account_id, sold_at, quantity, avg_cost_krw, sell_price_krw, realized_pnl_krw, memo })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 2: Dividends API**

```typescript
// app/api/portfolio/dividends/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase
    .from('dividends')
    .select('*, security:securities(ticker,name), account:accounts(name,broker)')
    .order('paid_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { security_id, account_id, paid_at, amount, currency, tax, memo } = body
  if (!security_id || !account_id || !paid_at || amount == null) {
    return NextResponse.json({ error: 'security_id, account_id, paid_at, amount 필수' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('dividends')
    .insert({ security_id, account_id, paid_at, amount, currency: currency ?? 'USD', tax: tax ?? 0, memo })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 3: Commit**

```bash
git add app/api/portfolio/sells/ app/api/portfolio/dividends/
git commit -m "feat: sells and dividends API routes"
```

---

## Task 6: 스냅샷 페이지 — 목록 + 만들기

**Files:**
- Create: `app/portfolio/snapshots/page.tsx`
- Create: `components/portfolio/SnapshotList.tsx`

**Step 1: 서버 페이지**

```typescript
// app/portfolio/snapshots/page.tsx
import { supabase } from '@/lib/supabase'
import SnapshotList from '@/components/portfolio/SnapshotList'
import type { Snapshot } from '@/lib/portfolio/types'

export const dynamic = 'force-dynamic'

export default async function SnapshotsPage() {
  const { data } = await supabase
    .from('snapshots')
    .select('*')
    .order('date', { ascending: false })

  return <SnapshotList snapshots={(data ?? []) as Snapshot[]} />
}
```

**Step 2: SnapshotList 클라이언트 컴포넌트**

```typescript
// components/portfolio/SnapshotList.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Snapshot } from '@/lib/portfolio/types'

interface Props { snapshots: Snapshot[] }

function fmt(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

export default function SnapshotList({ snapshots }: Props) {
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  async function handleCreate() {
    setCreating(true)
    const latest = snapshots[0]
    const res = await fetch('/api/portfolio/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        clone_from: latest?.id ?? null,
      }),
    })
    const snap = await res.json()
    setCreating(false)
    router.push(`/portfolio/snapshots/${snap.id}`)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-800">스냅샷</h2>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {creating ? '생성 중...' : '+ 스냅샷 만들기'}
        </button>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-12">
          아직 스냅샷이 없습니다. 첫 번째 스냅샷을 만들어보세요.
        </p>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snap, i) => (
            <div
              key={snap.id}
              onClick={() => router.push(`/portfolio/snapshots/${snap.id}`)}
              className="bg-white rounded-xl border border-slate-100 px-5 py-4 flex items-center justify-between cursor-pointer hover:shadow-sm transition-shadow"
            >
              <div>
                <p className="font-semibold text-slate-800">{snap.date}</p>
                {snap.memo && <p className="text-xs text-slate-400 mt-0.5">{snap.memo}</p>}
              </div>
              <div className="text-right">
                {i === 0 && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">최신</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add app/portfolio/snapshots/page.tsx components/portfolio/SnapshotList.tsx
git commit -m "feat: snapshot list page"
```

---

## Task 7: 스냅샷 편집 페이지

**Files:**
- Create: `app/portfolio/snapshots/[id]/page.tsx`
- Create: `components/portfolio/SnapshotEditor.tsx`

**Step 1: 편집 페이지 (서버)**

```typescript
// app/portfolio/snapshots/[id]/page.tsx
import { supabase } from '@/lib/supabase'
import SnapshotEditor from '@/components/portfolio/SnapshotEditor'

export const dynamic = 'force-dynamic'

export default async function SnapshotEditPage({ params }: { params: { id: string } }) {
  const [{ data: snapshot }, { data: holdingsRaw }, { data: accounts }, { data: securities }] = await Promise.all([
    supabase.from('snapshots').select('*').eq('id', params.id).single(),
    supabase.from('holdings').select('*').eq('snapshot_id', params.id).gt('quantity', 0),
    supabase.from('accounts').select('*').order('name'),
    supabase.from('securities').select('*').order('ticker'),
  ])

  if (!snapshot) return <p className="p-8 text-slate-400">스냅샷을 찾을 수 없습니다.</p>

  return (
    <SnapshotEditor
      snapshot={snapshot}
      holdings={holdingsRaw ?? []}
      accounts={accounts ?? []}
      securities={securities ?? []}
    />
  )
}
```

**Step 2: SnapshotEditor 클라이언트 컴포넌트**

```typescript
// components/portfolio/SnapshotEditor.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Snapshot, Account, Security } from '@/lib/portfolio/types'

interface HoldingRow {
  id?: string
  account_id: string
  security_id: string
  quantity: number
  avg_price: number | null
  total_invested: number | null
}

interface Props {
  snapshot: Snapshot
  holdings: HoldingRow[]
  accounts: Account[]
  securities: Security[]
}

export default function SnapshotEditor({ snapshot, holdings, accounts, securities }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<HoldingRow[]>(holdings)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const secMap = Object.fromEntries(securities.map(s => [s.id, s]))
  const accMap = Object.fromEntries(accounts.map(a => [a.id, a]))

  // 계좌별 그룹핑
  const grouped = rows.reduce<Record<string, HoldingRow[]>>((acc, r) => {
    if (!acc[r.account_id]) acc[r.account_id] = []
    acc[r.account_id].push(r)
    return acc
  }, {})

  function updateRow(idx: number, field: keyof HoldingRow, value: number | null) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      await Promise.all(rows.map(row =>
        fetch('/api/portfolio/holdings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...row,
            snapshot_id: snapshot.id,
            snapshot_date: snapshot.date,
          }),
        })
      ))
      setMsg('저장 완료')
      router.refresh()
    } catch {
      setMsg('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push('/portfolio/snapshots')}
            className="text-xs text-slate-400 hover:text-slate-600 mb-1">← 목록</button>
          <h2 className="text-lg font-bold text-slate-800">스냅샷 편집 — {snapshot.date}</h2>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">계좌</th>
              <th className="text-left px-4 py-3">종목</th>
              <th className="text-right px-4 py-3">수량</th>
              <th className="text-right px-4 py-3">평균매입가</th>
              <th className="text-right px-4 py-3">투자원금(원)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row, idx) => {
              const sec = secMap[row.security_id]
              const acc = accMap[row.account_id]
              const isUSD = sec?.currency === 'USD'
              return (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs text-slate-500">{acc?.broker} · {acc?.name}</td>
                  <td className="px-4 py-2">
                    <p className="font-semibold text-slate-800">{sec?.ticker}</p>
                    <p className="text-xs text-slate-400">{sec?.name}</p>
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" step="any" value={row.quantity}
                      onChange={e => updateRow(idx, 'quantity', parseFloat(e.target.value))}
                      className="w-24 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 ml-auto block" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <input type="number" step="any" value={row.avg_price ?? ''}
                        onChange={e => updateRow(idx, 'avg_price', e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-28 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
                      <span className="text-xs text-slate-400">{isUSD ? 'USD' : '원'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" step="any" value={row.total_invested ?? ''}
                      onChange={e => updateRow(idx, 'total_invested', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-32 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 block ml-auto" />
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

**Step 3: holdings API에 snapshot_id 지원 추가**

`app/api/portfolio/holdings/route.ts`의 POST 핸들러에서 `snapshot_id`를 body에서 받아 upsert:

```typescript
// 기존 upsert 객체에 snapshot_id 추가
const { snapshot_id } = body
// upsert 오브젝트에:
snapshot_id: snapshot_id ?? undefined,
```

**Step 4: Commit**

```bash
git add app/portfolio/snapshots/[id]/ components/portfolio/SnapshotEditor.tsx app/api/portfolio/holdings/route.ts
git commit -m "feat: snapshot edit page"
```

---

## Task 8: 스냅샷 차트

**Files:**
- Create: `components/portfolio/SnapshotCharts.tsx`
- Modify: `app/portfolio/snapshots/page.tsx`

**Step 1: SnapshotCharts 컴포넌트**

스냅샷이 2개 이상일 때만 렌더링. 서버에서 각 스냅샷별 평가금액을 계산해서 props로 전달.

```typescript
// components/portfolio/SnapshotCharts.tsx
'use client'

import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

interface SnapshotPoint {
  date: string
  total_market_value: number
  breakdown: Record<string, number>  // ticker or asset_class → value
}

interface Props { points: SnapshotPoint[] }

function fmtY(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(0)}억`
  if (v >= 10_000) return `${Math.floor(v / 10_000)}만`
  return String(v)
}

export default function SnapshotCharts({ points }: Props) {
  const [mode, setMode] = useState<'asset_class' | 'ticker'>('asset_class')
  if (points.length < 2) return null

  const keys = [...new Set(points.flatMap(p => Object.keys(p.breakdown)))]
  const COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899','#14b8a6']

  return (
    <div className="space-y-6 mt-8">
      {/* 라인 차트: 총 평가금액 추이 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">총 평가금액 추이</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtY} tick={{ fontSize: 11 }} width={60} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString()}원`, '평가금액']} />
            <Line type="monotone" dataKey="total_market_value" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 스택 바: 비중 변화 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-600">구성 비중 변화</h3>
          <div className="flex gap-2">
            <button onClick={() => setMode('asset_class')}
              className={`text-xs px-2 py-1 rounded-full ${mode === 'asset_class' ? 'bg-slate-200 text-slate-700' : 'text-slate-400'}`}>
              자산군
            </button>
            <button onClick={() => setMode('ticker')}
              className={`text-xs px-2 py-1 rounded-full ${mode === 'ticker' ? 'bg-slate-200 text-slate-700' : 'text-slate-400'}`}>
              종목
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={40} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={`breakdown.${k}`} name={k} stackId="a"
                fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

**Step 2: 페이지에서 차트 데이터 계산 후 전달**

`app/portfolio/snapshots/page.tsx`에서 각 스냅샷의 holdings와 price_history를 조인해 평가금액 계산 후 `SnapshotCharts`에 전달. (복잡도를 고려해 최신 5개 스냅샷만 처리)

**Step 3: Commit**

```bash
git add components/portfolio/SnapshotCharts.tsx app/portfolio/snapshots/page.tsx
git commit -m "feat: snapshot history charts"
```

---

## Task 9: 수익 페이지 — 매도 + 배당

**Files:**
- Create: `app/portfolio/income/page.tsx`
- Create: `components/portfolio/IncomeDashboard.tsx`

**Step 1: 서버 페이지**

```typescript
// app/portfolio/income/page.tsx
import { supabase } from '@/lib/supabase'
import IncomeDashboard from '@/components/portfolio/IncomeDashboard'

export const dynamic = 'force-dynamic'

export default async function IncomePage() {
  const [{ data: sells }, { data: dividends }, { data: securities }, { data: accounts }] = await Promise.all([
    supabase.from('sells').select('*, security:securities(ticker,name), account:accounts(name,broker)').order('sold_at', { ascending: false }),
    supabase.from('dividends').select('*, security:securities(ticker,name), account:accounts(name,broker)').order('paid_at', { ascending: false }),
    supabase.from('securities').select('id,ticker,name').order('ticker'),
    supabase.from('accounts').select('id,name,broker').order('name'),
  ])

  return (
    <IncomeDashboard
      sells={sells ?? []}
      dividends={dividends ?? []}
      securities={securities ?? []}
      accounts={accounts ?? []}
    />
  )
}
```

**Step 2: IncomeDashboard 클라이언트 컴포넌트**

KPI 카드 + 매도/배당 탭 전환 + 각 기록 테이블 + 입력 폼 + 월별 바 차트.

```typescript
// components/portfolio/IncomeDashboard.tsx
'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import type { Sell, Dividend, Security, Account } from '@/lib/portfolio/types'

interface Props {
  sells: (Sell & { security: Security; account: Account })[]
  dividends: (Dividend & { security: Security; account: Account })[]
  securities: Pick<Security, 'id' | 'ticker' | 'name'>[]
  accounts: Pick<Account, 'id' | 'name' | 'broker'>[]
}

function fmt(n: number) {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (Math.abs(n) >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

// 월별 집계 헬퍼
function groupByMonth<T extends { date: string; value: number }>(items: T[]) {
  const map: Record<string, number> = {}
  items.forEach(({ date, value }) => {
    const month = date.slice(0, 7)  // YYYY-MM
    map[month] = (map[month] ?? 0) + value
  })
  return Object.entries(map).sort().map(([month, value]) => ({ month, value }))
}

export default function IncomeDashboard({ sells, dividends, securities, accounts }: Props) {
  const [tab, setTab] = useState<'sells' | 'dividends'>('sells')
  const [refreshing, setRefreshing] = useState(false)

  // KPI
  const totalPnl = sells.reduce((s, r) => s + (r.realized_pnl_krw ?? 0), 0)
  const totalDiv = dividends.reduce((s, d) => s + (d.currency === 'USD' ? d.amount * 1350 : d.amount), 0)

  // 월별 차트 데이터
  const sellChartData = groupByMonth(sells.map(s => ({ date: s.sold_at, value: s.realized_pnl_krw ?? 0 })))
  const divChartData = groupByMonth(dividends.map(d => ({ date: d.paid_at, value: d.currency === 'USD' ? d.amount * 1350 : d.amount })))

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '총 실현손익', value: totalPnl, color: totalPnl >= 0 ? 'text-rose-500' : 'text-blue-500' },
          { label: '총 배당수익', value: totalDiv, color: 'text-emerald-600' },
          { label: '합산 수익', value: totalPnl + totalDiv, color: 'text-slate-800' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-100 px-5 py-4">
            <p className="text-xs text-slate-400 mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{fmt(k.value)}원</p>
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-2">
        {(['sells', 'dividends'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-700'}`}>
            {t === 'sells' ? '매도 기록' : '배당 기록'}
          </button>
        ))}
      </div>

      {/* 차트 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">
          {tab === 'sells' ? '월별 실현손익' : '월별 배당수익'}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={tab === 'sells' ? sellChartData : divChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11 }} width={60} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString()}원`]} />
            <Bar dataKey="value" fill={tab === 'sells' ? '#6366f1' : '#10b981'} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 테이블 */}
      {tab === 'sells' ? (
        <SellsTable sells={sells} securities={securities} accounts={accounts} />
      ) : (
        <DividendsTable dividends={dividends} securities={securities} accounts={accounts} />
      )}
    </div>
  )
}

// 매도 기록 테이블 + 폼 (별도 컴포넌트로 분리)
function SellsTable({ sells, securities, accounts }: {
  sells: (Sell & { security: Security; account: Account })[]
  securities: Pick<Security, 'id' | 'ticker' | 'name'>[]
  accounts: Pick<Account, 'id' | 'name' | 'broker'>[]
}) {
  const [form, setForm] = useState({ security_id: '', account_id: '', sold_at: '', quantity: '', avg_cost_krw: '', sell_price_krw: '', realized_pnl_krw: '', memo: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/portfolio/sells', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        quantity: parseFloat(form.quantity),
        avg_cost_krw: form.avg_cost_krw ? parseFloat(form.avg_cost_krw) : null,
        sell_price_krw: form.sell_price_krw ? parseFloat(form.sell_price_krw) : null,
        realized_pnl_krw: form.realized_pnl_krw ? parseFloat(form.realized_pnl_krw) : null,
      }),
    })
    setMsg(res.ok ? '저장 완료' : '저장 실패')
    setSaving(false)
    if (res.ok) window.location.reload()
  }

  return (
    <div className="space-y-4">
      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">매도 기록 추가</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select required value={form.security_id} onChange={e => setForm(p => ({ ...p, security_id: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300">
            <option value="">종목 선택</option>
            {securities.map(s => <option key={s.id} value={s.id}>{s.ticker} {s.name}</option>)}
          </select>
          <select required value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300">
            <option value="">계좌 선택</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.broker} {a.name}</option>)}
          </select>
          <input type="date" required value={form.sold_at} onChange={e => setForm(p => ({ ...p, sold_at: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          <input type="number" step="any" required placeholder="수량" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          <input type="number" step="any" placeholder="평균매입단가(원)" value={form.avg_cost_krw} onChange={e => setForm(p => ({ ...p, avg_cost_krw: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          <input type="number" step="any" placeholder="매도가(원)" value={form.sell_price_krw} onChange={e => setForm(p => ({ ...p, sell_price_krw: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          <input type="number" step="any" placeholder="실현손익(원)" value={form.realized_pnl_krw} onChange={e => setForm(p => ({ ...p, realized_pnl_krw: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          <input type="text" placeholder="메모" value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button type="submit" disabled={saving}
            className="bg-slate-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
            {saving ? '저장 중...' : '추가'}
          </button>
          {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
        </div>
      </form>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">종목</th>
              <th className="text-left px-4 py-3">계좌</th>
              <th className="text-right px-4 py-3">매도일</th>
              <th className="text-right px-4 py-3">수량</th>
              <th className="text-right px-4 py-3">평균단가</th>
              <th className="text-right px-4 py-3">매도가</th>
              <th className="text-right px-4 py-3">실현손익</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sells.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{s.security.ticker}</p>
                  <p className="text-xs text-slate-400">{s.security.name}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{s.account.broker} · {s.account.name}</td>
                <td className="px-4 py-3 text-right text-slate-500">{s.sold_at}</td>
                <td className="px-4 py-3 text-right font-mono">{s.quantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-600">{s.avg_cost_krw ? `${fmt(s.avg_cost_krw)}원` : '-'}</td>
                <td className="px-4 py-3 text-right text-slate-600">{s.sell_price_krw ? `${fmt(s.sell_price_krw)}원` : '-'}</td>
                <td className={`px-4 py-3 text-right font-semibold ${(s.realized_pnl_krw ?? 0) >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                  {s.realized_pnl_krw != null ? `${s.realized_pnl_krw >= 0 ? '+' : ''}${fmt(s.realized_pnl_krw)}원` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// 배당 기록 테이블 + 폼
function DividendsTable({ dividends, securities, accounts }: {
  dividends: (Dividend & { security: Security; account: Account })[]
  securities: Pick<Security, 'id' | 'ticker' | 'name'>[]
  accounts: Pick<Account, 'id' | 'name' | 'broker'>[]
}) {
  const [form, setForm] = useState({ security_id: '', account_id: '', paid_at: '', amount: '', currency: 'USD', tax: '', memo: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/portfolio/dividends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        tax: form.tax ? parseFloat(form.tax) : 0,
      }),
    })
    setMsg(res.ok ? '저장 완료' : '저장 실패')
    setSaving(false)
    if (res.ok) window.location.reload()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">배당/분배금 추가</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select required value={form.security_id} onChange={e => setForm(p => ({ ...p, security_id: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300">
            <option value="">종목 선택</option>
            {securities.map(s => <option key={s.id} value={s.id}>{s.ticker} {s.name}</option>)}
          </select>
          <select required value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300">
            <option value="">계좌 선택</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.broker} {a.name}</option>)}
          </select>
          <input type="date" required value={form.paid_at} onChange={e => setForm(p => ({ ...p, paid_at: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          <input type="number" step="any" required placeholder="금액" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300">
            <option value="USD">USD</option>
            <option value="KRW">KRW</option>
          </select>
          <input type="number" step="any" placeholder="세금" value={form.tax} onChange={e => setForm(p => ({ ...p, tax: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
          <input type="text" placeholder="메모" value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
            className="col-span-2 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button type="submit" disabled={saving}
            className="bg-slate-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
            {saving ? '저장 중...' : '추가'}
          </button>
          {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">종목</th>
              <th className="text-left px-4 py-3">계좌</th>
              <th className="text-right px-4 py-3">지급일</th>
              <th className="text-right px-4 py-3">금액</th>
              <th className="text-right px-4 py-3">세금</th>
              <th className="text-left px-4 py-3">메모</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {dividends.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{d.security.ticker}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{d.account.broker} · {d.account.name}</td>
                <td className="px-4 py-3 text-right text-slate-500">{d.paid_at}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                  {d.amount.toLocaleString()} {d.currency}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">{d.tax > 0 ? `${d.tax.toLocaleString()} ${d.currency}` : '-'}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{d.memo ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add app/portfolio/income/ components/portfolio/IncomeDashboard.tsx
git commit -m "feat: income page (sells + dividends)"
```

---

## Task 10: 포트폴리오 관리 페이지 통합

**Files:**
- Create: `app/portfolio/settings/page.tsx`
- Modify/move: 기존 import, holdings, rebalance 페이지를 settings 하위로 이동하거나 링크

**Step 1: settings 페이지 — 탭으로 기존 기능 통합**

```typescript
// app/portfolio/settings/page.tsx
import Link from 'next/link'

export default function PortfolioSettingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-lg font-bold text-slate-800 mb-6">포트폴리오 관리</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: '포지션 관리', desc: '계좌/종목 보유 현황 직접 편집', href: '/portfolio/holdings' },
          { title: '구글시트 Import', desc: '구글시트에서 포지션 일괄 가져오기', href: '/portfolio/import' },
          { title: '리밸런싱', desc: '목표 비율 설정 및 리밸런싱 계산', href: '/portfolio/rebalance' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="bg-white rounded-xl border border-slate-100 px-5 py-5 hover:shadow-sm transition-shadow block">
            <p className="font-semibold text-slate-800 mb-1">{item.title}</p>
            <p className="text-xs text-slate-400">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add app/portfolio/settings/
git commit -m "feat: portfolio settings page"
```

---

## Task 11: 대시보드 — 최신 스냅샷 기준으로 변경

**Files:**
- Modify: `lib/portfolio/fetch.ts`

`fetchPortfolioSummary()`에서 `holdings`를 조회할 때 가장 최신 `snapshot_id` 기준으로 필터:

**Step 1: fetch.ts 수정**

```typescript
// fetchPortfolioSummary 내부, holdings 쿼리 부분 변경
// 기존:
supabase.from('holdings').select('*').gt('quantity', 0),
// 변경:
(async () => {
  const { data: latestSnap } = await supabase
    .from('snapshots')
    .select('id')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (!latestSnap) return { data: [] }
  return supabase
    .from('holdings')
    .select('*')
    .eq('snapshot_id', latestSnap.id)
    .gt('quantity', 0)
})(),
```

**Step 2: 타입 오류 확인**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add lib/portfolio/fetch.ts
git commit -m "feat: dashboard uses latest snapshot holdings"
```

---

## Task 12: 빌드 확인 및 배포

**Step 1: 전체 빌드**

```bash
npx next build 2>&1 | tail -30
```

**Step 2: 배포**

```bash
npx vercel --prod
```

---

## 실행 순서 요약

| Task | 내용 | 선행 필요 |
|------|------|-----------|
| 1 | Supabase DDL 실행 | 없음 |
| 2 | 타입 추가 | Task 1 |
| 3 | 네비게이션 재편 | 없음 |
| 4 | Snapshot API | Task 1, 2 |
| 5 | Sells/Dividends API | Task 1, 2 |
| 6 | 스냅샷 목록 페이지 | Task 4 |
| 7 | 스냅샷 편집 페이지 | Task 4, 6 |
| 8 | 스냅샷 차트 | Task 7 |
| 9 | 수익 페이지 | Task 5 |
| 10 | 관리 페이지 | 없음 |
| 11 | 대시보드 스냅샷 연동 | Task 4, 7 |
| 12 | 빌드 + 배포 | 모두 |
