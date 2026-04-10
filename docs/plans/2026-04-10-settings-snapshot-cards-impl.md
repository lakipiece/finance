# Settings & Snapshot Cards Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 옵션 관리 설정 페이지(계좌유형/국가/통화/자산군/섹터 CRUD + 색상), 계좌 드래그앤드롭 정렬, 스냅샷 카드 리디자인(평가액/P&L/섹터 비중 DB 저장 + 업데이트 버튼) 구현

**Architecture:** DB에 `option_list` 테이블을 추가해 드롭다운 옵션과 hex 색상을 관리하고, `accounts.sort_order`로 계좌 순서를 저장한다. `snapshots` 테이블에 `total_market_value / total_invested / sector_breakdown / value_updated_at` 컬럼을 추가하고, 버튼 클릭 시 price_history에서 계산해 저장한다. 스냅샷 카드는 저장된 값을 바로 읽어 표시한다.

**Tech Stack:** Next.js 14 App Router, postgres.js, @dnd-kit/core + @dnd-kit/sortable, Recharts, Tailwind CSS

---

## Context

- DB 접근: `getSql()` from `@/lib/db`, postgres.js 태그드 템플릿 문법
- Auth: `await auth()` — POST/PATCH/DELETE에 필요
- 스타일: Tailwind CSS. 동적 색상은 Tailwind 대신 `style={{ ... }}` 인라인 사용
- 배포: `git push origin master` → `ssh ubuntu "cd ~/finance && git pull && docker compose up -d --build app"`
- postgres.js quirk: `date` 컬럼은 `Date` 객체로 반환됨 → `.toISOString().slice(0,10)` 필요
- 기존 컬럼 참고: `accounts(id, name, broker, owner, type, currency, created_at)`, `snapshots(id, date, memo, created_at)`

---

### Task 1: DB 마이그레이션

**Files:**
- Create: `docs/sql/2026-04-10-settings-migration.sql`

**Step 1: SQL 파일 작성**

```sql
-- option_list: 드롭다운 옵션 관리
CREATE TABLE IF NOT EXISTS option_list (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL,
  label      text NOT NULL,
  value      text NOT NULL,
  color_hex  text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (type, value)
);

INSERT INTO option_list (type, label, value, color_hex, sort_order) VALUES
  ('account_type', 'CMA',    'CMA',    '#10b981', 0),
  ('account_type', 'ISA',    'ISA',    '#3b82f6', 1),
  ('account_type', 'IRP',    'IRP',    '#8b5cf6', 2),
  ('account_type', '증권',   '증권',   '#f59e0b', 3),
  ('account_type', '은행',   '은행',   '#64748b', 4),
  ('account_type', '연금저축','연금저축','#ec4899', 5),
  ('country', '국내',   '국내',   '#10b981', 0),
  ('country', '미국',   '미국',   '#3b82f6', 1),
  ('country', '글로벌', '글로벌', '#f59e0b', 2),
  ('country', '기타',   '기타',   '#94a3b8', 3),
  ('currency', 'KRW', 'KRW', '#10b981', 0),
  ('currency', 'USD', 'USD', '#3b82f6', 1),
  ('asset_class', '주식', '주식', '#3b82f6', 0),
  ('asset_class', '채권', '채권', '#8b5cf6', 1),
  ('asset_class', '현금', '현금', '#14b8a6', 2),
  ('asset_class', '코인', '코인', '#f97316', 3),
  ('sector', 'IT',     'IT',     '#6366f1', 0),
  ('sector', '금융',   '금융',   '#f59e0b', 1),
  ('sector', '헬스케어','헬스케어','#10b981', 2),
  ('sector', '소비재', '소비재', '#ec4899', 3),
  ('sector', '에너지', '에너지', '#ef4444', 4),
  ('sector', '산업재', '산업재', '#64748b', 5),
  ('sector', '기타',   '기타',   '#94a3b8', 6)
ON CONFLICT (type, value) DO NOTHING;

-- 계좌 표시 순서
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;

-- 스냅샷 평가액 캐시
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS total_market_value numeric;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS total_invested     numeric;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS sector_breakdown   jsonb;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS value_updated_at   timestamptz;
```

**Step 2: DB에 마이그레이션 실행**

```bash
ssh ubuntu "cd ~/finance && docker compose exec db psql -U finance -d finance -f /dev/stdin" < docs/sql/2026-04-10-settings-migration.sql
```

**Step 3: 확인**

```bash
ssh ubuntu "cd ~/finance && docker compose exec db psql -U finance -d finance -c 'SELECT type, count(*) FROM option_list GROUP BY type;'"
```

Expected: account_type 6, country 4, currency 2, asset_class 4, sector 7

**Step 4: Commit**

```bash
git add docs/sql/2026-04-10-settings-migration.sql
git commit -m "chore: add option_list migration + accounts/snapshots columns"
```

---

### Task 2: Options API

**Files:**
- Create: `app/api/portfolio/options/route.ts`
- Create: `app/api/portfolio/options/[id]/route.ts`

**Step 1: `app/api/portfolio/options/route.ts` 작성**

```typescript
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

type OptionRow = { id: string; type: string; label: string; value: string; color_hex: string | null; sort_order: number }

export async function GET() {
  const sql = getSql()
  const rows = await sql<OptionRow[]>`
    SELECT * FROM option_list ORDER BY type, sort_order, label
  `
  const grouped: Record<string, OptionRow[]> = {}
  for (const r of rows) {
    if (!grouped[r.type]) grouped[r.type] = []
    grouped[r.type].push(r)
  }
  return NextResponse.json(grouped)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { type, label, value, color_hex } = await req.json()
  const sql = getSql()
  const [{ max }] = await sql<{ max: number }[]>`
    SELECT COALESCE(MAX(sort_order), -1) as max FROM option_list WHERE type = ${type}
  `
  const [row] = await sql`
    INSERT INTO option_list (type, label, value, color_hex, sort_order)
    VALUES (${type}, ${label}, ${value}, ${color_hex ?? null}, ${(max as number) + 1})
    ON CONFLICT (type, value) DO NOTHING
    RETURNING *
  `
  if (!row) return NextResponse.json({ error: '이미 존재하는 값입니다' }, { status: 409 })
  return NextResponse.json(row, { status: 201 })
}
```

**Step 2: `app/api/portfolio/options/[id]/route.ts` 작성**

```typescript
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const sql = getSql()
  const allowed = ['label', 'color_hex', 'sort_order']
  const fields = Object.entries(body)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => sql`${sql(k)} = ${v as string}`)
  if (fields.length === 0) return NextResponse.json({ error: 'no fields' }, { status: 400 })
  const setClauses = fields.reduce((a, b) => sql`${a}, ${b}`)
  const [row] = await sql`UPDATE option_list SET ${setClauses} WHERE id = ${params.id} RETURNING *`
  return NextResponse.json(row)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  await sql`DELETE FROM option_list WHERE id = ${params.id}`
  return NextResponse.json({ ok: true })
}
```

**Step 3: 브라우저에서 확인**
`GET /api/portfolio/options` → `{ account_type: [...], country: [...], ... }` 반환 확인

**Step 4: Commit**

```bash
git add app/api/portfolio/options/
git commit -m "feat: options CRUD API"
```

---

### Task 3: 계좌 재정렬 API

**Files:**
- Create: `app/api/portfolio/accounts/reorder/route.ts`
- Modify: `app/api/portfolio/accounts/route.ts` — GET ORDER BY 변경

**Step 1: reorder route 작성**

```typescript
// app/api/portfolio/accounts/reorder/route.ts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const items: { id: string; sort_order: number }[] = await req.json()
  const sql = getSql()
  await Promise.all(
    items.map(({ id, sort_order }) =>
      sql`UPDATE accounts SET sort_order = ${sort_order} WHERE id = ${id}`
    )
  )
  return NextResponse.json({ ok: true })
}
```

**Step 2: accounts GET ORDER BY 변경**

`app/api/portfolio/accounts/route.ts` line 9 수정:
```typescript
// 기존:
const data = await sql`SELECT * FROM accounts ORDER BY name`
// 변경:
const data = await sql`SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC`
```

**Step 3: Commit**

```bash
git add app/api/portfolio/accounts/reorder/route.ts app/api/portfolio/accounts/route.ts
git commit -m "feat: account reorder API"
```

---

### Task 4: dnd-kit 설치 + AccountsManager 드래그 정렬

**Files:**
- Modify: `components/portfolio/AccountsManager.tsx`

**Step 1: dnd-kit 설치**

```bash
cd /Users/lakipiece/dev/ledger && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: AccountsManager에 드래그 정렬 추가**

`components/portfolio/AccountsManager.tsx` 상단 import 추가:
```typescript
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

계좌 목록 아이템을 감싸는 SortableAccountItem 컴포넌트 추가 (AccountsManager 함수 위에):
```typescript
function SortableAccountItem({ account, isSelected, onClick, children }: {
  account: { id: string }
  isSelected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: account.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500 touch-none"
        tabIndex={-1}
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8-16a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
        </svg>
      </button>
      <div className="flex-1" onClick={onClick}>{children}</div>
    </div>
  )
}
```

AccountsManager 함수 내부에 추가:
```typescript
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
)

async function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return
  const oldIndex = accounts.findIndex(a => a.id === active.id)
  const newIndex = accounts.findIndex(a => a.id === over.id)
  const reordered = arrayMove(accounts, oldIndex, newIndex)
  setAccounts(reordered)
  await fetch('/api/portfolio/accounts/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reordered.map((a, i) => ({ id: a.id, sort_order: i }))),
  })
}
```

계좌 목록 렌더링을 DndContext + SortableContext로 감싸기:
```typescript
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={accounts.map(a => a.id)} strategy={verticalListSortingStrategy}>
    {accounts.map(a => (
      <SortableAccountItem key={a.id} account={a} isSelected={selectedAccountId === a.id} onClick={() => setSelectedAccountId(a.id)}>
        {/* 기존 계좌 카드 내용 */}
      </SortableAccountItem>
    ))}
  </SortableContext>
</DndContext>
```

**Step 3: 확인**: 계좌 목록에서 ⠿ 아이콘 드래그하면 순서 변경되고 새로고침 후 유지되는지 확인

**Step 4: Commit**

```bash
git add components/portfolio/AccountsManager.tsx package.json package-lock.json
git commit -m "feat: account drag-and-drop sort order"
```

---

### Task 5: 설정 페이지 — OptionsManager 컴포넌트

**Files:**
- Create: `components/portfolio/OptionsManager.tsx`
- Modify: `app/portfolio/settings/page.tsx`

**Step 1: OptionsManager 컴포넌트 작성**

```typescript
// components/portfolio/OptionsManager.tsx
'use client'

import { useState } from 'react'

type OptionItem = { id: string; type: string; label: string; value: string; color_hex: string | null; sort_order: number }
type OptionMap = Record<string, OptionItem[]>

const PRESET_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#6366f1','#64748b','#a3e635','#94a3b8',
]

const TYPE_LABELS: Record<string, string> = {
  account_type: '계좌유형',
  country: '국가',
  currency: '통화',
  asset_class: '자산군',
  sector: '섹터',
}

export default function OptionsManager({ initialOptions }: { initialOptions: OptionMap }) {
  const [options, setOptions] = useState<OptionMap>(initialOptions)
  const [activeType, setActiveType] = useState('account_type')
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newColor, setNewColor] = useState('#3b82f6')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')

  const types = Object.keys(TYPE_LABELS)
  const currentOptions = options[activeType] ?? []

  async function handleAdd() {
    if (!newLabel.trim() || !newValue.trim()) return
    setAdding(true)
    const res = await fetch('/api/portfolio/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: activeType, label: newLabel.trim(), value: newValue.trim(), color_hex: newColor }),
    })
    if (res.ok) {
      const item = await res.json()
      setOptions(prev => ({ ...prev, [activeType]: [...(prev[activeType] ?? []), item] }))
      setNewLabel(''); setNewValue('')
      setMsg('추가됨')
    } else {
      const d = await res.json()
      setMsg(d.error ?? '오류')
    }
    setAdding(false)
    setTimeout(() => setMsg(''), 2000)
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    const res = await fetch(`/api/portfolio/options/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setOptions(prev => ({
        ...prev,
        [activeType]: (prev[activeType] ?? []).filter(o => o.id !== id),
      }))
    }
  }

  async function handleColorChange(id: string, color_hex: string) {
    setOptions(prev => ({
      ...prev,
      [activeType]: (prev[activeType] ?? []).map(o => o.id === id ? { ...o, color_hex } : o),
    }))
    await fetch(`/api/portfolio/options/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color_hex }),
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 mt-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">옵션 관리</h3>

      {/* 타입 탭 */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setActiveType(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeType === t ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* 옵션 목록 */}
      <div className="space-y-2 mb-4">
        {currentOptions.map(opt => (
          <div key={opt.id} className="flex items-center gap-2">
            {/* 색상 스와치 피커 */}
            <div className="relative group">
              <div
                className="w-5 h-5 rounded-full border border-slate-200 cursor-pointer"
                style={{ backgroundColor: opt.color_hex ?? '#94a3b8' }}
              />
              <div className="absolute left-0 top-7 z-10 hidden group-hover:flex flex-wrap gap-1 bg-white border border-slate-200 rounded-xl p-2 shadow-lg w-40">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => handleColorChange(opt.id, c)}
                    className="w-5 h-5 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: opt.color_hex === c ? '#1e293b' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <span className="text-xs font-medium text-slate-700 flex-1">{opt.label}</span>
            <span className="text-[10px] text-slate-400">{opt.value}</span>
            <button onClick={() => handleDelete(opt.id)}
              className="p-1 text-slate-300 hover:text-red-400 transition-colors">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
        {currentOptions.length === 0 && (
          <p className="text-xs text-slate-400 py-2">옵션이 없습니다</p>
        )}
      </div>

      {/* 추가 폼 */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        <div className="relative group">
          <div
            className="w-5 h-5 rounded-full border border-slate-200 cursor-pointer shrink-0"
            style={{ backgroundColor: newColor }}
          />
          <div className="absolute left-0 top-7 z-10 hidden group-hover:flex flex-wrap gap-1 bg-white border border-slate-200 rounded-xl p-2 shadow-lg w-40">
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)}
                className="w-5 h-5 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c,
                  borderColor: newColor === c ? '#1e293b' : 'transparent',
                }}
              />
            ))}
          </div>
        </div>
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
          placeholder="라벨 (예: 미국주식)" onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
        <input value={newValue} onChange={e => setNewValue(e.target.value)}
          placeholder="값 (예: 미국주식)" onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
        <button onClick={handleAdd} disabled={adding}
          className="bg-slate-700 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
          추가
        </button>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </div>
  )
}
```

**Step 2: settings/page.tsx 수정**

```typescript
// app/portfolio/settings/page.tsx
import Link from 'next/link'
import { getSql } from '@/lib/db'
import OptionsManager from '@/components/portfolio/OptionsManager'

export const dynamic = 'force-dynamic'

type OptionItem = { id: string; type: string; label: string; value: string; color_hex: string | null; sort_order: number }

export default async function PortfolioSettingsPage() {
  const sql = getSql()
  const rows = await sql<OptionItem[]>`SELECT * FROM option_list ORDER BY type, sort_order, label`
  const grouped: Record<string, OptionItem[]> = {}
  for (const r of rows) {
    if (!grouped[r.type]) grouped[r.type] = []
    grouped[r.type].push(r)
  }

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
      <OptionsManager initialOptions={grouped} />
    </div>
  )
}
```

**Step 3: 확인**: `/portfolio/settings` 에서 탭 전환, 옵션 추가/삭제, 색상 변경 동작 확인

**Step 4: Commit**

```bash
git add components/portfolio/OptionsManager.tsx app/portfolio/settings/page.tsx
git commit -m "feat: options manager settings page"
```

---

### Task 6: SecuritiesManager — DB 옵션 + 인라인 색상 적용

**Files:**
- Modify: `app/portfolio/securities/page.tsx` — options 조회 추가
- Modify: `components/portfolio/SecuritiesManager.tsx` — 하드코딩 제거, props 기반 색상

**Step 1: securities page에서 options 조회**

`app/portfolio/securities/page.tsx`의 서버 데이터 페치에 추가:
```typescript
// 기존 Promise.all에 추가
const [securities, latestPriceRows, optionsRaw] = await Promise.all([
  sql`SELECT * FROM securities ORDER BY ticker` as Promise<Security[]>,
  // ... 기존 쿼리들 ...
  sql`SELECT * FROM option_list ORDER BY type, sort_order` as Promise<OptionItem[]>,
])

const optionsGrouped: Record<string, OptionItem[]> = {}
for (const r of optionsRaw) {
  if (!optionsGrouped[r.type]) optionsGrouped[r.type] = []
  optionsGrouped[r.type].push(r)
}
```

SecuritiesManager에 `options={optionsGrouped}` prop 추가

**Step 2: SecuritiesManager Props 타입 + 색상 함수 수정**

Props에 추가:
```typescript
type OptionItem = { id: string; type: string; label: string; value: string; color_hex: string | null }
interface Props {
  // ... 기존 ...
  options: Record<string, OptionItem[]>
}
```

기존 `COUNTRY_STYLE`, `ASSET_STYLE`, `DEFAULT_STYLE`, `cardStyle` 함수 제거하고 대체:
```typescript
function getOptionColor(options: Record<string, OptionItem[]>, type: string, value: string | null): string {
  if (!value) return '#94a3b8'
  return options[type]?.find(o => o.value === value)?.color_hex ?? '#94a3b8'
}

function cardInlineStyle(options: Record<string, OptionItem[]>, country: string | null, assetClass: string | null) {
  // asset_class 우선
  const hex = assetClass && assetClass !== '주식'
    ? getOptionColor(options, 'asset_class', assetClass)
    : getOptionColor(options, 'country', country)
  return {
    borderLeftColor: hex,
    badgeBg: hex + '20',  // ~12% opacity
    badgeText: hex,
    tickerBg: hex + '15',
    tickerText: hex,
  }
}
```

카드 렌더링에서 className 기반 스타일을 인라인 스타일로 교체:
```tsx
const cs = cardInlineStyle(options, sec.country, sec.asset_class)
<div className="... border-l-2" style={{ borderLeftColor: cs.borderLeftColor }}>
  <span style={{ backgroundColor: cs.badgeBg, color: cs.badgeText }}>
    {sec.country}
  </span>
```

드롭다운 옵션도 DB 기반으로 교체:
```tsx
// asset_class 드롭다운
{(options.asset_class ?? []).map(o => (
  <option key={o.value} value={o.value}>{o.label}</option>
))}
// country 드롭다운
{(options.country ?? []).map(o => (
  <option key={o.value} value={o.value}>{o.label}</option>
))}
// currency 드롭다운
{(options.currency ?? []).map(o => (
  <option key={o.value} value={o.value}>{o.label}</option>
))}
// sector: 기존 text input 유지하되 datalist로 제안 표시
<input list="sector-options" ... />
<datalist id="sector-options">
  {(options.sector ?? []).map(o => <option key={o.value} value={o.value} />)}
</datalist>
```

**Step 3: 확인**: 종목 카드 색상이 settings에서 변경한 색상으로 표시되는지 확인

**Step 4: Commit**

```bash
git add app/portfolio/securities/page.tsx components/portfolio/SecuritiesManager.tsx
git commit -m "feat: securities manager uses DB options and inline colors"
```

---

### Task 7: TabNav에 설정 탭 추가

**Files:**
- Modify: `components/TabNav.tsx`

**Step 1: PORTFOLIO_TABS에 설정 추가**

```typescript
const PORTFOLIO_TABS = [
  { label: '대시보드', href: '/portfolio' },
  { label: '스냅샷', href: '/portfolio/snapshots' },
  { label: '수익', href: '/portfolio/income' },
  { label: '계좌관리', href: '/portfolio/accounts' },
  { label: '종목관리', href: '/portfolio/securities' },
  { label: '설정', href: '/portfolio/settings' },
]
```

**Step 2: Commit**

```bash
git add components/TabNav.tsx
git commit -m "feat: add 설정 tab to portfolio nav"
```

---

### Task 8: 스냅샷 평가액 계산 API

**Files:**
- Create: `app/api/portfolio/snapshots/refresh-values/route.ts`

**Step 1: API 작성**

```typescript
// app/api/portfolio/snapshots/refresh-values/route.ts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

const EXCHANGE_RATE_FALLBACK = 1350

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = getSql()
  const snapshots = await sql<{ id: string; date: string }[]>`
    SELECT id, date FROM snapshots ORDER BY date DESC
  `

  const securities = await sql<{ id: string; ticker: string; currency: string; country: string | null; sector: string | null; asset_class: string | null }[]>`
    SELECT id, ticker, currency, country, sector, asset_class FROM securities
  `
  const secMap = Object.fromEntries(securities.map(s => [s.id, s]))

  for (const snap of snapshots) {
    const snapDate = (snap.date as unknown) instanceof Date
      ? (snap.date as unknown as Date).toISOString().slice(0, 10)
      : String(snap.date).slice(0, 10)

    const holdings = await sql<{ security_id: string; quantity: number; avg_price: number | null }[]>`
      SELECT security_id, quantity, avg_price FROM holdings
      WHERE snapshot_id = ${snap.id} AND quantity > 0
    `
    if (holdings.length === 0) continue

    // 필요한 yahoo 티커 수집
    const tickers = securities.map(s => {
      const clean = s.ticker.startsWith('KRX:') ? s.ticker.slice(4) : s.ticker
      if (clean.includes('.')) return clean
      return s.country === '국내' ? `${clean}.KS` : clean
    })
    tickers.push('KRW=X')

    const prices = await sql<{ ticker: string; price: number }[]>`
      SELECT DISTINCT ON (ticker) ticker, price
      FROM price_history
      WHERE ticker = ANY(${tickers}) AND date <= ${snapDate}
      ORDER BY ticker, date DESC
    `
    const priceMap: Record<string, number> = {}
    for (const p of prices) priceMap[p.ticker] = Number(p.price)
    const exchangeRate = priceMap['KRW=X'] ?? EXCHANGE_RATE_FALLBACK

    let totalMarketValue = 0
    let totalInvested = 0
    const sectorAgg: Record<string, number> = {}

    for (const h of holdings) {
      const sec = secMap[h.security_id]
      if (!sec) continue
      const clean = sec.ticker.startsWith('KRX:') ? sec.ticker.slice(4) : sec.ticker
      const isKrx = sec.country === '국내'
      const yahooTicker = clean.includes('.') ? clean : (isKrx ? `${clean}.KS` : clean)
      const rawPrice = priceMap[yahooTicker] ?? 0
      const isKrw = isKrx || sec.currency === 'KRW'
      const priceKrw = isKrw ? rawPrice : rawPrice * exchangeRate

      const qty = Number(h.quantity)
      const marketVal = priceKrw * qty
      totalMarketValue += marketVal

      const avgPrice = Number(h.avg_price ?? 0)
      const investedKrw = isKrw ? avgPrice * qty : avgPrice * exchangeRate * qty
      totalInvested += investedKrw

      // 섹터 집계 (없으면 asset_class fallback, 그것도 없으면 '기타')
      const key = sec.sector || sec.asset_class || '기타'
      sectorAgg[key] = (sectorAgg[key] ?? 0) + marketVal
    }

    // 섹터 비중 %
    const sectorBreakdown: Record<string, number> = {}
    for (const [k, v] of Object.entries(sectorAgg)) {
      sectorBreakdown[k] = totalMarketValue > 0 ? Math.round((v / totalMarketValue) * 1000) / 10 : 0
    }

    await sql`
      UPDATE snapshots
      SET total_market_value = ${totalMarketValue},
          total_invested = ${totalInvested},
          sector_breakdown = ${JSON.stringify(sectorBreakdown)},
          value_updated_at = NOW()
      WHERE id = ${snap.id}
    `
  }

  return NextResponse.json({ ok: true, count: snapshots.length })
}
```

**Step 2: 확인**: `POST /api/portfolio/snapshots/refresh-values` 호출 후 snapshots 테이블에 값 저장됐는지 확인

```bash
ssh ubuntu "cd ~/finance && docker compose exec db psql -U finance -d finance -c 'SELECT id, total_market_value, value_updated_at FROM snapshots LIMIT 5;'"
```

**Step 3: Commit**

```bash
git add app/api/portfolio/snapshots/refresh-values/route.ts
git commit -m "feat: snapshot refresh-values API"
```

---

### Task 9: 스냅샷 목록 카드 리디자인 + 업데이트 버튼

**Files:**
- Modify: `app/portfolio/snapshots/page.tsx` — DB에서 저장된 값 읽기
- Modify: `components/portfolio/SnapshotList.tsx` — 새 카드 디자인

**Step 1: snapshots/page.tsx 수정**

기존의 `chartPoints` 계산 코드(price_history 재계산)를 제거하고 DB 저장값을 읽도록 변경:

```typescript
// app/portfolio/snapshots/page.tsx
import { getSql } from '@/lib/db'
import SnapshotList from '@/components/portfolio/SnapshotList'
import SnapshotCharts from '@/components/portfolio/SnapshotCharts'

export const dynamic = 'force-dynamic'

type SnapshotWithValues = {
  id: string
  date: string
  memo: string | null
  total_market_value: number | null
  total_invested: number | null
  sector_breakdown: Record<string, number> | null
  value_updated_at: string | null
}

export default async function SnapshotsPage() {
  const sql = getSql()
  const raw = await sql<SnapshotWithValues[]>`
    SELECT id, date, memo, total_market_value, total_invested, sector_breakdown, value_updated_at
    FROM snapshots ORDER BY date DESC, created_at DESC
  `
  const snapshots = raw.map(s => ({
    ...s,
    date: (s.date as unknown) instanceof Date
      ? (s.date as unknown as Date).toISOString().slice(0, 10)
      : String(s.date).slice(0, 10),
    value_updated_at: s.value_updated_at
      ? (s.value_updated_at as unknown) instanceof Date
        ? (s.value_updated_at as unknown as Date).toISOString()
        : String(s.value_updated_at)
      : null,
  }))

  // 차트 데이터: 저장된 값 사용 (2개 이상)
  const chartPoints = snapshots
    .filter(s => s.total_market_value != null)
    .slice().reverse() // 오래된 것부터
    .map(s => ({
      date: s.date,
      total_market_value: Number(s.total_market_value),
      breakdown: s.sector_breakdown ?? {},
    }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <SnapshotCharts points={chartPoints} />
      <SnapshotList snapshots={snapshots} />
    </div>
  )
}
```

**Step 2: SnapshotList 리디자인**

```typescript
// components/portfolio/SnapshotList.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type SnapshotItem = {
  id: string
  date: string
  memo: string | null
  total_market_value: number | null
  total_invested: number | null
  sector_breakdown: Record<string, number> | null
}

interface Props { snapshots: SnapshotItem[] }

function fmtKrw(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억원`
  if (v >= 10_000) return `${Math.floor(v / 10_000).toLocaleString()}만원`
  return `${Math.round(v).toLocaleString()}원`
}

export default function SnapshotList({ snapshots: initSnapshots }: Props) {
  const [snapshots, setSnapshots] = useState(initSnapshots)
  const [creating, setCreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  // 같은 날짜 suffix
  const labelMap = (() => {
    const dateCount: Record<string, number> = {}
    const dateIdx: Record<string, number> = {}
    const result: Record<string, string> = {}
    for (const s of snapshots) dateCount[s.date] = (dateCount[s.date] ?? 0) + 1
    for (const s of snapshots) {
      const count = dateCount[s.date]
      if (count === 1) { result[s.id] = s.date }
      else {
        dateIdx[s.date] = (dateIdx[s.date] ?? 0) + 1
        result[s.id] = dateIdx[s.date] === 1 ? s.date : `${s.date} -${dateIdx[s.date]}`
      }
    }
    return result
  })()

  async function handleCreate() {
    setCreating(true)
    const latest = snapshots[0]
    const res = await fetch('/api/portfolio/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), clone_from: latest?.id ?? null }),
    })
    if (!res.ok) { setCreating(false); return }
    const snap = await res.json()
    setCreating(false)
    router.push(`/portfolio/snapshots/${snap.id}`)
  }

  async function handleRefreshValues() {
    setRefreshing(true)
    await fetch('/api/portfolio/snapshots/refresh-values', { method: 'POST' })
    setRefreshing(false)
    router.refresh()
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('스냅샷을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/portfolio/snapshots/${id}`, { method: 'DELETE' })
    if (res.ok) setSnapshots(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">스냅샷</h2>
        <div className="flex gap-2">
          <button onClick={handleRefreshValues} disabled={refreshing}
            className="border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-50">
            {refreshing ? '업데이트 중...' : '평가액 업데이트'}
          </button>
          <button onClick={handleCreate} disabled={creating}
            className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
            {creating ? '생성 중...' : '+ 스냅샷 만들기'}
          </button>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-12">아직 스냅샷이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {snapshots.map((snap, i) => {
            const label = labelMap[snap.id]
            const [datePart, suffix] = label.includes(' -')
              ? [label.split(' -')[0], `-${label.split(' -')[1]}`]
              : [label, null]
            const mv = snap.total_market_value != null ? Number(snap.total_market_value) : null
            const inv = snap.total_invested != null ? Number(snap.total_invested) : null
            const pnl = mv != null && inv != null ? mv - inv : null
            const pnlPct = pnl != null && inv != null && inv > 0 ? pnl / inv : null
            const sectors = snap.sector_breakdown
              ? Object.entries(snap.sector_breakdown).sort((a, b) => b[1] - a[1]).slice(0, 5)
              : []

            return (
              <div key={snap.id}
                onClick={() => router.push(`/portfolio/snapshots/${snap.id}`)}
                className="bg-white rounded-2xl border border-slate-100 px-4 py-4 cursor-pointer hover:shadow-sm hover:border-slate-200 transition-all group relative">

                {/* 상단: 날짜(좌) + 평가액(우) */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-base font-bold text-slate-800 leading-tight">
                        {datePart.slice(0, 7)}{suffix && <span className="text-xs font-normal text-slate-400 ml-1">{suffix}</span>}
                      </p>
                      {i === 0 && (
                        <span className="text-[9px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium">최신</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{datePart}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {mv != null ? (
                      <>
                        <p className="text-lg font-bold text-slate-800 leading-tight tabular-nums">{fmtKrw(mv)}</p>
                        {pnl != null && (
                          <p className={`text-xs font-medium mt-0.5 tabular-nums ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {pnl >= 0 ? '+' : ''}{fmtKrw(pnl)}
                            {pnlPct != null && ` (${pnl >= 0 ? '+' : ''}${(pnlPct * 100).toFixed(1)}%)`}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-300">—</p>
                    )}
                  </div>
                </div>

                {/* 섹터 비중 */}
                {sectors.length > 0 && (
                  <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                    {sectors.map(([k, v]) => `${k} ${v}%`).join(' · ')}
                  </p>
                )}

                {snap.memo && <p className="text-[10px] text-slate-300 mt-1 truncate">{snap.memo}</p>}

                {/* 편집/삭제 */}
                <div className="absolute bottom-3 right-3 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); router.push(`/portfolio/snapshots/${snap.id}`) }}
                    className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={e => handleDelete(snap.id, e)}
                    className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

**Step 3: 확인**: 스냅샷 목록 페이지에서 카드 크기/레이아웃, "평가액 업데이트" 버튼 동작 확인

**Step 4: Commit**

```bash
git add app/portfolio/snapshots/page.tsx components/portfolio/SnapshotList.tsx
git commit -m "feat: snapshot card redesign with market value and sector breakdown"
```

---

### Task 10: 최종 배포

**Step 1: 전체 빌드 확인**

```bash
cd /Users/lakipiece/dev/ledger && npx tsc --noEmit 2>&1 | head -20
```

**Step 2: Push + Deploy**

```bash
git push origin master
ssh ubuntu "cd ~/finance && git pull origin master && docker compose up -d --build app 2>&1 | tail -8"
```

**Step 3: 기능 순서대로 확인**
1. `/portfolio/settings` → 옵션관리 탭에서 항목 추가/삭제/색상변경
2. `/portfolio/accounts` → 계좌 드래그 정렬
3. `/portfolio/securities` → 카드 색상이 설정 색상 반영
4. `/portfolio/snapshots` → "평가액 업데이트" 클릭 → 카드에 금액 표시
