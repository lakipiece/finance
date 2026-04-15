# Portfolio UX Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 6개 영역의 UX 개선 — 탭 구조 개편, 가격 새로고침 버그 수정, 설정 통합, 포지션 모달 재설계, 배당 모달/차트 개선, 스냅샷 차트 바+도넛 드릴다운.

**Architecture:** 기존 Next.js App Router + Recharts + Tailwind 스택 유지. 새 라우트(/portfolio/options, /settings) 추가, 기존 컴포넌트 인플레이스 수정.

**Tech Stack:** Next.js 14 App Router, Recharts, Tailwind CSS, postgres.js, dnd-kit

---

## Task 1: 탭 이름 변경 & 새 탭 추가 (TabNav.tsx)

**Files:**
- Modify: `components/TabNav.tsx`
- Create: `app/portfolio/options/page.tsx` (OptionsManager를 settings에서 이동)
- Modify: `app/portfolio/settings/page.tsx` (OptionsManager 제거)

**변경 내용:**
- PORTFOLIO_TABS: `'계좌관리'→'계좌'`, `'종목관리'→'종목'`
- PORTFOLIO_TABS: `'설정'` href → `'/settings'` (통합 설정 페이지로)
- PORTFOLIO_TABS에 추가: `{ label: '옵션', short: '옵션', href: '/portfolio/options' }`
- PORTFOLIO_TABS에 추가: `{ label: '리밸런싱', short: '리밸', href: '/portfolio/rebalance' }` (이미 있는 href)
- LEDGER_TABS: `'관리'→'설정'`, href `'/admin'→'/settings'`

**Step 1: TabNav.tsx 수정**

```typescript
const PORTFOLIO_TABS = [
  { label: '대시보드', short: '홈',    href: '/portfolio' },
  { label: '스냅샷',  short: '스냅샷', href: '/portfolio/snapshots' },
  { label: '배당',    short: '배당',   href: '/portfolio/income' },
  { label: '계좌',    short: '계좌',   href: '/portfolio/accounts' },
  { label: '종목',    short: '종목',   href: '/portfolio/securities' },
  { label: '옵션',    short: '옵션',   href: '/portfolio/options' },
  { label: '리밸런싱', short: '리밸',  href: '/portfolio/rebalance' },
  { label: '설정',    short: '설정',   href: '/settings' },
]

const LEDGER_TABS = [
  { label: '대시보드', short: '홈',   href: '/expenses' },
  { label: '연도비교', short: '비교', href: '/compare' },
  { label: '검색',    short: '검색',  href: '/search' },
  { label: '설정',    short: '설정',  href: '/settings' },
]
```

**Step 2: `/portfolio/options/page.tsx` 생성**

```typescript
import { getSql } from '@/lib/db'
import OptionsManager from '@/components/portfolio/OptionsManager'

export const dynamic = 'force-dynamic'
type OptionItem = { id: string; type: string; label: string; value: string; color_hex: string | null; sort_order: number }

export default async function PortfolioOptionsPage() {
  const sql = getSql()
  const rows = await sql<OptionItem[]>`SELECT * FROM option_list ORDER BY type, sort_order, label`
  const grouped: Record<string, OptionItem[]> = {}
  for (const r of rows) {
    if (!grouped[r.type]) grouped[r.type] = []
    grouped[r.type].push(r)
  }
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">옵션 관리</h2>
      <OptionsManager initialOptions={grouped} />
    </div>
  )
}
```

**Step 3: `app/portfolio/settings/page.tsx`에서 OptionsManager 섹션 제거**
- OptionsManager import 및 렌더링 제거
- `<HistoricalPriceFetcher />`만 남김 (섹션명: "포트폴리오 데이터 관리")

**Step 4: Commit**
```bash
git commit -m "feat: 탭 구조 개편 — 계좌/종목/옵션/리밸런싱 탭 분리, 설정 통합 href"
```

---

## Task 2: 통합 설정 페이지 생성 (`/settings`)

**Files:**
- Create: `app/settings/page.tsx`
- Modify: `components/AdminClient.tsx` (UI 개선)
- Modify: `app/portfolio/settings/page.tsx` (포트폴리오 데이터 관리 섹션만 남김)

**설계:**
```
/settings 페이지
├── 공통 카드: 테마 선택 (ThemePicker)
├── 공통 카드: 계정 (로그아웃 버튼)
├── 포트폴리오 데이터 관리 섹션 (HistoricalPriceFetcher)
└── 가계부 데이터 관리 섹션 (AdminClient 내용 이식)
```

**Step 1: `app/settings/page.tsx` 생성**

```typescript
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { fetchAvailableYears } from '@/lib/fetchYears'
import SettingsClient from '@/components/SettingsClient'
import HistoricalPriceFetcher from '@/components/portfolio/HistoricalPriceFetcher'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const years = await fetchAvailableYears()
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <h2 className="text-sm font-semibold text-slate-700">설정</h2>
      <SettingsClient initialYears={years} />
      {/* 포트폴리오 데이터 관리 */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-3">포트폴리오 데이터 관리</h3>
        <HistoricalPriceFetcher />
      </div>
    </div>
  )
}
```

**Step 2: `components/SettingsClient.tsx` 생성 (AdminClient에서 분리)**

AdminClient.tsx 내용을 SettingsClient로 이식하면서:
- 섹션 구조: 테마/로그아웃 | 대출상환 제외 | 가계부 데이터 관리
- 대출상환 제외: 기본값 `true` (제외 상태)로 변경 → FilterContext 초기값 수정
- "클릭하여 동기화" 텍스트 제거, 연도 카드 `hover` 시 `title` 속성으로 `최종 업데이트: {KST datetime}` 표기
- `<input>` 스프레드시트 연동: `text-xs` 크기로 통일

**AdminClient에 변경할 UI 요소:**
```typescript
// "클릭하여 동기화" 제거
// hover tooltip via title 속성:
<div
  title={isSheets && y.updated_at
    ? `최종 업데이트: ${new Date(y.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`
    : undefined}
  ...
>

// sheetId input: text-xs 적용
<input className="... text-xs ..." />
```

**Step 3: `lib/FilterContext.tsx` 초기값 `true`로 변경**
```typescript
// excludeLoan 기본값 true (제외가 기본)
const [excludeLoan, setExcludeLoan] = useState(true)
```

**Step 4: app/admin/page.tsx — redirect to /settings**
```typescript
// admin 페이지 접근 시 /settings로 리다이렉트 (혹은 그대로 두되 /settings에서 같은 기능 제공)
```

**Step 5: Commit**
```bash
git commit -m "feat: 통합 설정 페이지 /settings — 가계부+포트폴리오 설정 통합"
```

---

## Task 3: 가격 새로고침 후 데이터 미반영 버그 수정

**Files:**
- Modify: `components/portfolio/PortfolioDashboard.tsx` (handleRefresh에 router.refresh() 추가)
- Modify: `components/portfolio/PositionCards.tsx` (syncTicker에 router.refresh() 추가)

**원인:** 가격 API 호출 성공 후 `router.refresh()`를 호출하지 않아 Server Component가 새 데이터로 재렌더링되지 않음.

**Step 1: PortfolioDashboard.tsx handleRefresh 수정**

```typescript
// PortfolioDashboard.tsx 상단에 useRouter 추가 (이미 있음)
async function handleRefresh() {
  setRefreshing(true)
  setRefreshMsg(null)
  try {
    const res = await fetch('/api/portfolio/prices/refresh', { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      setRefreshMsg(`오류: ${json.error}`)
    } else {
      const failedMsg = json.failed?.length > 0 ? ` (${json.failed.length}개 실패)` : ''
      setRefreshMsg(`${json.saved}개 저장 완료${failedMsg}`)
      setLastUpdated(new Date().toISOString().slice(0, 16).replace('T', ' '))
      router.refresh()  // ← 추가: 서버 데이터 재로드
    }
  } catch {
    setRefreshMsg('새로고침 실패')
  } finally {
    setRefreshing(false)
  }
}
```

**Step 2: PositionCards.tsx syncTicker 수정**

PositionCards는 router를 사용하지 않으므로 `useRouter` import 추가 필요.

```typescript
import { useRouter } from 'next/navigation'

export default function PositionCards(...) {
  const router = useRouter()
  
  async function syncTicker(rawTicker: string, e: React.MouseEvent) {
    // ... 기존 코드 ...
    try {
      const res = await fetch(...)
      const ok = res.ok
      setSyncMsg(prev => ({ ...prev, [rawTicker]: ok ? '✓' : '✗' }))
      if (ok) router.refresh()  // ← 추가
    }
  }
}
```

**Step 3: Commit**
```bash
git commit -m "fix: 가격 새로고침 후 router.refresh() 추가 — 화면 데이터 즉시 반영"
```

---

## Task 4: PositionModal 재설계

**Files:**
- Modify: `components/portfolio/PositionCards.tsx`

**새 모달 레이아웃:**
```
┌─────────────────────────────────────────────────────┐
│  [티커 배지(섹터색)] [섹터태그] [자산군태그]  [X]    │  ← 헤더
│  종목명                                               │
│  계좌명 목록                                          │
├──────────────────────────┬──────────────────────────┤
│  수량                     │  투자원금                 │  ← 1행
│  현재가                   │  평가금액                 │  ← 2행
│  포트폴리오 비중           │  손익 (+%)               │  ← 3행 (= 포트비중 + pnl)
├─────────────────────────────────────────────────────┤
│  연결 계좌                                            │
│  [계좌명] [브로커]    28,000,000원  (35.2%)           │
│  [계좌명] [브로커]    15,000,000원  (19.8%)           │
└─────────────────────────────────────────────────────┘
```

**Step 1: PositionModal 함수 재작성**

```typescript
function PositionModal({ position: p, totalValue, onClose, sectorColors = {} }: {
  position: MergedPosition
  totalValue: number
  onClose: () => void
  sectorColors?: Record<string, string>
}) {
  const pnlPos = p.unrealized_pnl >= 0
  const weight = totalValue > 0 ? (p.market_value / totalValue * 100) : 0
  const sectorColor = p.security.sector ? (sectorColors[p.security.sector] ?? '#334155') : '#334155'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              {/* 티커 배지 - 섹터 색상 */}
              <span className="text-white text-xs font-bold px-2 py-0.5 rounded font-mono leading-none shrink-0"
                style={{ backgroundColor: sectorColor }}>
                {p.security.ticker}
              </span>
              {/* 섹터 태그 */}
              {p.security.sector && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-500">
                  {p.security.sector}
                </span>
              )}
              {/* 자산군 태그 */}
              {p.security.asset_class && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-400">
                  {p.security.asset_class}
                </span>
              )}
              {/* 국가 태그 */}
              {p.security.country && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-400">
                  {p.security.country}
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-2 shrink-0">×</button>
          </div>
          <p className="font-bold text-slate-800 mt-2 text-sm">{p.security.name}</p>
        </div>

        {/* 카드 그리드 3열 2행 */}
        <div className="px-5 py-4 grid grid-cols-3 gap-3">
          {/* 1행: 수량 / 투자원금 / 포트폴리오 비중 */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">수량</p>
            <p className="text-sm font-semibold text-slate-700 tabular-nums">{p.quantity.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">투자원금</p>
            <p className="text-sm font-semibold text-slate-700 tabular-nums">{Math.round(p.total_invested).toLocaleString()}원</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">포트폴리오</p>
            <p className="text-sm font-semibold text-slate-700 tabular-nums">{weight.toFixed(1)}%</p>
          </div>

          {/* 2행: 현재가 / 평가금액 / 손익 */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">현재가</p>
            <p className="text-sm font-semibold text-slate-700 tabular-nums">
              {Math.round(p.current_price).toLocaleString()}원
              {p.current_price_usd != null && (
                <span className="text-[9px] text-slate-400 block">${Number(p.current_price_usd).toFixed(2)}</span>
              )}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">평가금액</p>
            <p className="text-sm font-semibold text-slate-700 tabular-nums">{Math.round(p.market_value).toLocaleString()}원</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">손익</p>
            <p className={`text-sm font-semibold tabular-nums ${pnlPos ? 'text-rose-500' : 'text-blue-500'}`}>
              {pnlPos ? '+' : ''}{Math.round(p.unrealized_pnl).toLocaleString()}원
              <span className="text-[9px] block">{pnlPos ? '+' : ''}{(p.unrealized_pct * 100).toFixed(2)}%</span>
            </p>
          </div>
        </div>

        {/* 연결 계좌 */}
        <div className="px-5 pb-4 border-t border-slate-50 pt-3">
          <p className="text-[10px] text-slate-400 mb-2">연결 계좌</p>
          <div className="space-y-1.5">
            {p.accounts.map(a => {
              const acctPositions = /* per-account market value from p */ 0 // 임시
              return (
                <div key={a.id} className="flex items-center justify-between">
                  <span className="text-xs text-slate-600">{a.broker} · {a.name}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Note:** 연결 계좌별 평가금액 표시를 위해 `MergedPosition`에 `accountValues: Record<string, number>` 추가 필요.

**Step 2: MergedPosition 타입 + mergeBySecuirty 함수 수정**

`PortfolioDashboard.tsx`의 `mergeBySecuirty` 함수에서 계좌별 market_value를 `accountValues`에 저장:

```typescript
export interface MergedPosition {
  // ... 기존 필드 ...
  accountValues: Record<string, number> // account.id → market_value
}

function mergeBySecuirty(positions: PortfolioPosition[]): MergedPosition[] {
  const map = new Map<string, MergedPosition>()
  for (const p of positions) {
    const key = p.security.id
    if (!map.has(key)) {
      map.set(key, {
        ...기존...,
        accountValues: { [p.account.id]: p.market_value },
      })
    } else {
      const m = map.get(key)!
      m.accountValues[p.account.id] = (m.accountValues[p.account.id] ?? 0) + p.market_value
      // 기존 필드들...
    }
  }
}
```

**Step 3: PositionModal 연결 계좌 섹션 완성**

```typescript
{p.accounts.map(a => {
  const acctValue = p.accountValues[a.id] ?? 0
  const acctPct = p.market_value > 0 ? (acctValue / p.market_value * 100) : 0
  return (
    <div key={a.id} className="flex items-center justify-between">
      <span className="text-xs text-slate-600">{a.broker} · {a.name}</span>
      <div className="text-right">
        <span className="text-xs font-medium text-slate-700 tabular-nums">{Math.round(acctValue).toLocaleString()}원</span>
        <span className="text-[10px] text-slate-400 ml-1.5 tabular-nums">({acctPct.toFixed(1)}%)</span>
      </div>
    </div>
  )
})}
```

**Step 4: PositionCards에 sectorColors prop 추가 및 모달로 전달**

```typescript
// PositionCards Props에 sectorColors 이미 있음 → PositionModal로 전달
{modal && (
  <PositionModal
    position={modal}
    totalValue={totalValue}
    sectorColors={sectorColors}
    onClose={() => setModal(null)}
  />
)}
```

**Step 5: Commit**
```bash
git commit -m "feat: PositionModal 재설계 — 카드형 3열 레이아웃, 섹터 태그, 연결 계좌별 비중"
```

---

## Task 5: 배당 모달 개선 — 폰트 축소 + 종목 검색

**Files:**
- Modify: `components/portfolio/IncomeDashboard.tsx`

**변경 1: 폰트 크기 축소**
```typescript
// 기존
const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ...'
const sel = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm ...'

// 변경: text-sm → text-xs, py-2 → py-1.5
const inp = 'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 font-normal focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white'
const sel = 'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 font-normal focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white'
```

**변경 2: 종목 검색 컴포넌트 (기존 select 대체)**

기존 `<select>` 를 아래 인라인 검색 컴포넌트로 교체:

```typescript
// 모달 폼 state에 추가
const [secSearch, setSecSearch] = useState('')
const [secDropOpen, setSecDropOpen] = useState(false)

// modalSecurities 필터링
const filteredModalSecurities = useMemo(() =>
  modalSecurities.filter(s =>
    !secSearch || s.ticker.toLowerCase().includes(secSearch.toLowerCase()) ||
    s.name.toLowerCase().includes(secSearch.toLowerCase())
  ).slice(0, 20),
  [modalSecurities, secSearch]
)

// 종목 선택 UI 교체
<div className="relative">
  <p className="text-xs text-slate-400 mb-1.5">종목</p>
  {form.security_id ? (
    // 선택된 종목 표시 + 변경 버튼
    <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
      <span className="text-xs font-medium text-slate-700 flex-1">
        {modalSecurities.find(s => s.id === form.security_id)?.ticker}
        {' '}{modalSecurities.find(s => s.id === form.security_id)?.name}
      </span>
      <button type="button" onClick={() => { setForm(p => ({ ...p, security_id: '' })); setSecSearch('') }}
        className="text-slate-400 hover:text-slate-600 text-xs">변경</button>
    </div>
  ) : (
    <div className="relative">
      <input
        type="text"
        placeholder="종목 검색 (티커 또는 종목명)"
        value={secSearch}
        onChange={e => { setSecSearch(e.target.value); setSecDropOpen(true) }}
        onFocus={() => setSecDropOpen(true)}
        className={inp}
        autoComplete="off"
      />
      {secDropOpen && filteredModalSecurities.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-lg shadow-lg mt-0.5 max-h-48 overflow-y-auto">
          {filteredModalSecurities.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                handleSecurityChange(s.id)
                setSecSearch('')
                setSecDropOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"
            >
              <span className="font-mono font-semibold text-slate-700 w-16 shrink-0">{s.ticker}</span>
              <span className="text-slate-500 truncate">{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )}
</div>
```

**Step 1: `inp`, `sel` 변수 변경 (text-sm → text-xs)**

**Step 2: 종목 검색 state 추가 및 select → search UI 교체**

**Step 3: 모달 열릴 때 secSearch/secDropOpen 초기화**

**Step 4: Commit**
```bash
git commit -m "feat: 배당 모달 — 폰트 축소(text-xs), 종목 검색 UI"
```

---

## Task 6: 배당 차트 — 월 클릭 시 종목별 도넛 드릴다운

**Files:**
- Modify: `components/portfolio/IncomeDashboard.tsx`

**현재 구조:** 월별 바 차트 (Recharts BarChart) + CustomTooltip

**추가 기능:**
1. 바 클릭 → 해당 월 종목별 비율 도넛 차트 오버레이
2. 도넛은 바 차트 우측 또는 아래에 표시 (반응형)
3. 테마 색상 적용

**Step 1: 월별 종목 집계 함수 추가**

```typescript
// groupByMonthAndTicker: Record<month, Record<ticker, amount>>
function groupByMonthAndTicker(items: DividendRow[]) {
  const map: Record<string, Record<string, number>> = {}
  for (const d of items) {
    const month = fmtDate(d.paid_at).slice(0, 7)
    if (!month) continue
    if (!map[month]) map[month] = {}
    const ticker = d.security.ticker
    const gross = toKrw(d)
    map[month][ticker] = (map[month][ticker] ?? 0) + gross
  }
  return map
}
```

**Step 2: selectedMonth state 추가**

```typescript
const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
```

**Step 3: 바 차트 onClick 추가**

```typescript
<BarChart data={chartData} onClick={(data) => {
  if (data?.activeLabel) {
    setSelectedMonth(prev => prev === data.activeLabel ? null : data.activeLabel)
  }
}}>
```

**Step 4: 도넛 차트 섹션 추가**

선택된 월의 종목별 비율을 Recharts `PieChart`로 표시:

```typescript
{selectedMonth && (() => {
  const breakdown = monthTickerMap[selectedMonth] ?? {}
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1])
  const total = entries.reduce((s, [, v]) => s + v, 0)
  const pieData = entries.map(([name, value], i) => ({
    name,
    value,
    fill: THEME_COLORS[i % THEME_COLORS.length],
  }))
  return (
    <div className="bg-white rounded-2xl border border-slate-100 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-600">{selectedMonth} 종목별 배당</h4>
        <button onClick={() => setSelectedMonth(null)} className="text-slate-300 hover:text-slate-500 text-xs">닫기</button>
      </div>
      <div className="flex items-center gap-4">
        <PieChart width={160} height={160}>
          <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70}
            dataKey="value" paddingAngle={2}>
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => `${Math.round(v).toLocaleString()}원`} />
        </PieChart>
        <div className="flex-1 space-y-1">
          {entries.map(([name, value], i) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: THEME_COLORS[i % THEME_COLORS.length] }} />
              <span className="text-[10px] text-slate-600 flex-1 truncate">{name}</span>
              <span className="text-[10px] tabular-nums text-slate-500">
                {total > 0 ? (value / total * 100).toFixed(1) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})()}
```

**Step 5: 테마 색상 적용 — 기존 emerald 계열을 palette.colors[0]로**

```typescript
// 수령액 KPI 색상: text-emerald-600 → style={{ color: palette.colors[0] }}
// 세후 수령액: text-emerald-600 → palette.colors[0]
// 바 차트 fill: '#10b981' → palette.colors[0]
```

**Step 6: Commit**
```bash
git commit -m "feat: 배당 차트 — 월 클릭 종목별 도넛 드릴다운, 테마 색상 적용"
```

---

## Task 7: 스냅샷 차트 — 바 차트 + 도넛 드릴다운

**Files:**
- Modify: `components/portfolio/SnapshotCharts.tsx`

**변경 내용:**
1. 상단 "총 평가금액 추이": LineChart → BarChart (커스텀 툴팁 유지)
2. 바 클릭 시 → 해당 날짜의 섹터 구성 도넛 차트 표시 (우측 패널 or 아래)
3. 도넛 세그먼트 클릭 시 → 바 차트에서 해당 섹터만 남도록 filterKey state 적용

**Step 1: state 추가**
```typescript
const [selectedDate, setSelectedDate] = useState<string | null>(null)
const [filterKey, setFilterKey] = useState<string | null>(null)
```

**Step 2: 바 차트로 교체**

```typescript
// 기존 LineChart → BarChart
<BarChart data={points} margin={{ left: 8, right: 8 }}
  onClick={(data) => {
    if (data?.activeLabel) {
      setSelectedDate(prev => prev === data.activeLabel ? null : data.activeLabel)
      setFilterKey(null)
    }
  }}>
  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
  <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} width={60} axisLine={false} tickLine={false} />
  <Tooltip content={<LineTooltip />} cursor={{ fill: '#f8fafc' }} />
  <Bar dataKey="total_market_value" fill={palette.colors[0]} radius={[4, 4, 0, 0]} />
</BarChart>
```

**Step 3: 도넛 차트 패널 (선택된 날짜)**

```typescript
{selectedDate && (() => {
  const point = points.find(p => p.date === selectedDate)
  if (!point) return null
  const entries = Object.entries(point.breakdown)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  const pieData = entries.map(([name, pct], i) => ({
    name,
    value: pct,
    fill: sectorColors[name] ?? THEME_COLORS[i % THEME_COLORS.length],
  }))

  return (
    <div className="bg-white rounded-2xl border border-slate-100 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-600">{selectedDate} 구성 비중</h4>
        <button onClick={() => { setSelectedDate(null); setFilterKey(null) }}
          className="text-slate-300 hover:text-slate-500 text-xs">닫기</button>
      </div>
      <div className="flex items-center gap-6">
        <PieChart width={160} height={160}>
          <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70}
            dataKey="value" paddingAngle={2}
            onClick={(entry) => setFilterKey(prev => prev === entry.name ? null : entry.name)}>
            {pieData.map((entry, i) => (
              <Cell key={i} fill={entry.fill}
                opacity={filterKey && filterKey !== entry.name ? 0.3 : 1} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
        </PieChart>
        <div className="flex-1 space-y-1 max-h-32 overflow-y-auto">
          {entries.map(([name, pct], i) => (
            <div key={name}
              className={`flex items-center gap-1.5 cursor-pointer rounded px-1 ${filterKey === name ? 'bg-slate-100' : ''}`}
              onClick={() => setFilterKey(prev => prev === name ? null : name)}>
              <span className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: sectorColors[name] ?? THEME_COLORS[i % THEME_COLORS.length] }} />
              <span className="text-[10px] text-slate-600 flex-1 truncate">{name}</span>
              <span className="text-[10px] tabular-nums text-slate-500">{pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})()}
```

**Step 4: filterKey 적용 — 구성 비중 바 차트 필터링**

```typescript
// filterKey가 설정된 경우, 하단 stacked bar chart에서 해당 섹터 외 keys opacity 처리
{keys.map((k, i) => (
  <Bar key={k} dataKey={`breakdown.${k}`} name={k} stackId="a"
    fill={getColor(k, i)}
    opacity={filterKey && filterKey !== k ? 0.2 : 1}
  />
))}
```

**Step 5: `PieChart`, `Pie`, `Cell` import 추가 (recharts)**

**Step 6: Commit**
```bash
git commit -m "feat: 스냅샷 차트 — 바차트 변경, 날짜 클릭 도넛 드릴다운, 섹터 필터"
```

---

## Task 8: 배포

**Step 1: 전체 빌드 에러 확인**
```bash
cd /Users/lakipiece/dev/ledger && npm run build 2>&1 | tail -30
```

**Step 2: deploy-finance 스킬로 배포**
```bash
git push origin master
ssh ubuntu "cd ~/finance && git pull && docker compose build --no-cache && docker compose up -d"
```

---

## 실행 순서 요약

| Task | 예상 변경 파일 | 위험도 |
|------|--------------|--------|
| 1. 탭 구조 개편 | TabNav.tsx, portfolio/options/page.tsx, portfolio/settings/page.tsx | 낮음 |
| 2. 통합 설정 /settings | app/settings/page.tsx, SettingsClient.tsx, FilterContext.tsx | 중간 |
| 3. 가격 새로고침 버그 | PortfolioDashboard.tsx, PositionCards.tsx | 낮음 |
| 4. PositionModal 재설계 | PositionCards.tsx, PortfolioDashboard.tsx | 중간 |
| 5. 배당 모달 개선 | IncomeDashboard.tsx | 중간 |
| 6. 배당 차트 드릴다운 | IncomeDashboard.tsx | 중간 |
| 7. 스냅샷 차트 | SnapshotCharts.tsx | 중간 |
| 8. 배포 | - | 낮음 |
