# 포트폴리오 관리 기능 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Next.js 가계부 앱에 주식 포트폴리오 관리 페이지와 대시보드를 추가한다.

**Architecture:** Supabase에 새 테이블(accounts, securities, holdings, transactions, dividends, target_allocations, price_cache)을 추가하고, Yahoo Finance API로 현재가를 조회한다. 기존 가계부의 컴포넌트/패턴을 최대한 재사용한다.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Recharts, Supabase, yahoo-finance2, Google Sheets API (googleapis — 이미 설치됨)

---

## Task 1: Supabase 스키마 추가

**Files:**
- Create: `docs/portfolio-schema.sql`

**Step 1: SQL 파일 작성**

```sql
-- docs/portfolio-schema.sql
-- Supabase SQL Editor에서 실행

-- 계좌
CREATE TABLE accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  broker     text NOT NULL,
  owner      text,
  type       text,        -- 종합위탁 / 연금저축 / ISA
  currency   text NOT NULL DEFAULT 'KRW',
  created_at timestamptz DEFAULT now()
);

-- 종목 마스터
CREATE TABLE securities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker      text UNIQUE NOT NULL,
  name        text NOT NULL,
  asset_class text,    -- 주식 / 채권 / 대체자산
  country     text,    -- US / KR
  style       text,    -- 성장 / 인컴 / 안전
  sector      text,
  currency    text NOT NULL DEFAULT 'USD',
  created_at  timestamptz DEFAULT now()
);

-- 현재 포지션 스냅샷 (holdings = source of truth)
CREATE TABLE holdings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid REFERENCES accounts(id) ON DELETE CASCADE,
  security_id    uuid REFERENCES securities(id) ON DELETE CASCADE,
  quantity       numeric NOT NULL DEFAULT 0,
  avg_price      numeric,        -- 평균매입가
  total_invested numeric,        -- 투자원금 (KRW)
  snapshot_date  date NOT NULL DEFAULT CURRENT_DATE,
  source         text DEFAULT 'manual',  -- manual / calculated
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(account_id, security_id)
);

-- 매수/매도 이력
CREATE TABLE portfolio_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid REFERENCES accounts(id) ON DELETE CASCADE,
  security_id    uuid REFERENCES securities(id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('buy', 'sell')),
  date           date NOT NULL,
  quantity       numeric NOT NULL,
  price_per_unit numeric NOT NULL,
  currency       text NOT NULL DEFAULT 'USD',
  exchange_rate  numeric NOT NULL DEFAULT 1,
  fees           numeric DEFAULT 0,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- 분배금/배당 이력
CREATE TABLE dividends (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid REFERENCES accounts(id) ON DELETE CASCADE,
  security_id   uuid REFERENCES securities(id) ON DELETE CASCADE,
  date          date NOT NULL,
  amount        numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'USD',
  exchange_rate numeric NOT NULL DEFAULT 1,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- 목표 비율
CREATE TABLE target_allocations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level      text NOT NULL CHECK (level IN ('asset_class', 'sector', 'ticker')),
  key        text NOT NULL,       -- "주식", "테크", "SCHD"
  target_pct numeric NOT NULL,   -- 0.0 ~ 1.0
  UNIQUE(level, key)
);

-- 현재가 캐시 (TTL: 1시간)
CREATE TABLE price_cache (
  ticker     text PRIMARY KEY,
  price      numeric NOT NULL,
  currency   text NOT NULL DEFAULT 'USD',
  fetched_at timestamptz DEFAULT now()
);

-- RLS: 기존 expenses 테이블과 동일하게 공개 읽기 + 인증 쓰기
ALTER TABLE accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE securities            ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividends             ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_allocations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_cache           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read accounts"               ON accounts              FOR SELECT TO anon USING (true);
CREATE POLICY "public read securities"             ON securities            FOR SELECT TO anon USING (true);
CREATE POLICY "public read holdings"               ON holdings              FOR SELECT TO anon USING (true);
CREATE POLICY "public read portfolio_transactions" ON portfolio_transactions FOR SELECT TO anon USING (true);
CREATE POLICY "public read dividends"              ON dividends             FOR SELECT TO anon USING (true);
CREATE POLICY "public read target_allocations"     ON target_allocations    FOR SELECT TO anon USING (true);
CREATE POLICY "public read price_cache"            ON price_cache           FOR SELECT TO anon USING (true);
```

**Step 2: Supabase SQL Editor에서 실행**

Supabase 대시보드 → SQL Editor → 위 SQL 붙여넣기 → Run

**Step 3: 실행 확인**

Supabase → Table Editor에서 7개 테이블(accounts, securities, holdings, portfolio_transactions, dividends, target_allocations, price_cache) 생성 확인

**Step 4: Commit**

```bash
git add docs/portfolio-schema.sql
git commit -m "feat: add portfolio supabase schema sql"
```

---

## Task 2: yahoo-finance2 설치 + 현재가 API

**Files:**
- Modify: `package.json` (의존성 추가)
- Create: `app/api/portfolio/prices/route.ts`
- Create: `lib/portfolio/prices.ts`

**Step 1: 패키지 설치**

```bash
npm install yahoo-finance2
```

**Step 2: `lib/portfolio/prices.ts` 작성**

```typescript
// lib/portfolio/prices.ts
import 'server-only'
import yahooFinance from 'yahoo-finance2'
import { supabase } from '@/lib/supabase'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1시간

export async function getPrices(tickers: string[]): Promise<Record<string, { price: number; currency: string }>> {
  if (tickers.length === 0) return {}

  // 1. 캐시에서 유효한 가격 조회
  const { data: cached } = await supabase
    .from('price_cache')
    .select('ticker, price, currency, fetched_at')
    .in('ticker', tickers)

  const now = Date.now()
  const result: Record<string, { price: number; currency: string }> = {}
  const stale: string[] = []

  for (const ticker of tickers) {
    const hit = cached?.find(c => c.ticker === ticker)
    if (hit && now - new Date(hit.fetched_at).getTime() < CACHE_TTL_MS) {
      result[ticker] = { price: hit.price, currency: hit.currency }
    } else {
      stale.push(ticker)
    }
  }

  if (stale.length === 0) return result

  // 2. Yahoo Finance에서 갱신
  const updates: { ticker: string; price: number; currency: string; fetched_at: string }[] = []

  await Promise.allSettled(
    stale.map(async (ticker) => {
      try {
        const quote = await yahooFinance.quote(ticker)
        const price = quote.regularMarketPrice ?? 0
        const currency = quote.currency ?? 'USD'
        result[ticker] = { price, currency }
        updates.push({ ticker, price, currency, fetched_at: new Date().toISOString() })
      } catch {
        // 실패 시 캐시된 낡은 값이라도 사용
        const old = cached?.find(c => c.ticker === ticker)
        if (old) result[ticker] = { price: old.price, currency: old.currency }
      }
    })
  )

  // 3. 캐시 upsert
  if (updates.length > 0) {
    await supabase.from('price_cache').upsert(updates, { onConflict: 'ticker' })
  }

  return result
}
```

**Step 3: `app/api/portfolio/prices/route.ts` 작성**

```typescript
// app/api/portfolio/prices/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPrices } from '@/lib/portfolio/prices'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = raw.split(',').map(t => t.trim()).filter(Boolean)

  if (tickers.length === 0) {
    return NextResponse.json({ error: 'tickers 파라미터가 필요합니다.' }, { status: 400 })
  }
  if (tickers.length > 50) {
    return NextResponse.json({ error: '한 번에 최대 50개까지 조회 가능합니다.' }, { status: 400 })
  }

  const prices = await getPrices(tickers)
  return NextResponse.json(prices, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
```

**Step 4: 브라우저에서 테스트**

```
GET /api/portfolio/prices?tickers=SCHD,005930.KS,NVDA
```

예상 응답:
```json
{
  "SCHD": { "price": 27.72, "currency": "USD" },
  "005930.KS": { "price": 58900, "currency": "KRW" },
  "NVDA": { "price": 177.39, "currency": "USD" }
}
```

**Step 5: Commit**

```bash
git add app/api/portfolio/prices/route.ts lib/portfolio/prices.ts package.json package-lock.json
git commit -m "feat: yahoo finance price API with 1h cache"
```

---

## Task 3: 포트폴리오 타입 정의

**Files:**
- Create: `lib/portfolio/types.ts`

**Step 1: `lib/portfolio/types.ts` 작성**

```typescript
// lib/portfolio/types.ts

export interface Account {
  id: string
  name: string
  broker: string
  owner: string | null
  type: string | null
  currency: string
}

export interface Security {
  id: string
  ticker: string
  name: string
  asset_class: string | null
  country: string | null
  style: string | null
  sector: string | null
  currency: string
}

export interface Holding {
  id: string
  account_id: string
  security_id: string
  quantity: number
  avg_price: number | null
  total_invested: number | null
  snapshot_date: string
  source: string
  // joined
  account?: Account
  security?: Security
}

export interface PortfolioTransaction {
  id: string
  account_id: string
  security_id: string
  type: 'buy' | 'sell'
  date: string
  quantity: number
  price_per_unit: number
  currency: string
  exchange_rate: number
  fees: number
  notes: string | null
}

export interface Dividend {
  id: string
  account_id: string
  security_id: string
  date: string
  amount: number
  currency: string
  exchange_rate: number
  notes: string | null
}

export interface TargetAllocation {
  id: string
  level: 'asset_class' | 'sector' | 'ticker'
  key: string
  target_pct: number
}

// 대시보드용 집계 타입
export interface PortfolioPosition {
  security: Security
  account: Account
  quantity: number
  avg_price: number
  total_invested: number      // KRW
  current_price: number       // 원화 환산
  market_value: number        // quantity × current_price (KRW)
  unrealized_pnl: number      // market_value - total_invested
  unrealized_pct: number      // unrealized_pnl / total_invested
  total_dividends: number     // 누적 분배금 (KRW)
}

export interface PortfolioSummary {
  total_market_value: number
  total_invested: number
  total_unrealized_pnl: number
  total_unrealized_pct: number
  total_dividends: number
  positions: PortfolioPosition[]
}
```

**Step 2: Commit**

```bash
git add lib/portfolio/types.ts
git commit -m "feat: portfolio type definitions"
```

---

## Task 4: 포트폴리오 데이터 fetch 함수

**Files:**
- Create: `lib/portfolio/fetch.ts`

**Step 1: `lib/portfolio/fetch.ts` 작성**

```typescript
// lib/portfolio/fetch.ts
import 'server-only'
import { supabase } from '@/lib/supabase'
import { getPrices } from './prices'
import type { Account, Security, Holding, PortfolioSummary, PortfolioPosition, TargetAllocation } from './types'

export async function fetchAccounts(): Promise<Account[]> {
  const { data } = await supabase.from('accounts').select('*').order('name')
  return data ?? []
}

export async function fetchSecurities(): Promise<Security[]> {
  const { data } = await supabase.from('securities').select('*').order('ticker')
  return data ?? []
}

export async function fetchTargetAllocations(): Promise<TargetAllocation[]> {
  const { data } = await supabase.from('target_allocations').select('*')
  return data ?? []
}

// USD → KRW 환율 (USD/KRW Yahoo Finance ticker: KRW=X)
async function fetchExchangeRate(): Promise<number> {
  const prices = await getPrices(['KRW=X'])
  return prices['KRW=X']?.price ?? 1350
}

export async function fetchPortfolioSummary(): Promise<PortfolioSummary> {
  // holdings + joined account + security
  const { data: holdingsRaw } = await supabase
    .from('holdings')
    .select(`
      *,
      account:accounts(*),
      security:securities(*)
    `)
    .gt('quantity', 0)

  const holdings = (holdingsRaw ?? []) as (Holding & { account: Account; security: Security })[]

  if (holdings.length === 0) {
    return {
      total_market_value: 0,
      total_invested: 0,
      total_unrealized_pnl: 0,
      total_unrealized_pct: 0,
      total_dividends: 0,
      positions: [],
    }
  }

  // 티커 목록 수집 (한국주식은 .KS 접미사 필요)
  const tickers = holdings.map(h => {
    const ticker = h.security.ticker
    if (h.security.country === 'KR' && !ticker.includes('.')) return `${ticker}.KS`
    return ticker
  })
  // 환율도 함께 조회
  tickers.push('KRW=X')

  const uniqueTickers = [...new Set(tickers)]
  const prices = await getPrices(uniqueTickers)
  const exchangeRate = prices['KRW=X']?.price ?? 1350

  // 분배금 합계 (계좌 + 종목별)
  const { data: dividendRows } = await supabase
    .from('dividends')
    .select('security_id, account_id, amount, currency, exchange_rate')

  const positions: PortfolioPosition[] = holdings.map(h => {
    const yahoTicker = h.security.country === 'KR' && !h.security.ticker.includes('.')
      ? `${h.security.ticker}.KS`
      : h.security.ticker

    const rawPrice = prices[yahoTicker]?.price ?? 0
    // USD면 원화 환산
    const currentPriceKRW = h.security.currency === 'USD' ? rawPrice * exchangeRate : rawPrice

    const quantity = h.quantity
    const avgPriceKRW = h.avg_price ?? 0
    const totalInvested = h.total_invested ?? avgPriceKRW * quantity

    const marketValue = currentPriceKRW * quantity
    const unrealizedPnl = marketValue - totalInvested
    const unrealizedPct = totalInvested > 0 ? unrealizedPnl / totalInvested : 0

    // 이 포지션의 누적 분배금
    const divs = (dividendRows ?? []).filter(
      d => d.security_id === h.security_id && d.account_id === h.account_id
    )
    const totalDividends = divs.reduce((sum, d) => {
      const amt = d.currency === 'USD' ? d.amount * (d.exchange_rate ?? exchangeRate) : d.amount
      return sum + amt
    }, 0)

    return {
      security: h.security,
      account: h.account,
      quantity,
      avg_price: avgPriceKRW,
      total_invested: totalInvested,
      current_price: currentPriceKRW,
      market_value: marketValue,
      unrealized_pnl: unrealizedPnl,
      unrealized_pct: unrealizedPct,
      total_dividends: totalDividends,
    }
  })

  const total_market_value = positions.reduce((s, p) => s + p.market_value, 0)
  const total_invested = positions.reduce((s, p) => s + p.total_invested, 0)
  const total_unrealized_pnl = total_market_value - total_invested
  const total_unrealized_pct = total_invested > 0 ? total_unrealized_pnl / total_invested : 0
  const total_dividends = positions.reduce((s, p) => s + p.total_dividends, 0)

  return {
    total_market_value,
    total_invested,
    total_unrealized_pnl,
    total_unrealized_pct,
    total_dividends,
    positions,
  }
}
```

**Step 2: Commit**

```bash
git add lib/portfolio/fetch.ts
git commit -m "feat: portfolio data fetch with price aggregation"
```

---

## Task 5: 네비게이션에 포트폴리오 탭 추가

**Files:**
- Modify: `components/TabNav.tsx`

**Step 1: TABS 배열에 포트폴리오 추가**

`components/TabNav.tsx`의 TABS 배열:

```typescript
const TABS = [
  { label: '가계부', href: '/' },
  { label: '연도비교', href: '/compare' },
  { label: '검색',     href: '/search' },
  { label: '포트폴리오', href: '/portfolio' },
  { label: '관리',     href: '/admin' },
]
```

**Step 2: 개발 서버에서 탭 노출 확인**

```bash
npm run dev
```

브라우저 → 헤더에 "포트폴리오" 탭 확인

**Step 3: Commit**

```bash
git add components/TabNav.tsx
git commit -m "feat: add portfolio tab to navigation"
```

---

## Task 6: 포트폴리오 대시보드 페이지

**Files:**
- Create: `app/portfolio/page.tsx`
- Create: `app/portfolio/loading.tsx`
- Create: `components/portfolio/PortfolioDashboard.tsx`
- Create: `components/portfolio/PortfolioKpiCards.tsx`
- Create: `components/portfolio/AllocationCharts.tsx`
- Create: `components/portfolio/PositionsTable.tsx`

**Step 1: `app/portfolio/loading.tsx`**

```typescript
// app/portfolio/loading.tsx
export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white rounded-2xl h-32 animate-pulse" />
      ))}
    </div>
  )
}
```

**Step 2: `app/portfolio/page.tsx`**

```typescript
// app/portfolio/page.tsx
import { fetchPortfolioSummary, fetchTargetAllocations } from '@/lib/portfolio/fetch'
import PortfolioDashboard from '@/components/portfolio/PortfolioDashboard'

export const dynamic = 'force-dynamic'

export default async function PortfolioPage() {
  const [summary, targets] = await Promise.all([
    fetchPortfolioSummary(),
    fetchTargetAllocations(),
  ])
  return <PortfolioDashboard summary={summary} targets={targets} />
}
```

**Step 3: `components/portfolio/PortfolioKpiCards.tsx`**

```typescript
// components/portfolio/PortfolioKpiCards.tsx
'use client'

import type { PortfolioSummary } from '@/lib/portfolio/types'

function fmt(n: number) {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (Math.abs(n) >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

function pct(n: number) {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

interface Props { summary: PortfolioSummary }

export default function PortfolioKpiCards({ summary }: Props) {
  const { total_market_value, total_invested, total_unrealized_pnl, total_unrealized_pct, total_dividends } = summary
  const pnlColor = total_unrealized_pnl >= 0 ? 'text-rose-500' : 'text-blue-500'

  const cards = [
    { label: '총 평가금액', value: `${fmt(total_market_value)}원`, sub: '현재 시장가 기준' },
    { label: '총 투자원금', value: `${fmt(total_invested)}원`, sub: '매수 원가 합계' },
    {
      label: '평가손익',
      value: `${total_unrealized_pnl >= 0 ? '+' : ''}${fmt(total_unrealized_pnl)}원`,
      sub: pct(total_unrealized_pct),
      highlight: pnlColor,
    },
    { label: '누적 분배금', value: `${fmt(total_dividends)}원`, sub: '받은 배당/분배금 합계' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{c.label}</p>
          <p className={`text-2xl font-bold text-slate-800 ${c.highlight ?? ''}`}>{c.value}</p>
          <p className="text-xs text-slate-400 mt-1">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}
```

**Step 4: `components/portfolio/AllocationCharts.tsx`**

```typescript
// components/portfolio/AllocationCharts.tsx
'use client'

import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts'
import type { PortfolioPosition } from '@/lib/portfolio/types'

const COLORS = ['#6B8CAE', '#6DAE8C', '#C4A96D', '#C47D7D', '#8B7BC8', '#5BB5B5']

interface Props { positions: PortfolioPosition[] }

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    acc[k] = (acc[k] ?? 0) + item.market_value
    return acc
  }, {} as Record<string, number>)
}

export default function AllocationCharts({ positions }: Props) {
  const byAssetClass = Object.entries(groupBy(positions, p => p.security.asset_class ?? '기타'))
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)

  const byCountry = Object.entries(groupBy(positions, p => p.security.country ?? '기타'))
    .map(([name, value]) => ({ name, value: Math.round(value) }))

  const bySector = Object.entries(groupBy(positions, p => p.security.sector ?? '기타'))
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  const byAccount = Object.entries(groupBy(positions, p => p.account.name))
    .map(([name, value]) => ({ name, value: Math.round(value) }))

  const fmtKRW = (v: number) => `${Math.round(v / 10000).toLocaleString()}만`

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 자산군 파이 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">자산군별</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={byAssetClass} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
              {byAssetClass.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => fmtKRW(v) + '원'} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 국가별 파이 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">국가별</h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={byCountry} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
              {byCountry.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => fmtKRW(v) + '원'} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 섹터별 바 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">섹터별</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bySector} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" tickFormatter={fmtKRW} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
            <Tooltip formatter={(v: number) => fmtKRW(v) + '원'} />
            <Bar dataKey="value" fill="#6B8CAE" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 계좌별 바 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">계좌별</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={byAccount} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" tickFormatter={fmtKRW} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
            <Tooltip formatter={(v: number) => fmtKRW(v) + '원'} />
            <Bar dataKey="value" fill="#6DAE8C" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

**Step 5: `components/portfolio/PositionsTable.tsx`**

```typescript
// components/portfolio/PositionsTable.tsx
'use client'

import type { PortfolioPosition } from '@/lib/portfolio/types'

interface Props { positions: PortfolioPosition[] }

function fmt(n: number) {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (Math.abs(n) >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

export default function PositionsTable({ positions }: Props) {
  const sorted = [...positions].sort((a, b) => b.market_value - a.market_value)
  const total = sorted.reduce((s, p) => s + p.market_value, 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-600">종목별 보유 현황</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">종목</th>
              <th className="text-left px-4 py-3">계좌</th>
              <th className="text-right px-4 py-3">수량</th>
              <th className="text-right px-4 py-3">평균매입가</th>
              <th className="text-right px-4 py-3">현재가</th>
              <th className="text-right px-4 py-3">평가금액</th>
              <th className="text-right px-4 py-3">손익</th>
              <th className="text-right px-4 py-3">비중</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.map((p, i) => {
              const pnlColor = p.unrealized_pnl >= 0 ? 'text-rose-500' : 'text-blue-500'
              const weight = total > 0 ? (p.market_value / total * 100).toFixed(1) : '0.0'
              return (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{p.security.ticker}</p>
                    <p className="text-xs text-slate-400">{p.security.name}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.account.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmt(p.avg_price)}원</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmt(p.current_price)}원</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(p.market_value)}원</td>
                  <td className={`px-4 py-3 text-right font-semibold ${pnlColor}`}>
                    {p.unrealized_pnl >= 0 ? '+' : ''}{fmt(p.unrealized_pnl)}원
                    <p className="text-xs">{(p.unrealized_pct * 100).toFixed(2)}%</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{weight}%</td>
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

**Step 6: `components/portfolio/PortfolioDashboard.tsx`**

```typescript
// components/portfolio/PortfolioDashboard.tsx
'use client'

import type { PortfolioSummary, TargetAllocation } from '@/lib/portfolio/types'
import PortfolioKpiCards from './PortfolioKpiCards'
import AllocationCharts from './AllocationCharts'
import PositionsTable from './PositionsTable'

interface Props {
  summary: PortfolioSummary
  targets: TargetAllocation[]
}

export default function PortfolioDashboard({ summary }: Props) {
  if (summary.positions.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-400">보유 종목이 없습니다.</p>
        <p className="text-sm text-slate-300 mt-1">
          <a href="/portfolio/import" className="underline">구글시트에서 import</a> 하거나
          <a href="/portfolio/holdings" className="underline ml-1">직접 입력</a>하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <PortfolioKpiCards summary={summary} />
      <AllocationCharts positions={summary.positions} />
      <PositionsTable positions={summary.positions} />
    </div>
  )
}
```

**Step 7: 개발 서버에서 확인**

```bash
npm run dev
```

브라우저 → `/portfolio` 접속 → KPI 카드, 차트, 테이블 렌더링 확인 (데이터 없으면 빈 상태 메시지 표시)

**Step 8: Commit**

```bash
git add app/portfolio/ components/portfolio/
git commit -m "feat: portfolio dashboard with KPI cards, allocation charts, positions table"
```

---

## Task 7: 관리 페이지 — 계좌 + 종목 CRUD

**Files:**
- Create: `app/portfolio/holdings/page.tsx`
- Create: `components/portfolio/HoldingsManager.tsx`
- Create: `app/api/portfolio/accounts/route.ts`
- Create: `app/api/portfolio/securities/route.ts`
- Create: `app/api/portfolio/holdings/route.ts`

**Step 1: `app/api/portfolio/accounts/route.ts`**

```typescript
// app/api/portfolio/accounts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase.from('accounts').select('*').order('name')
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, broker, owner, type, currency } = body
  if (!name || !broker) return NextResponse.json({ error: 'name, broker 필수' }, { status: 400 })

  const { data, error } = await supabase.from('accounts').insert({ name, broker, owner, type, currency: currency ?? 'KRW' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 2: `app/api/portfolio/securities/route.ts`**

```typescript
// app/api/portfolio/securities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase.from('securities').select('*').order('ticker')
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { ticker, name, asset_class, country, style, sector, currency } = body
  if (!ticker || !name) return NextResponse.json({ error: 'ticker, name 필수' }, { status: 400 })

  const { data, error } = await supabase
    .from('securities')
    .upsert({ ticker: ticker.toUpperCase(), name, asset_class, country, style, sector, currency: currency ?? 'USD' }, { onConflict: 'ticker' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 3: `app/api/portfolio/holdings/route.ts`**

```typescript
// app/api/portfolio/holdings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase
    .from('holdings')
    .select('*, account:accounts(*), security:securities(*)')
    .order('updated_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { account_id, security_id, quantity, avg_price, total_invested, snapshot_date } = body
  if (!account_id || !security_id || quantity == null) {
    return NextResponse.json({ error: 'account_id, security_id, quantity 필수' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('holdings')
    .upsert({
      account_id, security_id, quantity, avg_price, total_invested,
      snapshot_date: snapshot_date ?? new Date().toISOString().slice(0, 10),
      source: 'manual',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'account_id,security_id' })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

**Step 4: `components/portfolio/HoldingsManager.tsx`**

인증된 사용자가 계좌, 종목, 포지션을 폼으로 입력하는 관리 화면:

```typescript
// components/portfolio/HoldingsManager.tsx
'use client'

import { useState } from 'react'
import type { Account, Security } from '@/lib/portfolio/types'

interface Props {
  accounts: Account[]
  securities: Security[]
}

type Tab = 'holdings' | 'accounts' | 'securities'

export default function HoldingsManager({ accounts: initAccounts, securities: initSecurities }: Props) {
  const [tab, setTab] = useState<Tab>('holdings')
  const [accounts, setAccounts] = useState(initAccounts)
  const [securities, setSecurities] = useState(initSecurities)
  const [msg, setMsg] = useState('')

  async function post(url: string, body: object) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? '오류')
    return json
  }

  async function addAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      const acc = await post('/api/portfolio/accounts', {
        name: fd.get('name'), broker: fd.get('broker'),
        owner: fd.get('owner'), type: fd.get('type'), currency: 'KRW',
      })
      setAccounts(prev => [...prev, acc])
      setMsg('계좌 추가 완료')
      e.currentTarget.reset()
    } catch (err: any) { setMsg(err.message) }
  }

  async function addSecurity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      const sec = await post('/api/portfolio/securities', {
        ticker: fd.get('ticker'), name: fd.get('name'),
        asset_class: fd.get('asset_class'), country: fd.get('country'),
        style: fd.get('style'), sector: fd.get('sector'),
        currency: fd.get('currency') || 'USD',
      })
      setSecurities(prev => {
        const idx = prev.findIndex(s => s.id === sec.id)
        return idx >= 0 ? prev.map((s, i) => i === idx ? sec : s) : [...prev, sec]
      })
      setMsg('종목 추가/업데이트 완료')
      e.currentTarget.reset()
    } catch (err: any) { setMsg(err.message) }
  }

  async function addHolding(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await post('/api/portfolio/holdings', {
        account_id: fd.get('account_id'),
        security_id: fd.get('security_id'),
        quantity: parseFloat(fd.get('quantity') as string),
        avg_price: parseFloat(fd.get('avg_price') as string),
        total_invested: parseFloat(fd.get('total_invested') as string),
        snapshot_date: fd.get('snapshot_date'),
      })
      setMsg('포지션 저장 완료')
      e.currentTarget.reset()
    } catch (err: any) { setMsg(err.message) }
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
  const btnCls = 'bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors'
  const labelCls = 'block text-xs text-slate-500 mb-1'

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex gap-2">
        {(['holdings', 'accounts', 'securities'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {t === 'holdings' ? '포지션' : t === 'accounts' ? '계좌' : '종목'}
          </button>
        ))}
      </div>

      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">{msg}</div>}

      {tab === 'accounts' && (
        <form onSubmit={addAccount} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h2 className="font-semibold text-slate-700">계좌 추가</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>계좌명 *</label><input name="name" required className={inputCls} placeholder="카카오페이 종합위탁" /></div>
            <div><label className={labelCls}>금융사 *</label><input name="broker" required className={inputCls} placeholder="카카오페이" /></div>
            <div><label className={labelCls}>소유자</label><input name="owner" className={inputCls} placeholder="본인" /></div>
            <div><label className={labelCls}>유형</label>
              <select name="type" className={inputCls}>
                <option value="종합위탁">종합위탁</option>
                <option value="연금저축">연금저축</option>
                <option value="ISA">ISA</option>
                <option value="IRP">IRP</option>
              </select>
            </div>
          </div>
          <button type="submit" className={btnCls}>추가</button>
          {accounts.length > 0 && (
            <div className="mt-4 space-y-1">
              {accounts.map(a => <div key={a.id} className="text-sm text-slate-600">{a.broker} · {a.name} ({a.type})</div>)}
            </div>
          )}
        </form>
      )}

      {tab === 'securities' && (
        <form onSubmit={addSecurity} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h2 className="font-semibold text-slate-700">종목 추가/수정</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>티커 *</label><input name="ticker" required className={inputCls} placeholder="SCHD" /></div>
            <div><label className={labelCls}>종목명 *</label><input name="name" required className={inputCls} placeholder="슈왑 배당 ETF" /></div>
            <div><label className={labelCls}>자산군</label>
              <select name="asset_class" className={inputCls}>
                <option value="주식">주식</option><option value="채권">채권</option><option value="대체자산">대체자산</option>
              </select>
            </div>
            <div><label className={labelCls}>국가</label>
              <select name="country" className={inputCls}><option value="US">US</option><option value="KR">KR</option></select>
            </div>
            <div><label className={labelCls}>스타일</label>
              <select name="style" className={inputCls}>
                <option value="성장">성장</option><option value="인컴">인컴</option><option value="안전">안전</option>
              </select>
            </div>
            <div><label className={labelCls}>섹터</label><input name="sector" className={inputCls} placeholder="테크" /></div>
            <div><label className={labelCls}>통화</label>
              <select name="currency" className={inputCls}><option value="USD">USD</option><option value="KRW">KRW</option></select>
            </div>
          </div>
          <button type="submit" className={btnCls}>추가/업데이트</button>
        </form>
      )}

      {tab === 'holdings' && (
        <form onSubmit={addHolding} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h2 className="font-semibold text-slate-700">포지션 입력 (스냅샷)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>계좌 *</label>
              <select name="account_id" required className={inputCls}>
                <option value="">선택</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.broker} · {a.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>종목 *</label>
              <select name="security_id" required className={inputCls}>
                <option value="">선택</option>
                {securities.map(s => <option key={s.id} value={s.id}>{s.ticker} · {s.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>보유수량 *</label><input name="quantity" type="number" step="any" required className={inputCls} placeholder="49.725" /></div>
            <div><label className={labelCls}>평균매입가 (원화)</label><input name="avg_price" type="number" step="any" className={inputCls} placeholder="37440" /></div>
            <div><label className={labelCls}>투자원금 (원화)</label><input name="total_invested" type="number" step="any" className={inputCls} placeholder="2081666" /></div>
            <div><label className={labelCls}>기준일</label><input name="snapshot_date" type="date" className={inputCls} defaultValue={new Date().toISOString().slice(0, 10)} /></div>
          </div>
          <button type="submit" className={btnCls}>저장</button>
        </form>
      )}
    </div>
  )
}
```

**Step 5: `app/portfolio/holdings/page.tsx`**

```typescript
// app/portfolio/holdings/page.tsx
import { fetchAccounts, fetchSecurities } from '@/lib/portfolio/fetch'
import HoldingsManager from '@/components/portfolio/HoldingsManager'

export const dynamic = 'force-dynamic'

export default async function HoldingsPage() {
  const [accounts, securities] = await Promise.all([fetchAccounts(), fetchSecurities()])
  return <HoldingsManager accounts={accounts} securities={securities} />
}
```

**Step 6: Commit**

```bash
git add app/api/portfolio/ app/portfolio/holdings/ components/portfolio/HoldingsManager.tsx
git commit -m "feat: holdings/accounts/securities CRUD API and manager UI"
```

---

## Task 8: 리밸런싱 페이지

**Files:**
- Create: `app/portfolio/rebalance/page.tsx`
- Create: `components/portfolio/RebalanceDashboard.tsx`
- Create: `app/api/portfolio/targets/route.ts`

**Step 1: `app/api/portfolio/targets/route.ts`**

```typescript
// app/api/portfolio/targets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase.from('target_allocations').select('*').order('level').order('key')
  return NextResponse.json(data ?? [])
}

export async function PUT(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // body: [{ level, key, target_pct }]
  const body: { level: string; key: string; target_pct: number }[] = await req.json()

  const { error } = await supabase
    .from('target_allocations')
    .upsert(body, { onConflict: 'level,key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

**Step 2: `components/portfolio/RebalanceDashboard.tsx`**

```typescript
// components/portfolio/RebalanceDashboard.tsx
'use client'

import { useState } from 'react'
import type { PortfolioSummary, TargetAllocation } from '@/lib/portfolio/types'

interface Props {
  summary: PortfolioSummary
  targets: TargetAllocation[]
}

function groupPct(positions: PortfolioSummary['positions'], key: (p: PortfolioSummary['positions'][0]) => string, total: number) {
  const map: Record<string, number> = {}
  for (const p of positions) {
    const k = key(p)
    map[k] = (map[k] ?? 0) + p.market_value
  }
  return Object.entries(map).map(([k, v]) => ({ key: k, actual_pct: total > 0 ? v / total : 0, market_value: v }))
}

export default function RebalanceDashboard({ summary, targets }: Props) {
  const [editTargets, setEditTargets] = useState<TargetAllocation[]>(targets)
  const [saved, setSaved] = useState(false)
  const total = summary.total_market_value

  const byAssetClass = groupPct(summary.positions, p => p.security.asset_class ?? '기타', total)
  const byTicker = groupPct(summary.positions, p => p.security.ticker, total)

  function getTarget(level: string, key: string) {
    return editTargets.find(t => t.level === level && t.key === key)?.target_pct ?? 0
  }

  function setTarget(level: string, key: string, pct: number) {
    setEditTargets(prev => {
      const idx = prev.findIndex(t => t.level === level && t.key === key)
      if (idx >= 0) return prev.map((t, i) => i === idx ? { ...t, target_pct: pct } : t)
      return [...prev, { id: '', level: level as any, key, target_pct: pct }]
    })
    setSaved(false)
  }

  async function saveTargets() {
    const body = editTargets.filter(t => t.target_pct > 0).map(({ level, key, target_pct }) => ({ level, key, target_pct }))
    await fetch('/api/portfolio/targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaved(true)
  }

  const diffColor = (diff: number) => {
    if (Math.abs(diff) < 0.01) return 'text-slate-400'
    return diff > 0 ? 'text-rose-500' : 'text-blue-500'
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">리밸런싱</h2>
        <button onClick={saveTargets} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800">
          {saved ? '저장됨 ✓' : '목표 저장'}
        </button>
      </div>

      {/* 자산군 레이어 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold text-sm text-slate-600">자산군 목표 비율</div>
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
            <th className="text-left px-4 py-3">자산군</th>
            <th className="text-right px-4 py-3">현재</th>
            <th className="text-right px-4 py-3">목표</th>
            <th className="text-right px-4 py-3">차이</th>
            <th className="text-right px-4 py-3">필요 금액</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {byAssetClass.map(({ key, actual_pct, market_value }) => {
              const target = getTarget('asset_class', key)
              const diff = actual_pct - target
              const needed = (target - actual_pct) * total
              return (
                <tr key={key} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{key}</td>
                  <td className="px-4 py-3 text-right">{(actual_pct * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" min={0} max={100} step={0.1}
                      value={(target * 100).toFixed(1)}
                      onChange={e => setTarget('asset_class', key, parseFloat(e.target.value) / 100)}
                      className="w-20 text-right border border-slate-200 rounded px-2 py-1 text-sm"
                    />%
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${diffColor(diff)}`}>
                    {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${needed >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                    {needed >= 0 ? '+' : ''}{Math.round(Math.abs(needed) / 10000).toLocaleString()}만원 {needed >= 0 ? '매수' : '매도'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 종목 레이어 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold text-sm text-slate-600">종목별 목표 비율</div>
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
            <th className="text-left px-4 py-3">티커</th>
            <th className="text-right px-4 py-3">현재</th>
            <th className="text-right px-4 py-3">목표</th>
            <th className="text-right px-4 py-3">차이</th>
            <th className="text-right px-4 py-3">필요 금액</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {byTicker.sort((a, b) => b.market_value - a.market_value).map(({ key, actual_pct }) => {
              const target = getTarget('ticker', key)
              const diff = actual_pct - target
              const needed = (target - actual_pct) * total
              return (
                <tr key={key} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800">{key}</td>
                  <td className="px-4 py-3 text-right">{(actual_pct * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" min={0} max={100} step={0.1}
                      value={(target * 100).toFixed(1)}
                      onChange={e => setTarget('ticker', key, parseFloat(e.target.value) / 100)}
                      className="w-20 text-right border border-slate-200 rounded px-2 py-1 text-sm"
                    />%
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${diffColor(diff)}`}>
                    {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${needed >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                    {needed >= 0 ? '+' : ''}{Math.round(Math.abs(needed) / 10000).toLocaleString()}만원 {needed >= 0 ? '매수' : '매도'}
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

**Step 3: `app/portfolio/rebalance/page.tsx`**

```typescript
// app/portfolio/rebalance/page.tsx
import { fetchPortfolioSummary, fetchTargetAllocations } from '@/lib/portfolio/fetch'
import RebalanceDashboard from '@/components/portfolio/RebalanceDashboard'

export const dynamic = 'force-dynamic'

export default async function RebalancePage() {
  const [summary, targets] = await Promise.all([
    fetchPortfolioSummary(),
    fetchTargetAllocations(),
  ])
  return <RebalanceDashboard summary={summary} targets={targets} />
}
```

**Step 4: 서브탭 네비게이션 컴포넌트**

`/portfolio` 하위 페이지들을 위한 서브탭 추가. `components/portfolio/PortfolioNav.tsx`:

```typescript
// components/portfolio/PortfolioNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: '대시보드', href: '/portfolio' },
  { label: '포지션 관리', href: '/portfolio/holdings' },
  { label: '리밸런싱', href: '/portfolio/rebalance' },
  { label: 'Import', href: '/portfolio/import' },
]

export default function PortfolioNav() {
  const pathname = usePathname()
  return (
    <div className="border-b border-slate-100 bg-white">
      <nav className="max-w-7xl mx-auto px-4 flex gap-1 py-2">
        {TABS.map(t => {
          const active = t.href === '/portfolio' ? pathname === '/portfolio' : pathname.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${active ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-700'}`}>
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
```

`app/portfolio/layout.tsx` 생성:

```typescript
// app/portfolio/layout.tsx
import PortfolioNav from '@/components/portfolio/PortfolioNav'

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PortfolioNav />
      {children}
    </>
  )
}
```

**Step 5: Commit**

```bash
git add app/portfolio/rebalance/ app/api/portfolio/targets/ components/portfolio/RebalanceDashboard.tsx components/portfolio/PortfolioNav.tsx app/portfolio/layout.tsx
git commit -m "feat: rebalancing page with target allocation editor and portfolio sub-nav"
```

---

## Task 9: 구글시트 Import (포트폴리오)

**Files:**
- Create: `app/portfolio/import/page.tsx`
- Create: `components/portfolio/PortfolioImport.tsx`
- Create: `app/api/portfolio/import/route.ts`

**Step 1: `app/api/portfolio/import/route.ts`**

구글 시트에서 holdings 데이터를 읽어 securities + holdings 테이블에 upsert:

```typescript
// app/api/portfolio/import/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
import { google } from 'googleapis'
import { readFileSync } from 'fs'

export const dynamic = 'force-dynamic'

// 예상 컬럼 순서 (사용자 시트에 맞게 조정 필요):
// 0:소유자 1:금융사 2:계좌유형 3:티커 4:종목명 5:자산군 6:국가 7:스타일 8:섹터
// 9:보유주수 10:평균매입가(USD) 11:현재가 12:총매수금액(KRW) ... (투자원금)

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { spreadsheetId: rawId, sheetName } = await req.json()
  const urlMatch = typeof rawId === 'string' && rawId.match(/\/d\/([a-zA-Z0-9_-]+)/)
  const spreadsheetId = urlMatch ? urlMatch[1] : rawId

  if (!spreadsheetId || !sheetName) {
    return NextResponse.json({ error: 'spreadsheetId, sheetName 필수' }, { status: 400 })
  }

  let credentials: any
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!
    const jsonStr = raw.trimStart().startsWith('{') ? raw : readFileSync(raw, 'utf-8')
    credentials = JSON.parse(jsonStr)
  } catch {
    return NextResponse.json({ error: 'Google 서비스 계정 설정 오류' }, { status: 500 })
  }

  const auth = new google.auth.GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] })
  const sheets = google.sheets({ version: 'v4', auth })

  let values: string[][]
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:X`,
      valueRenderOption: 'FORMATTED_VALUE',
    })
    values = (res.data.values ?? []) as string[][]
  } catch (err: any) {
    return NextResponse.json({ error: `Google Sheets 오류: ${err.message}` }, { status: 422 })
  }

  // 헤더 스킵, 빈 행 스킵
  const rows = values.slice(1).filter(r => r[3] && r[4]) // ticker, name 필수

  let imported = 0
  const errors: string[] = []

  for (const row of rows) {
    const ticker = (row[3] ?? '').trim().toUpperCase()
    const name = (row[4] ?? '').trim()
    if (!ticker || !name) continue

    try {
      // 1. security upsert
      const { data: sec } = await supabase
        .from('securities')
        .upsert({
          ticker,
          name,
          asset_class: (row[5] ?? '').trim() || null,
          country: (row[6] ?? '').trim() || null,
          style: (row[7] ?? '').trim() || null,
          sector: (row[8] ?? '').trim() || null,
          currency: (row[6] ?? '').trim() === 'KR' ? 'KRW' : 'USD',
        }, { onConflict: 'ticker' })
        .select().single()

      if (!sec) continue

      // 2. 계좌 find or create
      const broker = (row[1] ?? '').trim()
      const accType = (row[2] ?? '').trim()
      const owner = (row[0] ?? '').trim()
      let account: any = null

      if (broker) {
        const { data: existing } = await supabase
          .from('accounts')
          .select('*')
          .eq('broker', broker)
          .eq('type', accType)
          .maybeSingle()

        if (existing) {
          account = existing
        } else {
          const { data: created } = await supabase
            .from('accounts')
            .insert({ name: `${broker} ${accType}`, broker, owner, type: accType })
            .select().single()
          account = created
        }
      }

      if (!account) continue

      // 3. holding upsert
      const qty = parseFloat((row[9] ?? '0').replace(/,/g, ''))
      const avgPrice = parseFloat((row[10] ?? '0').replace(/,/g, ''))
      const totalInvested = parseFloat((row[12] ?? '0').replace(/,/g, ''))

      if (isNaN(qty) || qty <= 0) continue

      await supabase.from('holdings').upsert({
        account_id: account.id,
        security_id: sec.id,
        quantity: qty,
        avg_price: avgPrice || null,
        total_invested: totalInvested || null,
        snapshot_date: new Date().toISOString().slice(0, 10),
        source: 'import',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'account_id,security_id' })

      imported++
    } catch (err: any) {
      errors.push(`${ticker}: ${err.message}`)
    }
  }

  return NextResponse.json({ imported, errors })
}
```

**Step 2: `components/portfolio/PortfolioImport.tsx`**

```typescript
// components/portfolio/PortfolioImport.tsx
'use client'

import { useState } from 'react'

export default function PortfolioImport() {
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [sheetName, setSheetName] = useState('포트폴리오')
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/portfolio/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, sheetName }),
      })
      setResult(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <h2 className="font-semibold text-slate-700">구글시트에서 포트폴리오 Import</h2>
        <p className="text-xs text-slate-400">
          시트 컬럼 순서: A=소유자, B=금융사, C=계좌유형, D=티커, E=종목명,
          F=자산군, G=국가, H=스타일, I=섹터, J=보유주수, K=평균매입가(USD),
          L=현재가, M=총매수금액(KRW)
        </p>
        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">스프레드시트 URL 또는 ID</label>
            <input value={spreadsheetId} onChange={e => setSpreadsheetId(e.target.value)}
              className={inputCls} placeholder="https://docs.google.com/spreadsheets/d/..." required />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">시트 이름</label>
            <input value={sheetName} onChange={e => setSheetName(e.target.value)}
              className={inputCls} placeholder="포트폴리오" required />
          </div>
          <button type="submit" disabled={loading}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
            {loading ? 'Import 중...' : 'Import 시작'}
          </button>
        </form>
        {result && (
          <div className={`rounded-lg p-4 text-sm ${result.errors.length === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            <p className="font-semibold">{result.imported}개 종목 import 완료</p>
            {result.errors.map((e, i) => <p key={i} className="text-xs mt-1">{e}</p>)}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 3: `app/portfolio/import/page.tsx`**

```typescript
// app/portfolio/import/page.tsx
import PortfolioImport from '@/components/portfolio/PortfolioImport'
export const dynamic = 'force-dynamic'
export default function ImportPage() { return <PortfolioImport /> }
```

**Step 4: 테스트**

1. `/portfolio/import` 접속
2. 구글시트 URL + 시트명 입력 → Import 시작
3. 결과 메시지 확인
4. `/portfolio` 대시보드에서 데이터 반영 확인

**Step 5: Commit**

```bash
git add app/portfolio/import/ components/portfolio/PortfolioImport.tsx app/api/portfolio/import/
git commit -m "feat: google sheets portfolio import"
```

---

## Task 10: 빌드 검증 및 배포

**Step 1: 타입 검사 + 빌드**

```bash
npx tsc --noEmit
npm run build
```

오류 있으면 수정 후 재실행

**Step 2: Vercel 프로덕션 배포**

```bash
vercel --prod
```

**Step 3: 최종 확인 체크리스트**

- [ ] `/portfolio` 대시보드 — KPI 카드, 차트 4개, 종목 테이블
- [ ] `/portfolio/holdings` — 계좌/종목/포지션 입력 폼 동작
- [ ] `/portfolio/rebalance` — 목표 비율 입력 + 저장 + 차이 계산
- [ ] `/portfolio/import` — 구글시트 import 동작
- [ ] `/api/portfolio/prices?tickers=SCHD,005930.KS` — 현재가 응답
- [ ] 현재가 1시간 캐시 동작 (price_cache 테이블 확인)

**Step 4: Commit**

```bash
git commit -m "feat: portfolio management feature complete"
```
