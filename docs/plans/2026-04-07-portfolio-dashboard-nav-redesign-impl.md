# Portfolio & Ledger Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 대시보드 계좌별 드릴다운, 네비게이션 분리(계좌관리/종목관리), 종목 가격 기능, 가계부 사용자 추가

**Architecture:** Next.js App Router 서버 컴포넌트로 데이터 패칭, 클라이언트 컴포넌트로 인터랙션 처리. 기존 recharts로 차트 구현. Supabase service role client로 데이터 조작.

**Tech Stack:** Next.js 14 App Router, Supabase, TailwindCSS, recharts

---

## Task 1: 계좌관리 저장 버그 수정 + 연결 종목 상단 정렬

**Files:**
- Modify: `app/api/portfolio/account-securities/route.ts`
- Modify: `components/portfolio/HoldingsManager.tsx`

**Step 1: API PUT 핸들러 추가 (계좌 전체 링크 교체)**

`app/api/portfolio/account-securities/route.ts`에 PUT 핸들러 추가:
```typescript
export async function PUT(req: NextRequest) {
  const { account_id, security_ids } = await req.json()
  if (!account_id) return NextResponse.json({ error: 'account_id 필수' }, { status: 400 })

  // DELETE all for account, then INSERT
  await supabase.from('account_securities').delete().eq('account_id', account_id)
  
  if (security_ids?.length > 0) {
    const rows = security_ids.map((sid: string) => ({ account_id, security_id: sid }))
    await supabase.from('account_securities').insert(rows)
  }
  return NextResponse.json({ ok: true })
}
```

**Step 2: HoldingsManager saveLinks를 PUT 방식으로 변경**

`saveLinks()` 함수를:
```typescript
async function saveLinks() {
  if (!selectedAccountId) return
  setSavingLinks(true)
  try {
    await apiFetch('/api/portfolio/account-securities', 'PUT', {
      account_id: selectedAccountId,
      security_ids: [...pendingIds],
    })
    setLinks(prev => {
      const withoutAccount = prev.filter(l => l.account_id !== selectedAccountId)
      return [...withoutAccount, ...[...pendingIds].map(sid => ({ account_id: selectedAccountId!, security_id: sid }))]
    })
    notify(`저장 완료 (${pendingIds.size}종목 연결됨)`)
  } catch (e: unknown) { notify(e instanceof Error ? e.message : '오류', false) }
  finally { setSavingLinks(false) }
}
```

**Step 3: 체크박스 리스트 — 연결된 종목 상단 정렬**

`filteredLinkSecurities` useMemo에서 정렬 수정:
```typescript
const filteredLinkSecurities = useMemo(() => {
  let list = [...securities]
  if (linkSearch.trim()) {
    const q = linkSearch.toLowerCase()
    list = list.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
  }
  // 연결된 종목 먼저, 그다음 ticker 순
  return list.sort((a, b) => {
    const aLinked = pendingIds.has(a.id) ? 0 : 1
    const bLinked = pendingIds.has(b.id) ? 0 : 1
    if (aLinked !== bLinked) return aLinked - bLinked
    return a.ticker.localeCompare(b.ticker)
  })
}, [securities, linkSearch, pendingIds])
```

**Step 4: 계좌 유형에 예금/CMA 추가**

HoldingsManager에서 account type options:
```typescript
// 기존: ['종합위탁','연금저축','ISA','IRP']
// 변경:
['종합위탁','연금저축','ISA','IRP','예금','CMA']
```
(showAddAccount 폼 + editingAccount 폼 양쪽 모두)

**Step 5: 계좌 추가 폼 inputbox 글자 크기 축소**

`inputCls` 변수에서 `text-sm` → `text-xs` (이미 text-sm이면 변경, 없으면 추가):
```typescript
const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300'
```

**Step 6: Commit**
```bash
git add app/api/portfolio/account-securities/route.ts components/portfolio/HoldingsManager.tsx
git commit -m "fix: account-securities save bug, sort linked securities first, add account types"
```

---

## Task 2: 네비게이션 분리 + 새 페이지 생성

**Files:**
- Modify: `components/TabNav.tsx`
- Create: `app/portfolio/accounts/page.tsx`
- Create: `app/portfolio/securities/page.tsx`
- Modify: `app/portfolio/holdings/page.tsx` (redirect)
- Modify: `app/portfolio/settings/page.tsx` (update links)

**Step 1: TabNav 수정**

```typescript
const PORTFOLIO_TABS = [
  { label: '대시보드', href: '/portfolio' },
  { label: '스냅샷', href: '/portfolio/snapshots' },
  { label: '수익', href: '/portfolio/income' },
  { label: '계좌관리', href: '/portfolio/accounts' },
  { label: '종목관리', href: '/portfolio/securities' },
]
```

**Step 2: `/portfolio/accounts/page.tsx` 생성**

```typescript
import { fetchAccounts, fetchSecurities } from '@/lib/portfolio/fetch'
import { supabase } from '@/lib/supabase'
import AccountsManager from '@/components/portfolio/AccountsManager'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const [accounts, securities, { data: accountSecurities }] = await Promise.all([
    fetchAccounts(),
    fetchSecurities(),
    supabase.from('account_securities').select('*'),
  ])
  return (
    <AccountsManager
      accounts={accounts}
      securities={securities}
      accountSecurities={accountSecurities ?? []}
    />
  )
}
```

**Step 3: `/portfolio/securities/page.tsx` 생성**

```typescript
import { fetchSecurities } from '@/lib/portfolio/fetch'
import { supabase } from '@/lib/supabase'
import SecuritiesManager from '@/components/portfolio/SecuritiesManager'

export const dynamic = 'force-dynamic'

export default async function SecuritiesPage() {
  const [securities, { data: prices }] = await Promise.all([
    fetchSecurities(),
    supabase.from('price_history')
      .select('ticker, price, currency, date')
      .order('date', { ascending: false }),
  ])

  // 종목별 최신 가격 맵
  const latestPrices: Record<string, { price: number; currency: string; date: string }> = {}
  for (const row of prices ?? []) {
    if (!latestPrices[row.ticker]) latestPrices[row.ticker] = row
  }

  return <SecuritiesManager securities={securities} latestPrices={latestPrices} />
}
```

**Step 4: HoldingsManager를 AccountsManager로 분리**

`components/portfolio/AccountsManager.tsx` 생성 — HoldingsManager에서 accounts 탭 관련 코드만 추출:
- Props: `accounts`, `securities`, `accountSecurities`
- 레이아웃: `max-w-7xl mx-auto px-4 py-6`
- Task 1의 수정 사항(저장 버그, 정렬, 유형, 폰트) 반영

**Step 5: SecuritiesManager 생성**

`components/portfolio/SecuritiesManager.tsx` 생성 — HoldingsManager에서 securities 탭 관련 코드만 추출:
- Props: `securities`, `latestPrices: Record<string, { price, currency, date }>`
- 레이아웃: `max-w-7xl mx-auto px-4 py-6`
- 기본 정렬: 국가 → 이름 순 (secSort 초기값 변경 및 정렬 로직 업데이트)
- 카드에 최신 가격 표기 (있으면 표시, 없으면 '-')
- 종목별 가격 업데이트 버튼 (기존 PositionsTable의 syncTicker 로직 재사용)
- 상단 전체 가격 업데이트 버튼

기본 정렬 로직:
```typescript
const [secSort, setSecSort] = useState<'ticker' | 'name' | 'country_name'>('country_name')

// 정렬 함수에서:
if (secSort === 'country_name') {
  const countryOrder: Record<string, number> = { '국내': 0, '미국': 1, '글로벌': 2, '기타': 3 }
  const ca = countryOrder[a.country ?? '기타'] ?? 3
  const cb = countryOrder[b.country ?? '기타'] ?? 3
  return ca !== cb ? ca - cb : a.name.localeCompare(b.name)
}
```

가격 카드 표기 (카드 하단):
```tsx
{latestPrices[s.ticker] ? (
  <span className="text-[10px] font-mono text-slate-500">
    {latestPrices[s.ticker].currency === 'USD'
      ? `$${latestPrices[s.ticker].price.toFixed(2)}`
      : `${latestPrices[s.ticker].price.toLocaleString()}원`}
    <span className="text-slate-300 ml-1">{latestPrices[s.ticker].date}</span>
  </span>
) : <span className="text-[10px] text-slate-300">가격 없음</span>}
```

**Step 6: `/portfolio/holdings/page.tsx` redirect 처리**

```typescript
import { redirect } from 'next/navigation'
export default function HoldingsPage() {
  redirect('/portfolio/accounts')
}
```

**Step 7: Commit**
```bash
git add components/TabNav.tsx app/portfolio/accounts/ app/portfolio/securities/ components/portfolio/AccountsManager.tsx components/portfolio/SecuritiesManager.tsx app/portfolio/holdings/page.tsx
git commit -m "feat: split nav into 계좌관리/종목관리, create AccountsManager and SecuritiesManager pages"
```

---

## Task 3: 가격 수집 이력 페이지

**Files:**
- Create: `app/portfolio/securities/prices/page.tsx`
- Create: `components/portfolio/PriceHistoryViewer.tsx`

**Step 1: 데이터 패칭 페이지**

`app/portfolio/securities/prices/page.tsx`:
```typescript
import { fetchSecurities } from '@/lib/portfolio/fetch'
import { supabase } from '@/lib/supabase'
import PriceHistoryViewer from '@/components/portfolio/PriceHistoryViewer'

export const dynamic = 'force-dynamic'

export default async function PriceHistoryPage() {
  const [securities, { data: history }] = await Promise.all([
    fetchSecurities(),
    supabase
      .from('price_history')
      .select('ticker, date, price, currency')
      .order('date', { ascending: true }),
  ])
  return <PriceHistoryViewer securities={securities} history={history ?? []} />
}
```

**Step 2: PriceHistoryViewer 컴포넌트**

`components/portfolio/PriceHistoryViewer.tsx`:
- 상단: 종목 선택 드롭다운 (기본: 전체 또는 첫 번째 종목)
- 선택된 종목의 가격 추이 LineChart (recharts)
  - XAxis: 날짜 (YYYY-MM-DD)
  - YAxis: 가격
  - Tooltip: 날짜 + 가격(통화 포함)
- 하단: 해당 종목 가격 이력 테이블 (날짜, 가격, 통화) — 최신순

```typescript
'use client'
import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Security } from '@/lib/portfolio/types'

interface PriceRow { ticker: string; date: string; price: number; currency: string }

interface Props {
  securities: Security[]
  history: PriceRow[]
}

export default function PriceHistoryViewer({ securities, history }: Props) {
  const [selectedTicker, setSelectedTicker] = useState(securities[0]?.ticker ?? '')
  const rows = history.filter(h => h.ticker === selectedTicker)
  const isUSD = rows[0]?.currency === 'USD'
  const chartData = rows.map(r => ({ date: r.date.slice(5), price: r.price })) // MM-DD

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-700">가격 수집 이력</h2>
        <select value={selectedTicker} onChange={e => setSelectedTicker(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300">
          {securities.map(s => (
            <option key={s.ticker} value={s.ticker}>{s.ticker} — {s.name}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{rows.length}개 데이터</span>
      </div>

      {/* Chart */}
      {rows.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => isUSD ? `$${v}` : `${(v/10000).toFixed(0)}만`} width={55} />
              <Tooltip formatter={(v: number) => isUSD ? `$${v.toFixed(2)}` : `${v.toLocaleString()}원`} labelFormatter={l => `날짜: ${l}`} />
              <Line type="monotone" dataKey="price" stroke="#334155" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-400">
          수집된 가격 이력이 없습니다
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-2.5">날짜</th>
              <th className="text-right px-4 py-2.5">가격</th>
              <th className="text-right px-4 py-2.5">통화</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r, i) => (
              <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-600">{r.date}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-700">
                  {r.currency === 'USD' ? `$${r.price.toFixed(2)}` : r.price.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-slate-400">{r.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 3: SecuritiesManager 상단에 "가격 이력" 링크 추가**

SecuritiesManager 상단 액션 버튼 영역에:
```tsx
<a href="/portfolio/securities/prices"
  className="text-xs text-blue-500 hover:underline">가격 이력 →</a>
```

**Step 4: Commit**
```bash
git add app/portfolio/securities/prices/ components/portfolio/PriceHistoryViewer.tsx
git commit -m "feat: price history page with line chart"
```

---

## Task 4: 대시보드 리디자인

**Files:**
- Modify: `components/portfolio/PortfolioDashboard.tsx`
- Modify: `components/portfolio/PortfolioKpiCards.tsx` (금액 포맷 수정)
- Modify: `lib/portfolio/types.ts` (필요시)

**Step 1: PortfolioDashboard — 계좌 선택 카드 추가**

상단에 계좌 선택 카드 영역 추가. "전체" 카드 + 계좌별 카드:

```typescript
// 계좌별 집계
const accountGroups = summary.positions.reduce<Record<string, {
  label: string; value: number; pnl: number; invested: number; count: number
}>>((acc, p) => {
  const id = p.account.id
  if (!acc[id]) acc[id] = { label: `${p.account.broker} · ${p.account.name}`, value: 0, pnl: 0, invested: 0, count: 0 }
  acc[id].value += p.market_value
  acc[id].pnl += p.unrealized_pnl
  acc[id].invested += p.total_invested
  acc[id].count++
  return acc
}, {})

const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all')

const visiblePositions = selectedAccountId === 'all'
  ? summary.positions
  : summary.positions.filter(p => p.account.id === selectedAccountId)
```

**Step 2: 계좌 카드 UI**

```tsx
{/* 계좌 선택 카드들 */}
<div className="flex gap-2 flex-wrap">
  {/* 전체 카드 */}
  <button onClick={() => setSelectedAccountId('all')}
    className={`rounded-xl border px-4 py-2.5 text-left transition-all min-w-32 ${
      selectedAccountId === 'all' ? 'bg-slate-700 border-slate-700' : 'bg-white border-slate-100 hover:border-slate-200'
    }`}>
    <p className={`text-[10px] font-medium mb-0.5 ${selectedAccountId === 'all' ? 'text-slate-300' : 'text-slate-400'}`}>전체</p>
    <p className={`text-sm font-bold ${selectedAccountId === 'all' ? 'text-white' : 'text-slate-800'}`}>
      {summary.total_value.toLocaleString()}원
    </p>
    <p className={`text-xs ${(summary.total_pnl ?? 0) >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
      {(summary.total_pnl ?? 0) >= 0 ? '+' : ''}{(summary.total_pnl ?? 0).toLocaleString()}원
    </p>
  </button>

  {/* 계좌별 카드 */}
  {Object.entries(accountGroups).sort((a, b) => b[1].value - a[1].value).map(([id, g]) => (
    <button key={id} onClick={() => setSelectedAccountId(id)}
      className={`rounded-xl border px-4 py-2.5 text-left transition-all min-w-32 ${
        selectedAccountId === id ? 'bg-slate-700 border-slate-700' : 'bg-white border-slate-100 hover:border-slate-200'
      }`}>
      <p className={`text-[10px] font-medium mb-0.5 truncate max-w-28 ${selectedAccountId === id ? 'text-slate-300' : 'text-slate-400'}`}>
        {g.label}
      </p>
      <p className={`text-sm font-bold ${selectedAccountId === id ? 'text-white' : 'text-slate-800'}`}>
        {g.value.toLocaleString()}원
      </p>
      <p className={`text-xs ${g.pnl >= 0 ? 'text-rose-400' : 'text-blue-400'}`}>
        {g.pnl >= 0 ? '+' : ''}{g.pnl.toLocaleString()}원
        <span className="ml-1 opacity-70 text-[10px]">{g.count}종목</span>
      </p>
    </button>
  ))}
</div>
```

**Step 3: 종목별 보유현황 — 티커 뱃지 + 금액 포맷 수정**

PositionsTable.tsx에서 금액 fmt 함수 수정:
```typescript
// 기존 (축약): 억/만 단위
// 변경: 전체 숫자 + 콤마
function fmt(n: number, currency?: string) {
  if (currency === 'USD') return `$${n.toFixed(2)}`
  return n.toLocaleString()
}
```

티커 셀 개선 (이미 뱃지 형태이나 더 명확하게):
```tsx
<td className="px-4 py-3 pl-8">
  <div className="flex items-center gap-2 mb-0.5">
    <span className="bg-slate-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">{ticker}</span>
  </div>
  <p className="text-xs font-medium text-slate-700">{p.security.name}</p>
</td>
```

**Step 4: Commit**
```bash
git add components/portfolio/PortfolioDashboard.tsx components/portfolio/PositionsTable.tsx
git commit -m "feat: dashboard account drill-down cards, ticker badge, full number format"
```

---

## Task 5: 가계부 사용자(L/P) 추가

**Files:**
- Modify: `lib/types.ts`
- Modify: `app/api/expenses/route.ts`
- Modify: `components/ExpenseTable.tsx`
- Modify: `components/Dashboard.tsx` (필요시 필터 추가)

**Step 1: DB 컬럼 확인 및 타입 추가**

먼저 Supabase 대시보드에서 `expenses` 테이블에 `member varchar` 컬럼 존재 여부 확인.
없으면 SQL 실행:
```sql
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS member varchar;
```

`lib/types.ts`에 `member` 필드 추가:
```typescript
export interface ExpenseItem {
  year: number
  date: string
  month: number
  category: string
  detail: string
  memo: string
  method: string
  amount: number
  member: string | null  // 추가
}
```

**Step 2: API에서 member 필드 포함**

`app/api/expenses/route.ts` select 쿼리 수정:
```typescript
.select('year,month,expense_date,category,detail,memo,method,amount,member')
```

데이터 매핑에도 member 추가 (map 부분에):
```typescript
member: row.member ?? null,
```

**Step 3: ExpenseTable에 사용자 컬럼 추가**

헤더에 `사용자` 컬럼 추가:
```tsx
<th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">사용자</th>
```

행에 사용자 표기:
```tsx
<td className="py-2 px-3">
  {e.member ? (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
      e.member === 'L' ? 'bg-blue-50 text-blue-600' : 
      e.member === 'P' ? 'bg-pink-50 text-pink-600' : 
      'bg-slate-100 text-slate-500'
    }`}>{e.member}</span>
  ) : <span className="text-slate-300">-</span>}
</td>
```

사용자 필터 추가 (선택적): 기존 필터 영역에 L/P/전체 버튼

**Step 4: Commit**
```bash
git add lib/types.ts app/api/expenses/route.ts components/ExpenseTable.tsx
git commit -m "feat: add member (L/P) field to expense table"
```

---

## 실행 순서 요약

| Task | 내용 | 예상 영향 |
|------|------|---------|
| 1 | 계좌-종목 저장 버그 + 정렬 + 유형 추가 + 폰트 | accounts 탭 버그 수정 |
| 2 | 네비게이션 분리 + AccountsManager + SecuritiesManager | 전체 구조 변경 |
| 3 | 가격 이력 페이지 | 새 페이지 |
| 4 | 대시보드 리디자인 | 대시보드 UI |
| 5 | 가계부 사용자 추가 | DB 컬럼 필요 |
