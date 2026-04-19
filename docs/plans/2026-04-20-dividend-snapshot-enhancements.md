# Dividend & Snapshot Enhancements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 배당 대시보드를 계좌별 세율/배당대상, 일괄 입력, 월·계좌·종목 탭 집계, 월 선택 연동 구조로 개편하고, 스냅샷 편집에 섹터 색상과 원금·평가금액 병기를 추가한다.

**Architecture:** `accounts` 테이블에 `dividend_eligible`, `dividend_tax_rate` 두 컬럼을 추가한다. API·계좌관리 UI는 해당 필드를 read/write 한다. `IncomeDashboard`는 월·계좌·종목 3탭 집계와 `selectedMonth` 연동을 추가하고, 단건 입력 폼을 `BulkDividendModal`로 확장한다 (수정은 단건 유지). `SnapshotEditor`는 섹터 색상 prop을 받아 티커 배지에 적용하고, 헤더·카드·모달에 원금/평가금액을 병기한다.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, PostgreSQL (postgres.js), Recharts, Tailwind CSS.

**Testing approach:** 이 프로젝트는 자동 테스트 스위트가 없고 `npm run build`(타입 체크)와 수동 UI 검증으로 검증한다. 각 태스크 마지막에 `npm run build`가 통과하는지 확인하고, 주요 UI 플로우는 `npm run dev`로 로컬에서 수동 확인한다.

**Commit style:** 기존 리포의 스타일에 맞춘다 (prefix 예: `feat:`, `fix:`, `refactor:`, `design:`). 각 태스크 완료마다 커밋.

---

## 사전 준비

- 현재 브랜치: `master` (작업 지속)
- 로컬 DB: `DATABASE_URL` (로컬 개발) — 마이그레이션 수동 실행
- 프로덕션 DB: 배포 단계에서 별도 수동 실행

---

## Task 1: DB 마이그레이션 스크립트 작성

**Files:**
- Create: `scripts/migrations/2026-04-20-accounts-dividend.sql`

**Step 1: 스크립트 파일 작성**

다음 내용으로 작성한다:

```sql
-- 2026-04-20 accounts 테이블에 배당 관련 컬럼 추가
-- idempotent: 여러 번 실행해도 안전

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS dividend_eligible  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dividend_tax_rate  numeric(5,2);

-- 유형/브로커 기반 초기 세율
-- option_list 에서 type_id 로 '연금저축', 'ISA' 를 역조회
UPDATE accounts a
SET dividend_tax_rate = 5.50
FROM option_list o
WHERE a.type_id = o.id AND o.value = '연금저축' AND a.dividend_tax_rate IS NULL;

UPDATE accounts a
SET dividend_tax_rate = 9.90
FROM option_list o
WHERE a.type_id = o.id AND o.value = 'ISA' AND a.dividend_tax_rate IS NULL;

UPDATE accounts
SET dividend_tax_rate = 15.00
WHERE broker = '카카오페이' AND dividend_tax_rate IS NULL;

UPDATE accounts
SET dividend_tax_rate = 15.40
WHERE dividend_tax_rate IS NULL;
```

**Step 2: 로컬 DB에 적용**

```bash
psql "$DATABASE_URL" -f scripts/migrations/2026-04-20-accounts-dividend.sql
```

**Step 3: 적용 확인**

```bash
psql "$DATABASE_URL" -c "SELECT name, broker, dividend_eligible, dividend_tax_rate FROM accounts LIMIT 20;"
```

기대: 모든 row에 `dividend_eligible=true`, `dividend_tax_rate`가 `NULL` 아님.

**Step 4: 포트폴리오 스키마 파일 업데이트**

`docs/portfolio-schema.sql` 의 `CREATE TABLE accounts` 섹션에 두 컬럼을 추가 (새로 DB를 세팅하는 경우를 위해).

```sql
CREATE TABLE accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  broker            text NOT NULL,
  owner             text,
  type              text,
  currency          text NOT NULL DEFAULT 'KRW',
  dividend_eligible boolean NOT NULL DEFAULT true,
  dividend_tax_rate numeric(5,2),
  created_at        timestamptz DEFAULT now()
);
```

**Step 5: 커밋**

```bash
git add scripts/migrations/2026-04-20-accounts-dividend.sql docs/portfolio-schema.sql
git commit -m "feat(db): accounts 배당 대상/세율 컬럼 추가 마이그레이션"
```

---

## Task 2: Account 타입과 계좌 API에 두 필드 반영

**Files:**
- Modify: `lib/portfolio/types.ts`
- Modify: `app/api/portfolio/accounts/route.ts`

**Step 1: `Account` 인터페이스에 필드 추가**

`lib/portfolio/types.ts` 의 `Account` 인터페이스에 다음 두 줄을 추가한다.

```ts
export interface Account {
  id: string
  name: string
  broker: string
  owner: string | null
  type_id: string | null
  currency_id: string | null
  dividend_eligible: boolean
  dividend_tax_rate: number | null
  // resolved via JOIN from option_list
  type: string | null
  currency: string
}
```

**Step 2: `ACCOUNT_WITH_LABELS` SELECT에 컬럼 추가**

`app/api/portfolio/accounts/route.ts:7-15` 의 `ACCOUNT_WITH_LABELS` 에 두 컬럼을 추가:

```ts
const ACCOUNT_WITH_LABELS = `
  SELECT a.id, a.name, a.broker, a.owner, a.created_at, a.sort_order,
         a.type_id, a.currency_id,
         a.dividend_eligible, a.dividend_tax_rate,
         t.value  AS type,
         cu.value AS currency
  FROM accounts a
  LEFT JOIN option_list t  ON a.type_id    = t.id
  LEFT JOIN option_list cu ON a.currency_id = cu.id
`
```

**Step 3: POST/PATCH에 필드 허용**

POST 본문 구조 분해를 확장하고 INSERT 에 포함:

```ts
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, broker, owner, type_id, dividend_eligible = true, dividend_tax_rate = null } = await req.json()
  const sql = getSql()

  const [row] = await sql`
    INSERT INTO accounts (name, broker, owner, type_id, currency_id, dividend_eligible, dividend_tax_rate)
    VALUES (
      ${name}, ${broker}, ${owner ?? null}, ${type_id ?? null},
      (SELECT id FROM option_list WHERE type = 'currency' AND value = 'KRW' LIMIT 1),
      ${dividend_eligible}, ${dividend_tax_rate}
    )
    RETURNING id
  `
  ...
}
```

PATCH `allowed` 배열에 필드 추가:

```ts
const allowed = ['name', 'broker', 'owner', 'type_id', 'currency_id', 'dividend_eligible', 'dividend_tax_rate']
```

**Step 4: 빌드 확인**

```bash
npm run build
```

기대: 타입 에러 없이 빌드 성공.

**Step 5: 커밋**

```bash
git add lib/portfolio/types.ts app/api/portfolio/accounts/route.ts
git commit -m "feat(api): accounts 배당 대상/세율 필드 read/write 지원"
```

---

## Task 3: 계좌관리 편집 모달에 배당 필드 UI 추가

**Files:**
- Modify: `components/portfolio/AccountsManager.tsx`

**Step 1: `accountForm` state 확장**

`accountForm` state의 초기값과 타입에 두 필드 추가:

```ts
const [accountForm, setAccountForm] = useState({
  name: '', broker: '', owner: '', type_id: '',
  dividend_eligible: true,
  dividend_tax_rate: '' as string,  // UI 상 string 으로 보관, 저장 시 number 변환
})
```

`setAccountForm` 을 초기화하는 모든 위치(세 군데) 업데이트:
- `onEdit` 콜백 (라인 262 부근): 기존 계좌 값으로 pre-fill
  ```ts
  onEdit={() => { setEditingAccountId(a.id); setAccountForm({
    name: a.name, broker: a.broker, owner: a.owner ?? '', type_id: a.type_id ?? '',
    dividend_eligible: a.dividend_eligible ?? true,
    dividend_tax_rate: a.dividend_tax_rate != null ? String(a.dividend_tax_rate) : '',
  }) }}
  ```
- `showAddModal` 버튼 클릭 (라인 268 부근):
  ```ts
  onClick={() => { setShowAddModal(true); setAccountForm({
    name: '', broker: '', owner: '', type_id: '',
    dividend_eligible: true, dividend_tax_rate: '',
  }) }}
  ```
- `onClick` to cancel (Edit Modal 취소 시 reset): 동일 초기값

**Step 2: 편집 모달 폼에 두 필드 UI 추가**

Edit 모달(`editingAccountId && createPortal(...`) 과 Add 모달(`showAddModal && createPortal(...`) 두 군데 모두, 기존 `유형` select 아래에 다음을 삽입:

```tsx
<div>
  <label className="flex items-center gap-2 text-xs text-slate-600">
    <input type="checkbox"
      checked={accountForm.dividend_eligible}
      onChange={e => setAccountForm(p => ({ ...p, dividend_eligible: e.target.checked }))}
    />
    배당 대상 계좌
  </label>
</div>
<div>
  <label className={field.label}>배당 세율 (%)</label>
  <input type="text" inputMode="decimal"
    value={accountForm.dividend_tax_rate}
    onChange={e => setAccountForm(p => ({ ...p, dividend_tax_rate: e.target.value }))}
    placeholder="15.40"
    className={field.input} />
</div>
```

**Step 3: `saveAccount` 에서 숫자 변환**

`saveAccount` 내 API 호출 payload를 수정:

```ts
const payload = {
  ...accountForm,
  dividend_tax_rate: accountForm.dividend_tax_rate.trim() === ''
    ? null
    : Number(accountForm.dividend_tax_rate),
}
if (editingAccountId) {
  const updated = await apiFetch('/api/portfolio/accounts', 'PATCH', { id: editingAccountId, ...payload })
  ...
} else {
  const created = await apiFetch('/api/portfolio/accounts', 'POST', payload)
  ...
}
```

**Step 4: 빌드 확인**

```bash
npm run build
```

**Step 5: 수동 확인 (선택)**

```bash
npm run dev
```
- 브라우저에서 `/portfolio/accounts` → 아무 계좌 수정 → 배당 대상 체크/해제, 세율 변경 → 저장 → 새로고침 → 값 유지 확인.

**Step 6: 커밋**

```bash
git add components/portfolio/AccountsManager.tsx
git commit -m "feat(accounts): 편집 모달에 배당 대상/세율 필드 추가"
```

---

## Task 4: 배당 페이지 loader 및 타입 확장

**Files:**
- Modify: `app/portfolio/income/page.tsx`
- Modify: `components/portfolio/IncomeDashboard.tsx` (Props 타입)

**Step 1: `IncomePage` 의 accounts 쿼리에 두 필드 포함**

`app/portfolio/income/page.tsx:33` 의 accounts 쿼리 수정:

```ts
sql`SELECT id, name, broker, owner, dividend_eligible, dividend_tax_rate
    FROM accounts ORDER BY name` as unknown as Promise<AccountRow[]>,
```

그리고 `AccountRow` 타입 확장:

```ts
type AccountRow = Pick<Account, 'id' | 'name' | 'broker' | 'owner' | 'dividend_eligible' | 'dividend_tax_rate'>
```

**Step 2: `IncomeDashboard.tsx` Props 타입 수정**

`components/portfolio/IncomeDashboard.tsx:26-29` 의 Props 를 업데이트:

```ts
interface Props {
  dividends: DividendRow[]
  securities: Pick<Security, 'id' | 'ticker' | 'name' | 'currency'>[]
  accounts: Pick<Account, 'id' | 'name' | 'broker' | 'owner' | 'dividend_eligible' | 'dividend_tax_rate'>[]
  accountSecurities: AccountSecurity[]
}
```

**Step 3: 빌드 확인**

```bash
npm run build
```

**Step 4: 커밋**

```bash
git add app/portfolio/income/page.tsx components/portfolio/IncomeDashboard.tsx
git commit -m "refactor(income): loader 및 Props 에 배당 대상/세율 전파"
```

---

## Task 5: KPI 라벨 변경 및 월 선택 연동

**Files:**
- Modify: `components/portfolio/IncomeDashboard.tsx`

**Step 1: KPI 카드 라벨 변경**

`IncomeDashboard.tsx:130-144` 의 KPI 카드 3개를 월 선택 연동 버전으로 교체:

```tsx
{/* KPI */}
{(() => {
  const rows = selectedMonth
    ? yearDividends.filter(d => fmtDate(d.paid_at).startsWith(selectedMonth))
    : yearDividends
  const gross = rows.reduce((s, d) => s + toKrw(d), 0)
  const tax = rows.reduce((s, d) => s + taxKrw(d), 0)
  const net = gross - tax
  const scopeLabel = selectedMonth ? selectedMonth.replace('-', '.') : `${year}년`
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 hover:-translate-y-0.5 transition-all">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{scopeLabel} 총 수령액</p>
        <p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums" style={{ color: palette.colors[0] }}>{fmt(gross)}원</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 hover:-translate-y-0.5 transition-all">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{scopeLabel} 추정 세금</p>
        <p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums text-rose-400">{fmt(tax)}원</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 hover:-translate-y-0.5 transition-all">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{scopeLabel} 세후 배당금</p>
        <p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums text-slate-800">{fmt(net)}원</p>
      </div>
    </div>
  )
})()}
```

기존 `totalGross`, `totalTax`, `totalNet` 상수는 위 IIFE 내부로 이동하므로 상위 정의 제거.

**Step 2: 빌드 확인 + 수동 확인**

```bash
npm run build
```

```bash
npm run dev
```
- `/portfolio/income` 에서 월 바 클릭 → KPI 카드의 값·라벨이 해당 월로 전환됨을 확인. 재클릭 → 연간 합계 복귀.

**Step 3: 커밋**

```bash
git add components/portfolio/IncomeDashboard.tsx
git commit -m "feat(income): KPI 라벨을 추정 세금/세후 배당금으로 바꾸고 월 선택 연동"
```

---

## Task 6: 집계 탭 (월별/계좌별/종목별) 추가

**Files:**
- Modify: `components/portfolio/IncomeDashboard.tsx`

**Step 1: 탭 state 및 그룹핑 유틸 추가**

컴포넌트 상단(`const year = thisYear()` 아래)에 탭 state 추가:

```ts
const [tab, setTab] = useState<'month' | 'account' | 'security'>('month')
```

기존 `groupByMonth` 아래에 두 개 유틸 추가:

```ts
function groupByAccount(items: DividendRow[]) {
  const map: Record<string, number> = {}
  for (const d of items) {
    const key = `${d.account.broker} · ${d.account.name}`
    map[key] = (map[key] ?? 0) + toKrw(d)
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, amount]) => ({ label, amount }))
}

function groupBySecurity(items: DividendRow[]) {
  const map: Record<string, number> = {}
  for (const d of items) {
    map[d.security.ticker] = (map[d.security.ticker] ?? 0) + toKrw(d)
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, amount]) => ({ label, amount }))
}
```

**Step 2: 차트 섹션 교체**

`IncomeDashboard.tsx:147-165` 의 차트 섹션을 탭으로 감싸고 조건별 렌더:

```tsx
{/* 차트 탭 */}
<div className="bg-white rounded-2xl border border-slate-100 p-5">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-sm font-semibold text-slate-700">
      {year}년 배당·분배금 집계
      {selectedMonth && <span className="text-xs text-slate-400 font-normal ml-2">· {selectedMonth}</span>}
    </h3>
    <div className="flex gap-1">
      {(['month', 'account', 'security'] as const).map(k => (
        <button key={k} onClick={() => setTab(k)}
          className="px-2.5 py-1 rounded text-xs transition-colors"
          style={tab === k
            ? { background: palette.colors[0], color: '#fff' }
            : { background: '#f1f5f9', color: '#64748b' }}>
          {k === 'month' ? '월별' : k === 'account' ? '계좌별' : '종목별'}
        </button>
      ))}
    </div>
  </div>

  {tab === 'month' && chartData.length > 0 && (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} barGap={2} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
        onClick={(data) => {
          const label = data?.activeLabel as string | undefined
          if (label) setSelectedMonth(prev => prev === label ? null : label)
        }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={52} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip color={palette.colors[0]} />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={32}
          fill={palette.colors[0]} style={{ cursor: 'pointer' }} />
      </BarChart>
    </ResponsiveContainer>
  )}

  {tab === 'account' && (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={groupByAccount(scopedDividends)} layout="vertical"
        margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} width={120} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip color={palette.colors[0]} />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="amount" radius={[0, 3, 3, 0]} maxBarSize={18} fill={palette.colors[0]} />
      </BarChart>
    </ResponsiveContainer>
  )}

  {tab === 'security' && (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={groupBySecurity(scopedDividends).slice(0, 15)} layout="vertical"
        margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis type="number" tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} width={80} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip color={palette.colors[0]} />} cursor={{ fill: '#f8fafc' }} />
        <Bar dataKey="amount" radius={[0, 3, 3, 0]} maxBarSize={14} fill={palette.colors[0]} />
      </BarChart>
    </ResponsiveContainer>
  )}
</div>
```

**Step 3: `scopedDividends` 공통 상수 정의**

`chartData` 계산 근처에서 `scopedDividends` 를 추가:

```ts
const scopedDividends = useMemo(
  () => selectedMonth
    ? yearDividends.filter(d => fmtDate(d.paid_at).startsWith(selectedMonth))
    : yearDividends,
  [yearDividends, selectedMonth]
)
```

KPI 섹션의 IIFE 도 이 `scopedDividends` 를 사용하도록 단순화.

**Step 4: 빌드 확인 + 수동 확인**

```bash
npm run build
```
- `/portfolio/income` → 탭 전환이 동작하고, 월별 탭에서 바 클릭 → 선택 표시 · 계좌별/종목별은 해당 월 범위로 집계됨을 확인.

**Step 5: 커밋**

```bash
git add components/portfolio/IncomeDashboard.tsx
git commit -m "feat(income): 월별/계좌별/종목별 집계 탭 추가"
```

---

## Task 7: DividendTable 월 필터 연동

**Files:**
- Modify: `components/portfolio/DividendTable.tsx`
- Modify: `components/portfolio/IncomeDashboard.tsx`

**Step 1: `DividendTable` 에 `selectedMonth` prop 추가**

`DividendTable.tsx` Props에 추가:

```ts
interface Props {
  dividends: DividendRow[]
  selectedMonth?: string | null
  onEdit: (d: DividendRow) => void
  onDelete: (id: string) => void
  openAddModal: () => void
  palette: { colors: string[] }
}
```

함수 시그니처와 `filtered` useMemo를 업데이트:

```ts
export default function DividendTable({ dividends, selectedMonth, onEdit, onDelete, openAddModal, palette }: Props) {
  ...
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = dividends
    if (selectedMonth) list = list.filter(d => fmtDate(d.paid_at).startsWith(selectedMonth))
    if (q) list = list.filter(d => /* 기존 로직 */)
    return [...list].sort(...)
  }, [dividends, search, sortMode, selectedMonth])
```

**Step 2: 필터 표시 UI**

테이블 헤더 영역에 월 필터 뱃지를 추가 (검색 input 왼쪽):

```tsx
{selectedMonth && (
  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
    {selectedMonth} 필터링중
  </span>
)}
```

**Step 3: `IncomeDashboard` 에서 prop 전달**

`DividendTable` 호출 부분에 `selectedMonth={selectedMonth}` 추가:

```tsx
<DividendTable
  dividends={dividends}
  selectedMonth={selectedMonth}
  onEdit={openEditModal}
  ...
/>
```

**Step 4: 빌드 확인 + 수동 확인**

```bash
npm run build
```
- 월 선택 → 하단 테이블이 해당 월로 축소됨, 재클릭 시 전체 복귀.

**Step 5: 커밋**

```bash
git add components/portfolio/DividendTable.tsx components/portfolio/IncomeDashboard.tsx
git commit -m "feat(income): 월 선택 시 배당 테이블 동기 필터"
```

---

## Task 8: BulkDividendModal 컴포넌트 작성 (신규 생성 전용)

**Files:**
- Create: `components/portfolio/BulkDividendModal.tsx`
- Modify: `components/portfolio/IncomeDashboard.tsx`

**Step 1: 새 컴포넌트 스켈레톤 작성**

`components/portfolio/BulkDividendModal.tsx` 를 작성. 주요 상태:

```ts
interface RowInput {
  security_id: string
  amount: string   // raw user input
  tax: string
  memo: string
}

// state
const [modalOwner, setModalOwner] = useState('')
const [accountId, setAccountId] = useState('')
const [paidAt, setPaidAt] = useState(todayStr())
const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW')
const [exchangeRate, setExchangeRate] = useState('')
const [rows, setRows] = useState<RowInput[]>([])
const [saving, setSaving] = useState(false)
```

**Step 2: 계좌 필터링**

- `accounts` prop 중 `dividend_eligible=true` 인 것만 드롭다운에 나열.
- `modalOwner` pill 및 owner 필터 로직은 기존 `DividendFormModal` 그대로 재사용.

```ts
const modalAccounts = useMemo(() =>
  accounts.filter(a => a.dividend_eligible)
    .filter(a => !modalOwner || a.owner === modalOwner),
  [accounts, modalOwner]
)
```

**Step 3: 계좌 선택 시 종목 로우 seed**

```ts
useEffect(() => {
  if (!accountId) { setRows([]); return }
  const linked = accountSecurities
    .filter(l => l.account_id === accountId)
    .map(l => l.security_id)
  setRows(linked.map(sid => ({ security_id: sid, amount: '', tax: '', memo: '' })))
  // 계좌 통화 기본값 - 해당 계좌 종목의 currency 기반 (여기선 사용자 선택 유지)
}, [accountId, accountSecurities])
```

**Step 4: 금액 입력 시 세금 자동 계산**

```ts
const account = accounts.find(a => a.id === accountId)
const taxRate = account?.dividend_tax_rate ?? 15.4

function updateAmount(idx: number, raw: string) {
  const plain = raw.replace(/,/g, '')
  const n = parseFloat(plain)
  const autoTax = !isNaN(n) && n > 0 ? (n * taxRate / 100).toFixed(2) : ''
  setRows(prev => prev.map((r, i) =>
    i === idx ? { ...r, amount: fmtNumber(plain), tax: autoTax ? fmtNumber(autoTax) : '' } : r
  ))
}
```

**Step 5: 종목 카드 리스트 UI**

각 종목 행을 카드로 렌더:

```tsx
<div className="space-y-2">
  {rows.map((row, idx) => {
    const sec = securities.find(s => s.id === row.security_id)
    if (!sec) return null
    return (
      <div key={row.security_id} className="border border-slate-100 rounded-xl p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-mono">{sec.ticker}</span>
          <span className="text-xs text-slate-600 font-medium flex-1 truncate">{sec.name}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] text-slate-400">금액({currency})</label>
            <input type="text" inputMode="decimal"
              value={row.amount}
              onChange={e => updateAmount(idx, e.target.value)}
              placeholder="0"
              className={`${field.input} text-right`} />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">세금({currency})</label>
            <input type="text" inputMode="decimal"
              value={row.tax}
              onChange={e => updateRow(idx, 'tax', fmtNumber(e.target.value.replace(/,/g, '')))}
              placeholder="0"
              className={`${field.input} text-right`} />
          </div>
          <div>
            <label className="text-[10px] text-slate-400">메모</label>
            <input type="text"
              value={row.memo}
              onChange={e => updateRow(idx, 'memo', e.target.value)}
              className={field.input} />
          </div>
        </div>
      </div>
    )
  })}
</div>
```

**Step 6: 저장 — 여러 row POST**

```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setSaving(true)
  try {
    const toSave = rows.filter(r => parseNum(r.amount) > 0)
    await Promise.all(toSave.map(r =>
      fetch('/api/portfolio/dividends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          security_id: r.security_id,
          account_id: accountId,
          paid_at: paidAt,
          currency,
          amount: parseNum(r.amount),
          exchange_rate: currency === 'USD' && exchangeRate ? parseNum(exchangeRate) : 1,
          tax: r.tax ? parseNum(r.tax) : 0,
          memo: r.memo || null,
        }),
      })
    ))
    onClose()
    router.refresh()
  } finally {
    setSaving(false)
  }
}
```

**Step 7: `IncomeDashboard` 에서 연결**

- 기존 `DividendFormModal` 을 `BulkDividendModal` 로 교체 (신규 생성 경로).
- `editTarget` 이 존재하는 경우(수정)는 기존 `DividendFormModal` 을 계속 사용.

```tsx
<DividendFormModal
  show={showModal && !!editTarget}
  onClose={() => setShowModal(false)}
  editTarget={editTarget}
  ...
/>
<BulkDividendModal
  show={showModal && !editTarget}
  onClose={() => setShowModal(false)}
  accounts={accounts}
  accountSecurities={accountSecurities}
  securities={securities}
  owners={owners}
  palette={palette}
/>
```

**Step 8: 빌드 확인 + 수동 확인**

```bash
npm run build
```
- `/portfolio/income` 에서 "배당 추가" → 계좌 선택 → 종목 리스트 로드 → 금액 입력 시 세금 자동 계산 (ex: 연금저축이면 amount × 5.5%) → 저장 → 여러 레코드 생성 확인.
- `dividend_eligible=false` 로 세팅한 계좌는 드롭다운에서 보이지 않음.

**Step 9: 커밋**

```bash
git add components/portfolio/BulkDividendModal.tsx components/portfolio/IncomeDashboard.tsx
git commit -m "feat(income): 계좌별 일괄 배당 입력 모달 추가"
```

---

## Task 9: 스냅샷 편집 — 섹터 색상 prop 주입

**Files:**
- Modify: `app/portfolio/snapshots/[id]/page.tsx`
- Modify: `components/portfolio/SnapshotEditor.tsx`

**Step 1: loader 에 sector 옵션 추가 쿼리**

`app/portfolio/snapshots/[id]/page.tsx` 의 `Promise.all` 에 sector 옵션 쿼리 추가:

```ts
sql`SELECT value, color_hex FROM option_list WHERE type IN ('account_type', 'sector')`
  as unknown as Promise<{ type?: string; value: string; color_hex: string | null }[]>,
```

또는 기존 `optionsRaw` 를 분리:

```ts
const [typeOptsRaw, sectorOptsRaw] = await Promise.all([
  sql`SELECT value, color_hex FROM option_list WHERE type = 'account_type'`,
  sql`SELECT value, color_hex FROM option_list WHERE type = 'sector'`,
])
```

두 맵 생성:

```ts
const typeColors: Record<string, string> = {}
for (const o of typeOptsRaw) if (o.color_hex) typeColors[o.value] = o.color_hex
const sectorColors: Record<string, string> = {}
for (const o of sectorOptsRaw) if (o.color_hex) sectorColors[o.value] = o.color_hex
```

**Step 2: `SnapshotEditor` 에 prop 전달**

```tsx
<SnapshotEditor
  ...
  typeColors={typeColors}
  sectorColors={sectorColors}
/>
```

**Step 3: `SnapshotEditor` Props 확장**

`components/portfolio/SnapshotEditor.tsx:22-28`:

```ts
interface Props {
  snapshot: Snapshot
  holdings: HoldingRow[]
  accounts: Account[]
  securities: Security[]
  accountSecurities: AccountSecurity[]
  typeColors?: Record<string, string>
  sectorColors?: Record<string, string>
}

export default function SnapshotEditor({
  snapshot, holdings, accounts, securities, accountSecurities,
  typeColors = {}, sectorColors = {},
}: Props) { ... }
```

**Step 4: 티커 배지에 색상 적용**

`SnapshotEditor.tsx:388` 의 티커 span을 섹터 색상으로 업데이트:

```tsx
{(() => {
  const color = sec.sector ? sectorColors[sec.sector] : null
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-mono"
      style={color
        ? { backgroundColor: color + '22', color }
        : { backgroundColor: '#f1f5f9', color: '#64748b' }}>
      {sec.ticker}
    </span>
  )
})()}
```

**Step 5: 빌드 확인 + 수동 확인**

```bash
npm run build
```
- 스냅샷 편집 → 계좌 클릭 → 모달 내 종목 카드의 티커 배지 색상이 섹터별로 구분됨.

**Step 6: 커밋**

```bash
git add app/portfolio/snapshots/[id]/page.tsx components/portfolio/SnapshotEditor.tsx
git commit -m "design(snapshot): 편집 모달 티커 배지에 섹터 색상 적용"
```

---

## Task 10: 스냅샷 편집 — 원금 / 평가금액 병기

**Files:**
- Modify: `components/portfolio/SnapshotEditor.tsx`

**Step 1: 원금 합계 계산**

기존 `accountValues`, `totalValue` 계산(`SnapshotEditor.tsx:230-241`) 옆에 원금 계산 추가:

```ts
const accountInvested = useMemo(() => {
  const vals: Record<string, number> = {}
  for (const r of rows) {
    if (r.quantity > 0 && r.avg_price != null) {
      // KRW 전제 (USD 계좌는 현재 스냅샷 단위 환율 없음 → 원본 amount 로 누적)
      vals[r.account_id] = (vals[r.account_id] ?? 0) + r.quantity * r.avg_price
    }
  }
  return vals
}, [rows])

const totalInvested = useMemo(() =>
  Object.values(accountInvested).reduce((a, b) => a + b, 0),
  [accountInvested]
)
```

**Step 2: 헤더 우측 병기**

`SnapshotEditor.tsx:261-268` 의 헤더 우측을 다음으로 교체:

```tsx
<div className="flex items-center gap-3">
  {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
  {isDirty && !msg && <span className="text-xs text-amber-500">미저장</span>}
  {totalValue > 0 && (
    <div className="text-right leading-tight">
      <p className="text-[10px] text-slate-400">원금 {Math.round(totalInvested).toLocaleString()}원</p>
      <p className="text-sm font-semibold text-slate-700 tabular-nums">
        평가 {Math.round(totalValue).toLocaleString()}원
      </p>
    </div>
  )}
  <button onClick={handleSave} disabled={saving}
    className="text-white px-4 py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
    style={{ backgroundColor: palette.colors[0] }}>
    {saving ? '저장 중...' : '저장'}
  </button>
</div>
```

**Step 3: 계좌 카드 하단에 원금 추가**

`SnapshotEditor.tsx:304-315` 의 하단 블록을 교체:

```tsx
<div className="mt-auto pt-2 space-y-0.5">
  <p className="text-xs text-slate-400">
    <span className="font-semibold text-slate-600">{count}</span>/{total}종목
  </p>
  {aVal > 0 ? (
    <div className="flex justify-between text-[10px] tabular-nums">
      <span className="text-slate-400">원금 {Math.round(accountInvested[a.id] ?? 0).toLocaleString()}</span>
      <span className="text-slate-600 font-medium">평가 {Math.round(aVal).toLocaleString()}</span>
    </div>
  ) : (
    <p className="text-xs text-slate-300">—</p>
  )}
</div>
```

**Step 4: 모달 헤더에 원금 추가**

`SnapshotEditor.tsx:330-340` 의 모달 헤더를 교체:

```tsx
<div>
  <p className="font-semibold text-slate-700">
    {modalAccount?.broker} · {modalAccount?.name}
  </p>
  {modalAccountValue > 0 && (
    <p className="text-xs text-slate-400 mt-0.5">
      원금 <span className="font-medium text-slate-600">
        {Math.round(accountInvested[modalAccountId ?? ''] ?? 0).toLocaleString()}원
      </span>
      <span className="mx-1.5 text-slate-300">·</span>
      평가금액 <span className="font-medium text-slate-600">
        {Math.round(modalAccountValue).toLocaleString()}원
      </span>
    </p>
  )}
</div>
```

**Step 5: 빌드 확인 + 수동 확인**

```bash
npm run build
```
- 스냅샷 편집: 헤더·계좌 카드·모달 헤더 세 곳에서 원금/평가금액이 나란히 표시됨.

**Step 6: 커밋**

```bash
git add components/portfolio/SnapshotEditor.tsx
git commit -m "design(snapshot): 편집 화면에 원금/평가금액 병기"
```

---

## Task 11: 최종 검증 · 배포 준비

**Step 1: 전체 타입체크 및 빌드**

```bash
npm run build
```

기대: 에러 없음.

**Step 2: 수동 시나리오 테스트**

`npm run dev` 후 다음 플로우 확인:

1. 계좌관리에서 한 계좌의 `배당 대상` 체크 해제 → 배당 추가 모달에서 해당 계좌가 사라짐.
2. 연금저축 계좌에서 임의 금액 입력 시 세금이 `amount × 5.5%` 로 자동 채워짐.
3. 한 계좌의 3개 종목에 금액 입력 → 저장 → 3개 dividends 레코드 생성 확인.
4. 월 바 클릭 → KPI 3개 카드·DividendTable·드릴다운이 해당 월로 전환. 재클릭 → 연간으로 복귀.
5. 계좌별/종목별 탭에서 상위 항목 정렬 확인.
6. 스냅샷 편집: 티커 배지 섹터 색상·원금/평가금액 3곳 표시 확인.

**Step 3: 프로덕션 DB 마이그레이션 (배포 시)**

배포 스킬(`deploy-finance`)로 진행하기 직전에 서버에서 마이그레이션 SQL을 실행:

```bash
# 서버에서
psql "$DATABASE_URL" -f scripts/migrations/2026-04-20-accounts-dividend.sql
```

**Step 4: 배포**

`/deploy-finance` 스킬 사용 (메모리의 워크플로에 따름).

---

## 검토 체크리스트

- [ ] 마이그레이션 SQL 로컬 DB에 적용 및 값 확인
- [ ] 계좌관리 모달에서 배당 대상/세율 편집 가능
- [ ] `dividend_eligible=false` 계좌는 배당 입력 드롭다운에서 제외
- [ ] 계좌별 기본 세율이 마이그레이션 규칙대로 자동 제안
- [ ] 일괄 배당 입력이 여러 dividends 레코드를 생성
- [ ] 기존 단건 수정 플로우가 여전히 작동
- [ ] 월별/계좌별/종목별 탭 동작
- [ ] 월 선택 시 KPI·테이블·드릴다운 동기화
- [ ] KPI 라벨이 "추정 세금", "세후 배당금" 으로 표시
- [ ] 스냅샷 편집 티커 배지에 섹터 색상 반영
- [ ] 스냅샷 편집 헤더·카드·모달에 원금/평가금액 병기
- [ ] `npm run build` 통과
