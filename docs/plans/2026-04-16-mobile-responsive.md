# Mobile Responsive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 스마트폰(375px~430px)에서 모든 페이지가 잘 보이도록 — 테이블은 카드형으로, 그리드는 적절한 컬럼 수로, 헤더/패딩 반응형 적용.

**Architecture:** A안 — 컴포넌트별 인라인 반응형. `sm:` prefix 기준으로 모바일(`< 640px`)은 카드, 데스크탑은 기존 테이블 유지. `SearchClient`는 이미 `md:hidden` / `hidden md:block` 패턴 적용됨 — 건드리지 않음.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, React

---

## Task 1: ExpenseTable — 모바일 카드 레이아웃

**Files:**
- Modify: `components/ExpenseTable.tsx`

현재 8컬럼 테이블. 모바일에서 `sm:hidden` 카드, 데스크탑에서 `hidden sm:block` 테이블.

**Step 1: 카드 뷰 추가 (sm:hidden 블록)**

`<div className="overflow-x-auto">` 앞에 아래 블록 삽입:

```tsx
{/* 모바일 카드 뷰 */}
<div className="sm:hidden space-y-2 mb-4">
  {slice.map((e, i) => (
    <div
      key={`${e.date}-${e.detail}-${e.amount}-${i}`}
      className={`border border-slate-100 rounded-xl px-4 py-3 ${i % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>
            {e.category}
          </span>
          {e.detail && (
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 truncate max-w-[140px]">
              {e.detail}
            </span>
          )}
          {e.member && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
              e.member === 'L' ? 'bg-blue-50 text-blue-600' :
              e.member === 'P' ? 'bg-pink-50 text-pink-600' :
              'bg-slate-100 text-slate-500'
            }`}>{e.member}</span>
          )}
        </div>
        <span className="font-semibold text-slate-800 text-sm shrink-0 tabular-nums">
          {formatWonFull(e.amount)}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="tabular-nums">{e.date}</span>
        {e.method && <span>{e.method}</span>}
      </div>
      {e.memo && (
        <p className="text-xs text-slate-400 mt-1 truncate" title={e.memo}>{e.memo}</p>
      )}
    </div>
  ))}
</div>
```

**Step 2: 기존 테이블 래퍼를 `hidden sm:block`으로 변경**

```tsx
// Before
<div className="overflow-x-auto">

// After
<div className="hidden sm:block overflow-x-auto">
```

**Step 3: 페이지네이션 footer 모바일 정리**

정렬/페이지당 컨트롤 줄 바꿈 허용 (이미 `flex-wrap` 있음 — 확인만).

**Step 4: 빌드 확인**
```bash
npm run build 2>&1 | tail -5
```

**Step 5: 커밋**
```bash
git add components/ExpenseTable.tsx
git commit -m "feat(mobile): 지출 테이블 모바일 카드 레이아웃"
```

---

## Task 2: DrilldownPanel — 헤더 모바일 반응형

**Files:**
- Modify: `components/DrilldownPanel.tsx`

현재 헤더: `flex items-center justify-between` — 모바일에서 제목+총액+YearPicker 버튼이 겹침.

**Step 1: 헤더 flex를 모바일에서 column으로**

```tsx
// Before
<div className="flex items-center justify-between mb-5">
  <div>
    <h2 className="text-lg font-bold text-slate-800">{monthData.month} 상세 내역</h2>
    <p className="text-sm text-slate-400 mt-0.5">총 {formatWonFull(monthData.total)}</p>
  </div>
  <div className="flex items-center gap-2">
    <YearPicker variant="light" />
    ...
  </div>
</div>

// After
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
  <div>
    <h2 className="text-base sm:text-lg font-bold text-slate-800">{monthData.month} 상세 내역</h2>
    <p className="text-sm text-slate-400 mt-0.5">총 {formatWonFull(monthData.total)}</p>
  </div>
  <div className="flex items-center gap-2 self-start sm:self-auto">
    <YearPicker variant="light" />
    ...
  </div>
</div>
```

**Step 2: DrilldownPanel 패딩 모바일 축소**

```tsx
// Before
<div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">

// After
<div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6 mb-4 sm:mb-6">
```

**Step 3: 빌드 확인**
```bash
npm run build 2>&1 | tail -5
```

**Step 4: 커밋**
```bash
git add components/DrilldownPanel.tsx
git commit -m "feat(mobile): DrilldownPanel 헤더 모바일 반응형"
```

---

## Task 3: PortfolioDashboard — 계좌 그리드 + 섹터 영역

**Files:**
- Modify: `components/portfolio/PortfolioDashboard.tsx`

**Step 1: 계좌 카드 그리드 — `grid-cols-3` → `grid-cols-2`**

```tsx
// Before
<div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">

// After
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
```

**Step 2: 전체 계좌 카드 패딩 + 텍스트 모바일 조정**

```tsx
// 전체 버튼 (selectAll)
// Before
className={`rounded-xl border px-3 py-3 text-right ...`}

// After
className={`rounded-xl border px-2 py-2 sm:px-3 sm:py-3 text-right ...`}
```

전체 버튼 내 텍스트:
```tsx
// Before
<p className="text-sm font-bold tabular-nums ...">

// After
<p className="text-xs sm:text-sm font-bold tabular-nums ...">
```

**Step 3: 섹터 버튼 텍스트 크기 — 이미 `text-xs` 양호, 확인만**

**Step 4: PositionCards 그리드 — 이미 `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` 양호, 확인만**

**Step 5: 빌드 확인**
```bash
npm run build 2>&1 | tail -5
```

**Step 6: 커밋**
```bash
git add components/portfolio/PortfolioDashboard.tsx
git commit -m "feat(mobile): 포트폴리오 대시보드 계좌 그리드 모바일 2열"
```

---

## Task 4: PortfolioKpiCards — 5열 → 2/3/5열 반응형

**Files:**
- Modify: `components/portfolio/PortfolioKpiCards.tsx`

**Step 1: 그리드 반응형 조정**

```tsx
// Before
<div className="grid grid-cols-2 lg:grid-cols-5 gap-4">

// After
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
```

**Step 2: 카드 패딩 + 텍스트 모바일 축소**

```tsx
// Before
<div key={c.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col ...">

// After
<div key={c.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 flex flex-col ...">
```

```tsx
// Before
<p className="text-xl font-bold tabular-nums ...">

// After
<p className="text-lg sm:text-xl font-bold tabular-nums ...">
```

**Step 3: 빌드 확인 + 커밋**
```bash
npm run build 2>&1 | tail -5
git add components/portfolio/PortfolioKpiCards.tsx
git commit -m "feat(mobile): 포트폴리오 KPI 카드 모바일 2→3→5열 반응형"
```

---

## Task 5: IncomeDashboard — KPI 그리드 + 배당 테이블 카드

**Files:**
- Modify: `components/portfolio/IncomeDashboard.tsx`

**Step 1: KPI 카드 `grid-cols-3` → 모바일 1열**

```tsx
// Before
<div className="grid grid-cols-3 gap-4">

// After
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
```

KPI 카드 패딩:
```tsx
// Before
<div className="bg-white rounded-2xl border border-slate-100 p-5 ...">

// After
<div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 ...">
```

KPI 금액 텍스트:
```tsx
// Before
<p className="text-2xl font-bold mt-1 tabular-nums" ...>

// After
<p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums" ...>
```

**Step 2: 배당 테이블 — 모바일 카드 뷰 추가**

테이블 `<div className="overflow-x-auto">` 를 아래로 교체:

```tsx
{/* 모바일 카드 뷰 */}
<div className="sm:hidden space-y-2">
  {filtered.length === 0 && (
    <p className="text-center text-slate-400 text-xs py-8">내역이 없습니다</p>
  )}
  {slice.map((d) => {
    const gross = toKrw(d)
    const tax = taxKrw(d)
    const net = gross - tax
    return (
      <div key={d.id} className="border border-slate-100 rounded-xl px-4 py-3 bg-white">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 shrink-0">
              {d.security.ticker}
            </span>
            <span className="text-xs text-slate-500 truncate">{d.security.name}</span>
          </div>
          <span className="font-semibold text-slate-800 text-sm shrink-0 tabular-nums whitespace-nowrap">
            {fmtFull(net)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="tabular-nums">{fmtDate(d.paid_at)}</span>
          <span className="text-slate-500">{d.account.broker} · {d.account.name}</span>
        </div>
        {d.account.owner && (
          <div className="mt-1">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{d.account.owner}</span>
          </div>
        )}
        <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-50 text-[10px] text-slate-400 tabular-nums">
          <span>수령 {fmtFull(gross)}</span>
          {tax > 0 && <span>세금 {fmtFull(tax)}</span>}
        </div>
      </div>
    )
  })}
</div>

{/* 데스크탑 테이블 뷰 */}
<div className="hidden sm:block overflow-x-auto">
  <table className="w-full text-sm">
    ... (기존 테이블 내용 그대로)
  </table>
</div>
```

**Step 3: 테이블 헤더 + 검색 바 모바일 정리**

```tsx
// 테이블 헤더 (타이틀 + 검색 + 추가 버튼) — 모바일에서 세로 배치
// Before
<div className="flex items-center justify-between gap-3">
  <h3 ...>배당·분배금 내역</h3>
  <div className="flex items-center gap-2 flex-1 justify-end">
    <div className="relative w-64">...</div>
    <button ...>+ 배당 추가</button>
  </div>
</div>

// After
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
  <h3 className="text-sm font-semibold text-slate-700 shrink-0">배당·분배금 내역</h3>
  <div className="flex items-center gap-2 flex-1 sm:justify-end">
    <div className="relative flex-1 sm:w-64 sm:flex-none">...</div>
    <button ...>+ 배당 추가</button>
  </div>
</div>
```

**Step 4: 빌드 확인 + 커밋**
```bash
npm run build 2>&1 | tail -5
git add components/portfolio/IncomeDashboard.tsx
git commit -m "feat(mobile): 배당 페이지 KPI 1열, 테이블 카드 레이아웃"
```

---

## Task 6: SecuritiesManager — 모달 + 카드 점검

**Files:**
- Modify: `components/portfolio/SecuritiesManager.tsx`

**Step 1: 카드 그리드 확인 — 이미 `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` 양호**

**Step 2: 가격 이력 모달 스크롤 — max-h 확인**

현재 `max-h-[90vh]` 모달, 모바일 화면 넘침 여부 점검.
모달 내부 스크롤 가능하도록 `overflow-y-auto` 추가:

```tsx
// PriceHistoryModal 내부 - 현재
<div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"

// After: 패딩 줄이기
<div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[95dvh] sm:max-h-[90vh]"
```

HoldingCard 2×3 그리드 — 이미 `grid-cols-3` 이므로 모바일에서 좁음:
```tsx
// Before
<div className="grid grid-cols-3 gap-1.5">

// After: 그대로 유지 (카드 내부 텍스트가 이미 text-xs, text-sm, 양호)
```

차트 높이 확인: 현재 `height={160}` — ResponsiveContainer로 감싸져 있어 양호.

**Step 3: 필터 바 모바일 스크롤**

현재 `flex flex-wrap items-center gap-2` — select들이 많아 모바일에서 여러 줄. 허용 가능이지만 개선:

```tsx
// 검색+필터 바 전체를 grid로
// 현재: flex flex-wrap — 유지 (자동 줄바꿈 허용)
// 추가 변경 없음 — 양호
```

**Step 4: 빌드 확인 + 커밋**
```bash
npm run build 2>&1 | tail -5
git add components/portfolio/SecuritiesManager.tsx
git commit -m "feat(mobile): 종목 모달 max-h 모바일 대응"
```

---

## Task 7: CompareClient + 기타 소폭 정리

**Files:**
- Modify: `components/CompareClient.tsx`

**Step 1: 연도 선택 카드 패딩**

```tsx
// Before
<div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-4 flex items-center gap-6 flex-wrap">

// After
<div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-4 sm:gap-6 flex-wrap">
```

**Step 2: "연도 선택" 텍스트 — 모바일에서 숨기기**

```tsx
// Before
<span className="text-sm font-semibold text-slate-600">연도 선택</span>

// After
<span className="hidden sm:inline text-sm font-semibold text-slate-600">연도 선택</span>
```

**Step 3: 빌드 확인 + 커밋**
```bash
npm run build 2>&1 | tail -5
git add components/CompareClient.tsx
git commit -m "feat(mobile): 연도비교 패딩 모바일 최적화"
```

---

## Task 8: 최종 빌드 & 배포

**Step 1: 전체 빌드 에러 없음 확인**
```bash
npm run build 2>&1 | tail -20
```

**Step 2: deploy-finance 스킬로 배포**
```bash
git push origin master
ssh ubuntu "cd ~/finance && git pull && docker compose build --no-cache && docker compose up -d"
```

---

## 실행 순서 요약

| Task | 파일 | 핵심 변경 |
|------|------|-----------|
| 1 | ExpenseTable.tsx | 모바일 카드 / 데스크탑 테이블 분기 |
| 2 | DrilldownPanel.tsx | 헤더 column→row, p-4 sm:p-6 |
| 3 | PortfolioDashboard.tsx | 계좌 grid-cols-2 sm:3 lg:6 |
| 4 | PortfolioKpiCards.tsx | grid-cols-2 md:3 lg:5, p-4 sm:p-5 |
| 5 | IncomeDashboard.tsx | KPI 1열, 배당테이블 카드 |
| 6 | SecuritiesManager.tsx | 모달 max-h dvh |
| 7 | CompareClient.tsx | 패딩/텍스트 소폭 조정 |
| 8 | — | 빌드 + 배포 |
