# 신규 기능 구현 계획 (종목태그 / 지출입력 / 수입 / 유형자산)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 가계부 단건 입력 모달, 수입 관리 페이지, 유형자산 추적 페이지, 종목 태그 필터 4가지 기능을 순차적으로 추가한다.

**Architecture:** 기존 사이드바(LEDGER_TABS / PORTFOLIO_TABS) 구조를 유지하며 `/income`, `/assets` 라우트 2개를 신설한다. DB는 `postgres.js`(`getSql()`)를 통해 직접 SQL을 사용하며, 쓰기 API는 `auth()`로 인증을 확인한다. 스타일은 `lib/styles.ts`(btn, field, modal, tbl)와 Tailwind를 사용한다.

**Tech Stack:** Next.js App Router, postgres.js, Tailwind CSS, Recharts, shadcn-style custom UI

---

## 🔴 Phase 1: 종목 태그 (security_tags)

### Task 1: DB 마이그레이션 — security_tags 테이블

**Files:**
- Create: `docs/sql/2026-04-24-security-tags-migration.sql`

**Step 1: SQL 파일 작성**

```sql
-- docs/sql/2026-04-24-security-tags-migration.sql
CREATE TABLE IF NOT EXISTS security_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id UUID NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(security_id, tag)
);

ALTER TABLE security_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read security_tags" ON security_tags FOR SELECT TO anon USING (true);
```

**Step 2: Supabase SQL Editor 또는 psql에서 실행**

```bash
# 로컬 Docker DB일 경우
docker exec -i finance-db psql -U postgres -d finance < docs/sql/2026-04-24-security-tags-migration.sql
```

**Step 3: 커밋**

```bash
git add docs/sql/2026-04-24-security-tags-migration.sql
git commit -m "feat(tags): security_tags 테이블 마이그레이션"
```

---

### Task 2: 종목 태그 API

**Files:**
- Create: `app/api/portfolio/securities/[id]/tags/route.ts`

**Step 1: 라우트 파일 작성**

```ts
// app/api/portfolio/securities/[id]/tags/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const sql = getSql()
  const rows = await sql`
    SELECT id, tag FROM security_tags
    WHERE security_id = ${params.id}
    ORDER BY tag
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tag } = await req.json()
  if (!tag?.trim()) return NextResponse.json({ error: 'tag required' }, { status: 400 })

  const sql = getSql()
  const [row] = await sql`
    INSERT INTO security_tags (security_id, tag)
    VALUES (${params.id}, ${tag.trim()})
    ON CONFLICT (security_id, tag) DO NOTHING
    RETURNING id, tag
  `
  return NextResponse.json(row ?? { tag: tag.trim() })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tag } = await req.json()
  const sql = getSql()
  await sql`
    DELETE FROM security_tags
    WHERE security_id = ${params.id} AND tag = ${tag}
  `
  return NextResponse.json({ ok: true })
}
```

**Step 2: 동작 확인 (브라우저 또는 curl)**

```bash
# 태그 조회 (로그인 불필요)
curl http://localhost:3000/api/portfolio/securities/<uuid>/tags
```

**Step 3: 커밋**

```bash
git add app/api/portfolio/securities/
git commit -m "feat(tags): 종목 태그 CRUD API"
```

---

### Task 3: SecuritiesManager에 태그 입력 UI 추가

**Files:**
- Modify: `components/portfolio/SecuritiesManager.tsx`

**Step 1: Security 타입에 tags 필드 추가**

`lib/portfolio/types.ts`의 `Security` 인터페이스에 추가:

```ts
tags?: string[]   // security_tags에서 JOIN 또는 별도 fetch
```

**Step 2: SecurityModal 내 태그 상태 추가**

`SecurityModal` 함수 내 state에 추가:

```ts
const [tags, setTags] = useState<string[]>(security?.tags ?? [])
const [tagInput, setTagInput] = useState('')
```

**Step 3: 태그 입력 UI 블록 추가** (모달 필드 목록 하단, 저장 버튼 위)

```tsx
{/* 태그 */}
<div>
  <label className={field.label}>태그</label>
  <div className="flex flex-wrap gap-1.5 mb-2">
    {tags.map(t => (
      <span key={t} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
        {t}
        <button type="button" onClick={() => setTags(tags.filter(x => x !== t))}
          className="text-slate-400 hover:text-slate-700">×</button>
      </span>
    ))}
  </div>
  <input
    className={field.input}
    placeholder="태그 입력 후 Enter"
    value={tagInput}
    onChange={e => setTagInput(e.target.value)}
    onKeyDown={e => {
      if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
        e.preventDefault()
        const t = tagInput.trim().replace(/,$/, '')
        if (t && !tags.includes(t)) setTags([...tags, t])
        setTagInput('')
      }
    }}
  />
</div>
```

**Step 4: handleSave에서 태그 동기화 추가**

`handleSave` 내 종목 저장 성공 후:

```ts
// 태그 동기화: 기존 태그 삭제 후 재삽입
if (isEdit) {
  await fetch(`/api/portfolio/securities/${data.id}/tags`, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags: '__all__' }),  // 전체 삭제 엔드포인트 필요
  })
}
for (const tag of tags) {
  await fetch(`/api/portfolio/securities/${data.id}/tags`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  })
}
onSave({ ...data, tags })
```

> **주의**: 전체 태그 삭제를 위해 DELETE 핸들러에서 `tag`가 없으면 전체 삭제로 처리하도록 API를 수정한다.

```ts
// route.ts DELETE 수정
const { tag } = await req.json()
if (tag === '__all__' || !tag) {
  await sql`DELETE FROM security_tags WHERE security_id = ${params.id}`
} else {
  await sql`DELETE FROM security_tags WHERE security_id = ${params.id} AND tag = ${tag}`
}
```

**Step 5: 종목 목록 조회 API에서 tags 포함**

`app/api/portfolio/securities/route.ts` GET 쿼리에 태그 JOIN 추가:

```sql
-- securities 조회 쿼리에 추가
LEFT JOIN (
  SELECT security_id, array_agg(tag ORDER BY tag) AS tags
  FROM security_tags GROUP BY security_id
) st ON st.security_id = s.id
```

결과 매핑에 `tags: row.tags ?? []` 추가.

**Step 6: 화면 확인 후 커밋**

```bash
git add components/portfolio/SecuritiesManager.tsx lib/portfolio/types.ts app/api/portfolio/securities/
git commit -m "feat(tags): 종목 편집 모달에 태그 입력 UI 추가"
```

---

### Task 4: 포트폴리오 대시보드 태그 필터

**Files:**
- Modify: `components/portfolio/PortfolioDashboard.tsx`
- Modify: `components/portfolio/PositionCards.tsx`

**Step 1: PortfolioDashboard에 태그 필터 상태 추가**

```ts
const [selectedTags, setSelectedTags] = useState<string[]>([])
```

**Step 2: 전체 태그 목록 추출**

```ts
const allTags = useMemo(() => {
  const set = new Set<string>()
  mergedPositions.forEach(p => (p.security.tags ?? []).forEach(t => set.add(t)))
  return [...set].sort()
}, [mergedPositions])
```

**Step 3: 태그 필터 UI 추가** (KPI 카드 아래, 포지션 카드 위)

```tsx
{allTags.length > 0 && (
  <div className="flex flex-wrap gap-2 mb-4">
    {allTags.map(tag => {
      const active = selectedTags.includes(tag)
      return (
        <button
          key={tag}
          onClick={() => setSelectedTags(
            active ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag]
          )}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            active
              ? 'border-transparent text-white'
              : 'border-slate-200 text-slate-500 hover:border-slate-300'
          }`}
          style={active ? { backgroundColor: palette.colors[0] } : undefined}
        >
          #{tag}
        </button>
      )
    })}
    {selectedTags.length > 0 && (
      <button onClick={() => setSelectedTags([])}
        className="text-xs px-2 py-1 text-slate-400 hover:text-slate-600">
        초기화
      </button>
    )}
  </div>
)}
```

**Step 4: 포지션 필터링 적용**

```ts
const filteredPositions = useMemo(() =>
  selectedTags.length === 0
    ? mergedPositions
    : mergedPositions.filter(p =>
        selectedTags.some(t => (p.security.tags ?? []).includes(t))
      ),
  [mergedPositions, selectedTags]
)
```

`filteredPositions`를 `PositionCards`와 차트에 전달한다.

**Step 5: 화면 확인 후 커밋**

```bash
git add components/portfolio/PortfolioDashboard.tsx
git commit -m "feat(tags): 포트폴리오 대시보드 태그 필터"
```

---

## 🟡 Phase 2: 가계부 지출 단건 입력

### Task 5: DB 마이그레이션 — expense_memos 테이블

**Files:**
- Create: `docs/sql/2026-04-24-expense-memos-migration.sql`

```sql
CREATE TABLE IF NOT EXISTS expense_memos (
  id         BIGSERIAL PRIMARY KEY,
  expense_id BIGINT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  amount     INTEGER,        -- NULL = 금액 없이 텍스트만
  sort_order SMALLINT DEFAULT 0
);

ALTER TABLE expense_memos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read expense_memos" ON expense_memos FOR SELECT TO anon USING (true);
```

**Step 1: 실행 후 커밋**

```bash
git add docs/sql/2026-04-24-expense-memos-migration.sql
git commit -m "feat(expense-input): expense_memos 테이블 마이그레이션"
```

---

### Task 6: 지출 단건 생성/수정/삭제 API

**Files:**
- Create: `app/api/expenses/create/route.ts`
- Create: `app/api/expenses/[id]/route.ts`

**Step 1: 단건 생성 API**

```ts
// app/api/expenses/create/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidateCache } from '@/lib/cache'

interface MemoInput { label: string; amount?: number | null }

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { expense_date, category, detail, method, member, memos } = body

  // 금액 결정: memos에 amount가 하나라도 있으면 합산, 없으면 body.amount 사용
  const memoList: MemoInput[] = memos ?? []
  const hasAmounts = memoList.some(m => m.amount != null && m.amount > 0)
  const amount = hasAmounts
    ? memoList.reduce((s, m) => s + (m.amount ?? 0), 0)
    : Number(body.amount)

  if (!expense_date || !category || !amount) {
    return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 })
  }

  const d = new Date(expense_date)
  const year = d.getFullYear()
  const month = d.getMonth() + 1

  const sql = getSql()
  const [expense] = await sql`
    INSERT INTO expenses (expense_date, year, month, category, detail, method, amount, member, memo, source)
    VALUES (${expense_date}, ${year}, ${month}, ${category}, ${detail ?? ''}, ${method ?? ''}, ${amount}, ${member ?? null}, ${body.memo ?? ''}, 'manual')
    RETURNING id
  `

  if (memoList.length > 0) {
    const memoRows = memoList.map((m, i) => ({
      expense_id: expense.id,
      label: m.label,
      amount: m.amount ?? null,
      sort_order: i,
    }))
    await sql`INSERT INTO expense_memos ${sql(memoRows)}`
  }

  invalidateCache()
  return NextResponse.json({ id: expense.id })
}
```

**Step 2: 단건 수정/삭제 API**

```ts
// app/api/expenses/[id]/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidateCache } from '@/lib/cache'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { expense_date, category, detail, method, member, memo, memos } = body
  const memoList = memos ?? []
  const hasAmounts = memoList.some((m: any) => m.amount != null && m.amount > 0)
  const amount = hasAmounts
    ? memoList.reduce((s: number, m: any) => s + (m.amount ?? 0), 0)
    : Number(body.amount)

  const d = new Date(expense_date)
  const sql = getSql()

  await sql.begin(async tx => {
    await tx`
      UPDATE expenses SET
        expense_date = ${expense_date},
        year = ${d.getFullYear()},
        month = ${d.getMonth() + 1},
        category = ${category},
        detail = ${detail ?? ''},
        method = ${method ?? ''},
        amount = ${amount},
        member = ${member ?? null},
        memo = ${memo ?? ''}
      WHERE id = ${params.id}
    `
    await tx`DELETE FROM expense_memos WHERE expense_id = ${params.id}`
    if (memoList.length > 0) {
      const rows = memoList.map((m: any, i: number) => ({
        expense_id: Number(params.id),
        label: m.label,
        amount: m.amount ?? null,
        sort_order: i,
      }))
      await tx`INSERT INTO expense_memos ${tx(rows)}`
    }
  })

  invalidateCache()
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = getSql()
  await sql`DELETE FROM expenses WHERE id = ${params.id}`
  invalidateCache()
  return NextResponse.json({ ok: true })
}
```

**Step 3: 커밋**

```bash
git add app/api/expenses/create/ app/api/expenses/[id]/
git commit -m "feat(expense-input): 지출 단건 생성/수정/삭제 API"
```

---

### Task 7: ExpenseCreateModal 컴포넌트

**Files:**
- Create: `components/ExpenseCreateModal.tsx`

**Step 1: 컴포넌트 작성**

```tsx
'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { btn, field, modal } from '@/lib/styles'

interface MemoRow { label: string; amount: string }

interface Props {
  show: boolean
  onClose: () => void
  onSaved: () => void
  palette: { colors: string[] }
}

const CATEGORIES = ['고정비', '대출상환', '변동비', '여행공연비']

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function ExpenseCreateModal({ show, onClose, onSaved, palette }: Props) {
  const [date, setDate] = useState(todayStr())
  const [member, setMember] = useState('L')
  const [category, setCategory] = useState('변동비')
  const [detail, setDetail] = useState('')
  const [method, setMethod] = useState('')
  const [mode, setMode] = useState<'direct' | 'items'>('direct')
  const [amount, setAmount] = useState('')
  const [memos, setMemos] = useState<MemoRow[]>([{ label: '', amount: '' }])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const totalFromMemos = memos.reduce((s, m) => s + (parseInt(m.amount.replace(/,/g, '')) || 0), 0)

  function addMemoRow() { setMemos([...memos, { label: '', amount: '' }]) }
  function removeMemoRow(i: number) { setMemos(memos.filter((_, idx) => idx !== i)) }
  function updateMemo(i: number, key: keyof MemoRow, val: string) {
    setMemos(memos.map((m, idx) => idx === i ? { ...m, [key]: val } : m))
  }

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      const memoList = mode === 'items'
        ? memos.filter(m => m.label.trim()).map(m => ({
            label: m.label.trim(),
            amount: parseInt(m.amount.replace(/,/g, '')) || null,
          }))
        : []

      const res = await fetch('/api/expenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_date: date, category, detail, method, member,
          amount: mode === 'direct' ? parseInt(amount.replace(/,/g, '')) : totalFromMemos,
          memos: memoList,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved()
      onClose()
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  if (!show) return null

  return createPortal(
    <div className={modal.overlayTop} onClick={onClose}>
      <div className={modal.container} onClick={e => e.stopPropagation()}>
        <div className={modal.header}>
          <h3 className="text-sm font-semibold text-slate-800">지출 입력</h3>
          <button onClick={onClose} className={btn.icon}>✕</button>
        </div>
        <div className={modal.body}>
          {/* 날짜 */}
          <div><label className={field.label}>날짜</label>
            <input type="date" className={field.input} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {/* 작성자 */}
          <div><label className={field.label}>작성자</label>
            <div className="flex gap-2">
              {['L','P'].map(m => (
                <button key={m} type="button"
                  onClick={() => setMember(m)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    member === m ? 'text-white border-transparent' : 'border-slate-200 text-slate-500'
                  }`}
                  style={member === m ? { backgroundColor: palette.colors[0] } : undefined}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          {/* 지출유형 */}
          <div><label className={field.label}>지출유형</label>
            <select className={field.select} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {/* 세부유형 */}
          <div><label className={field.label}>세부유형</label>
            <input className={field.input} value={detail} onChange={e => setDetail(e.target.value)} placeholder="예: 식비, 교통비" />
          </div>
          {/* 결제수단 */}
          <div><label className={field.label}>결제수단</label>
            <input className={field.input} value={method} onChange={e => setMethod(e.target.value)} placeholder="카드 / 현금" />
          </div>
          {/* 금액 모드 */}
          <div>
            <label className={field.label}>금액</label>
            <div className="flex gap-2 mb-3">
              {(['direct','items'] as const).map(m => (
                <button key={m} type="button"
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                    mode === m ? 'text-white border-transparent' : 'border-slate-200 text-slate-500'
                  }`}
                  style={mode === m ? { backgroundColor: palette.colors[0] } : undefined}>
                  {m === 'direct' ? '총액 직접 입력' : '항목별 입력'}
                </button>
              ))}
            </div>
            {mode === 'direct' ? (
              <input className={field.input} value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0" type="text" inputMode="numeric" />
            ) : (
              <div className="space-y-2">
                {memos.map((m, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input className={field.input + ' flex-1'} placeholder="항목명"
                      value={m.label} onChange={e => updateMemo(i, 'label', e.target.value)} />
                    <input className={field.input + ' w-32'} placeholder="금액(선택)"
                      value={m.amount} onChange={e => updateMemo(i, 'amount', e.target.value)}
                      type="text" inputMode="numeric" />
                    {memos.length > 1 && (
                      <button type="button" onClick={() => removeMemoRow(i)}
                        className={btn.danger}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addMemoRow}
                  className={btn.secondary}>+ 항목 추가</button>
                {totalFromMemos > 0 && (
                  <p className="text-xs text-slate-500 text-right">
                    합계: <span className="font-semibold text-slate-700">{totalFromMemos.toLocaleString()}원</span>
                  </p>
                )}
              </div>
            )}
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className={modal.footer}>
          <button onClick={onClose} className={btn.secondary}>취소</button>
          <button onClick={handleSave} disabled={saving} className={btn.primary}
            style={{ backgroundColor: palette.colors[0] }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
```

**Step 2: DashboardClient에 모달 진입점 추가**

`components/DashboardClient.tsx`:

1. import 추가:
```ts
import ExpenseCreateModal from './ExpenseCreateModal'
import { useTheme } from '@/lib/ThemeContext'
```

2. `useTheme()` 훅 호출 추가:
```ts
const { palette } = useTheme()
const [showCreateModal, setShowCreateModal] = useState(false)
```

3. 페이지 헤더 우측에 버튼 추가:
```tsx
<div className="mb-6 flex items-center justify-between">
  <div>
    <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>가계부 대시보드</h1>
    <p className="text-xs text-slate-400 mt-0.5">{year}년 지출 현황</p>
  </div>
  <button
    onClick={() => setShowCreateModal(true)}
    className={btn.primary}
    style={{ backgroundColor: palette.colors[0] }}>
    + 지출 입력
  </button>
</div>
```

4. DrilldownPanel 아래에 모달 추가:
```tsx
<ExpenseCreateModal
  show={showCreateModal}
  onClose={() => setShowCreateModal(false)}
  onSaved={() => {
    // 현재 year summary 재조회
    setSummaryLoading(true)
    fetch(`/api/summary?year=${year}`)
      .then(r => r.json())
      .then(data => { if (!data.error) setSummary(data) })
      .finally(() => setSummaryLoading(false))
  }}
  palette={palette}
/>
```

**Step 3: 화면에서 모달 열기/저장/닫기 확인**

**Step 4: 커밋**

```bash
git add components/ExpenseCreateModal.tsx components/DashboardClient.tsx
git commit -m "feat(expense-input): 지출 단건 입력 모달"
```

---

## 🟢 Phase 3: 수입 관리

### Task 8: DB 마이그레이션 — incomes 테이블

**Files:**
- Create: `docs/sql/2026-04-24-incomes-migration.sql`

```sql
CREATE TABLE IF NOT EXISTS incomes (
  id           BIGSERIAL PRIMARY KEY,
  income_date  DATE NOT NULL,
  year         SMALLINT NOT NULL,
  month        SMALLINT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('급여', '보너스', '기타')),
  description  TEXT DEFAULT '',
  amount       INTEGER NOT NULL,
  member       TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read incomes" ON incomes FOR SELECT TO anon USING (true);
```

**Step 1: 실행 후 커밋**

```bash
git add docs/sql/2026-04-24-incomes-migration.sql
git commit -m "feat(income): incomes 테이블 마이그레이션"
```

---

### Task 9: 수입 API

**Files:**
- Create: `app/api/incomes/route.ts`
- Create: `app/api/incomes/[id]/route.ts`
- Create: `app/api/incomes/summary/route.ts`

**Step 1: 목록 조회 + 생성**

```ts
// app/api/incomes/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get('year')
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })
  const sql = getSql()
  const rows = await sql`
    SELECT id, income_date, year, month, category, description, amount, member
    FROM incomes WHERE year = ${parseInt(year)}
    ORDER BY income_date DESC
  `
  return NextResponse.json(rows.map((r: any) => ({
    ...r,
    income_date: r.income_date instanceof Date ? r.income_date.toISOString().slice(0,10) : r.income_date,
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { income_date, category, description, amount, member } = await req.json()
  if (!income_date || !category || !amount) {
    return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 })
  }
  const d = new Date(income_date)
  const sql = getSql()
  const [row] = await sql`
    INSERT INTO incomes (income_date, year, month, category, description, amount, member)
    VALUES (${income_date}, ${d.getFullYear()}, ${d.getMonth()+1}, ${category}, ${description ?? ''}, ${amount}, ${member ?? null})
    RETURNING *
  `
  return NextResponse.json(row)
}
```

**Step 2: 수정/삭제**

```ts
// app/api/incomes/[id]/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { income_date, category, description, amount, member } = await req.json()
  const d = new Date(income_date)
  const sql = getSql()
  await sql`
    UPDATE incomes SET
      income_date=${income_date}, year=${d.getFullYear()}, month=${d.getMonth()+1},
      category=${category}, description=${description??''}, amount=${amount}, member=${member??null}
    WHERE id = ${params.id}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sql = getSql()
  await sql`DELETE FROM incomes WHERE id = ${params.id}`
  return NextResponse.json({ ok: true })
}
```

**Step 3: 연간/월별 집계**

```ts
// app/api/incomes/summary/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get('year')
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })
  const sql = getSql()

  const [totals] = await sql`
    SELECT
      COALESCE(SUM(amount), 0) AS total,
      COALESCE(SUM(CASE WHEN category='급여' THEN amount END), 0) AS salary,
      COALESCE(SUM(CASE WHEN category='보너스' THEN amount END), 0) AS bonus,
      COALESCE(SUM(CASE WHEN category='기타' THEN amount END), 0) AS other
    FROM incomes WHERE year = ${parseInt(year)}
  `

  const monthly = await sql`
    SELECT month,
      COALESCE(SUM(amount), 0) AS total,
      COALESCE(SUM(CASE WHEN category='급여' THEN amount END), 0) AS salary,
      COALESCE(SUM(CASE WHEN category='보너스' THEN amount END), 0) AS bonus,
      COALESCE(SUM(CASE WHEN category='기타' THEN amount END), 0) AS other
    FROM incomes WHERE year = ${parseInt(year)}
    GROUP BY month ORDER BY month
  `

  return NextResponse.json({ totals, monthly })
}
```

**Step 4: 커밋**

```bash
git add app/api/incomes/
git commit -m "feat(income): 수입 CRUD + 집계 API"
```

---

### Task 10: 수입 관리 페이지 (`/income`)

**Files:**
- Create: `app/income/page.tsx`
- Create: `components/IncomeClient.tsx`
- Create: `components/IncomeFormModal.tsx`

**Step 1: 페이지 진입점**

```ts
// app/income/page.tsx
import IncomeClient from '@/components/IncomeClient'
export const dynamic = 'force-dynamic'

export default function Page({ searchParams }: { searchParams: { year?: string } }) {
  const currentYear = new Date().getFullYear()
  const parsed = parseInt(searchParams.year ?? '')
  const year = !isNaN(parsed) && parsed >= 2000 ? parsed : currentYear
  return <IncomeClient year={year} />
}
```

**Step 2: IncomeFormModal 작성** (`components/IncomeFormModal.tsx`)

BulkDividendModal/ExpenseCreateModal 패턴과 동일하게 구현:
- 필드: 날짜, 카테고리(급여/보너스/기타), 설명, 금액, 작성자(L/P)
- `show` prop으로 조건부 렌더링, `createPortal` 사용
- POST `/api/incomes` 호출 후 `onSaved()` 실행

**Step 3: IncomeClient 작성** (`components/IncomeClient.tsx`)

구성:
1. `useEffect`로 `/api/incomes/summary?year={year}` 조회 → KPI 카드 렌더링
   - 카드: 연간 총 수입 / 월 평균 / 급여·보너스·기타 비중
2. `useEffect`로 `/api/incomes?year={year}` 조회 → 내역 테이블 렌더링
3. 월별 바 차트 (Recharts `BarChart`) — 급여/보너스/기타 스택
4. `+ 수입 입력` 버튼 → `IncomeFormModal`
5. 테이블 각 행에 수정(✏)/삭제(🗑) 버튼

**Step 4: Sidebar에 수입 탭 추가**

`components/Sidebar.tsx`의 `LEDGER_TABS`에 추가:

```ts
const LEDGER_TABS = [
  { label: '대시보드', href: '/expenses',  icon: <IconGrid /> },
  { label: '수입',     href: '/income',    icon: <IconTrendingUp /> },  // 새 아이콘
  { label: '연도비교', href: '/compare',   icon: <IconBarChart /> },
  { label: '검색',     href: '/search',    icon: <IconSearch /> },
]
```

`IconTrendingUp` SVG 아이콘 함수도 추가:
```tsx
function IconTrendingUp() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}
```

**Step 5: 가계부 대시보드 연동**

`components/DashboardClient.tsx`:
1. mount 시 `/api/incomes/summary?year={year}` fetch
2. KPI 카드 그리드에 "연간 수입" 카드 추가 (클릭 불가, 링크로 `/income` 이동)
3. `MonthlyChart` → 수입 라인 오버레이: `MonthlyChart`에 `incomeMonthly` prop 추가,
   Recharts `ComposedChart`로 교체 후 `Line` 추가 (보조축 `YAxis yAxisId="income"`)

**Step 6: 화면 확인 후 커밋**

```bash
git add app/income/ components/IncomeClient.tsx components/IncomeFormModal.tsx components/Sidebar.tsx components/DashboardClient.tsx
git commit -m "feat(income): 수입 관리 페이지 + 대시보드 연동"
```

---

## 🔵 Phase 4: 유형자산 관리

### Task 11: DB 마이그레이션 — tangible_assets + asset_valuations

**Files:**
- Create: `docs/sql/2026-04-24-tangible-assets-migration.sql`

```sql
CREATE TABLE IF NOT EXISTS tangible_assets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  asset_type        TEXT NOT NULL DEFAULT '부동산',  -- '부동산'|'연금'|'차량'|'기타'
  description       TEXT DEFAULT '',
  acquired_at       DATE,
  acquisition_price BIGINT,
  acquisition_note  TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS asset_valuations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id   UUID NOT NULL REFERENCES tangible_assets(id) ON DELETE CASCADE,
  val_date   DATE NOT NULL,
  amount     BIGINT NOT NULL,
  note       TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(asset_id, val_date)
);

ALTER TABLE tangible_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_valuations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read tangible_assets" ON tangible_assets FOR SELECT TO anon USING (true);
CREATE POLICY "public read asset_valuations" ON asset_valuations FOR SELECT TO anon USING (true);
```

**Step 1: 실행 후 커밋**

```bash
git add docs/sql/2026-04-24-tangible-assets-migration.sql
git commit -m "feat(assets): tangible_assets + asset_valuations 테이블 마이그레이션"
```

---

### Task 12: 유형자산 API

**Files:**
- Create: `app/api/assets/route.ts`
- Create: `app/api/assets/[id]/route.ts`
- Create: `app/api/assets/[id]/valuations/route.ts`

**Step 1: 자산 목록 + 생성**

```ts
// app/api/assets/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET() {
  const sql = getSql()
  // 각 자산의 최신 평가액을 함께 조회
  const rows = await sql`
    SELECT
      ta.*,
      lv.amount AS current_value,
      lv.val_date AS last_val_date
    FROM tangible_assets ta
    LEFT JOIN LATERAL (
      SELECT amount, val_date
      FROM asset_valuations
      WHERE asset_id = ta.id
      ORDER BY val_date DESC
      LIMIT 1
    ) lv ON true
    ORDER BY ta.created_at
  `
  return NextResponse.json(rows.map((r: any) => ({
    ...r,
    acquired_at: r.acquired_at instanceof Date ? r.acquired_at.toISOString().slice(0,10) : r.acquired_at,
    last_val_date: r.last_val_date instanceof Date ? r.last_val_date.toISOString().slice(0,10) : r.last_val_date,
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, asset_type, description, acquired_at, acquisition_price, acquisition_note } = await req.json()
  if (!name || !asset_type) return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 })

  const sql = getSql()
  const [row] = await sql`
    INSERT INTO tangible_assets (name, asset_type, description, acquired_at, acquisition_price, acquisition_note)
    VALUES (${name}, ${asset_type}, ${description??''}, ${acquired_at??null}, ${acquisition_price??null}, ${acquisition_note??''})
    RETURNING *
  `
  return NextResponse.json(row)
}
```

**Step 2: 자산 수정/삭제**

```ts
// app/api/assets/[id]/route.ts
// PATCH: 위 POST와 동일한 필드 업데이트
// DELETE: DELETE FROM tangible_assets WHERE id = params.id
```

**Step 3: 시세 이력 조회/추가**

```ts
// app/api/assets/[id]/valuations/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const sql = getSql()
  const rows = await sql`
    SELECT id, val_date, amount, note
    FROM asset_valuations
    WHERE asset_id = ${params.id}
    ORDER BY val_date
  `
  return NextResponse.json(rows.map((r: any) => ({
    ...r,
    val_date: r.val_date instanceof Date ? r.val_date.toISOString().slice(0,10) : r.val_date,
  })))
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { val_date, amount, note } = await req.json()
  if (!val_date || !amount) return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 })

  const sql = getSql()
  const [row] = await sql`
    INSERT INTO asset_valuations (asset_id, val_date, amount, note)
    VALUES (${params.id}, ${val_date}, ${amount}, ${note??''})
    ON CONFLICT (asset_id, val_date) DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note
    RETURNING *
  `
  return NextResponse.json(row)
}
```

**Step 4: 커밋**

```bash
git add app/api/assets/
git commit -m "feat(assets): 유형자산 CRUD + 시세이력 API"
```

---

### Task 13: 유형자산 페이지 (`/assets`)

**Files:**
- Create: `app/assets/page.tsx`
- Create: `components/AssetsClient.tsx`
- Create: `components/AssetFormModal.tsx`
- Create: `components/AssetValuationModal.tsx`

**Step 1: 페이지 진입점**

```ts
// app/assets/page.tsx
import AssetsClient from '@/components/AssetsClient'
export const dynamic = 'force-dynamic'
export default function Page() { return <AssetsClient /> }
```

**Step 2: AssetFormModal 작성**

필드: 자산명, 유형(부동산/연금/차량/기타), 설명, 취득일, 취득가액, 취득 메모

**Step 3: AssetValuationModal 작성**

필드: 평가일(date picker), 추정 시세(숫자), 메모  
POST `/api/assets/{id}/valuations` 호출

**Step 4: AssetsClient 작성**

구성:
1. mount 시 `/api/assets` fetch → 자산 목록 + 최신 평가액
2. 상단 KPI 카드:
   - 유형자산 총액 = 모든 `current_value` 합산
   - 총 취득가액 = 모든 `acquisition_price` 합산
   - 총 평가손익 = 총액 − 취득가액
3. 자산 카드 리스트:
   - 자산명 / 유형 배지 / 취득가 / 현재 추정가 / 평가손익 %
   - 클릭 시 시세 이력 차트(Recharts `LineChart`) 및 `평가액 업데이트` 버튼 노출
4. `+ 자산 추가` 버튼 → `AssetFormModal`

**Step 5: Sidebar에 자산 탭 추가**

사이드바 하단 모드 전환 영역 위에 독립 메뉴로 추가 (가계부/포트폴리오 양쪽에서 모두 접근 가능하게):

```ts
// Sidebar.tsx 하단 nav에 별도 섹션 추가
<div className="mx-3 my-2 border-t border-slate-100" />
<Link href="/assets" ...>
  <IconBuilding /> 자산
</Link>
```

`IconBuilding` SVG 추가:
```tsx
function IconBuilding() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </svg>
  )
}
```

**Step 6: 포트폴리오 대시보드 유형자산 카드 연동**

`components/portfolio/PortfolioKpiCards.tsx`:
1. Props에 `tangibleAssetsTotal?: number` 추가
2. 카드 배열 마지막에 "유형자산" 카드 조건부 추가

`app/portfolio/page.tsx` (또는 서버 컴포넌트):
- `/api/assets` fetch 후 `tangibleAssetsTotal` 계산 → `PortfolioKpiCards`에 전달

**Step 7: 화면 확인 후 최종 커밋**

```bash
git add app/assets/ components/AssetsClient.tsx components/AssetFormModal.tsx components/AssetValuationModal.tsx components/Sidebar.tsx
git commit -m "feat(assets): 유형자산 관리 페이지 + 포트폴리오 대시보드 연동"
```

---

## 완료 체크리스트

| 기능 | DB | API | UI | 사이드바 | 대시보드 연동 |
|------|----|-----|----|---------|------------|
| 종목 태그 | ✓ security_tags | ✓ /api/portfolio/securities/[id]/tags | ✓ SecuritiesManager 편집 모달 | — | ✓ PortfolioDashboard 필터 |
| 지출 입력 | ✓ expense_memos | ✓ /api/expenses/create, [id] | ✓ ExpenseCreateModal | — | ✓ DashboardClient 버튼 |
| 수입 관리 | ✓ incomes | ✓ /api/incomes, summary | ✓ IncomeClient + IncomeFormModal | ✓ LEDGER_TABS | ✓ 수입 카드 + 차트 라인 |
| 유형자산 | ✓ tangible_assets, asset_valuations | ✓ /api/assets, valuations | ✓ AssetsClient + Modals | ✓ 독립 메뉴 | ✓ 포트폴리오 KPI 카드 |
