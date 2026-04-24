# Design System Unification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `lib/styles.ts` 공유 클래스 상수 파일을 만들고, `docs/design-system.md`를 단일 진실 공급원으로 갱신한 뒤, 전체 컴포넌트에 일관된 디자인을 적용한다.

**Architecture:** 새 의존성 없이 Tailwind 클래스 문자열을 `lib/styles.ts`에 상수로 집중 관리한다. 컴포넌트는 이 상수를 import해서 사용하고, 인라인 임시 상수(`const inp = ...`)는 모두 제거한다. 디자인 시스템 문서는 "어떤 상수를 써야 하는가"의 기준이 된다.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, TypeScript

---

## 불일치 기준 (수정 대상)

| 항목 | 현재 혼재 패턴 | 통일 기준 |
|------|--------------|---------|
| Focus ring | `ring-1 ring-blue-200` / `ring-1 ring-blue-300` / `ring-2 ring-blue-300` | `ring-1 ring-blue-300` |
| Modal overlay | `bg-black/30` / `bg-black/40` / `bg-black/50` | `bg-black/40` |
| Disabled opacity | `disabled:opacity-30` / `disabled:opacity-50` | `disabled:opacity-50` |
| 폼 label | `text-xs mb-1` / `text-[10px] mb-0.5` | `text-xs text-slate-400 mb-1` |
| z-index | `z-50` / `z-[9999]` | `z-50` (드롭다운 `z-40`, 최상위 모달 `z-60`) |
| 카드 shadow | `shadow-sm` 있거나 없거나 | 외부 카드만 `shadow-sm`, 내부 서브카드 없음 |
| Primary 버튼 패딩 | `px-2/3/4/5 py-0.5/1.5/2` | `px-4 py-1.5` (sm), `px-5 py-2` (md) |
| 인라인 상수 | 각 파일마다 `const inp = ...` 중복 정의 | `lib/styles.ts`에서 import |

---

### Task 1: `lib/styles.ts` 생성

**Files:**
- Create: `lib/styles.ts`

**Step 1: 파일 생성**

```typescript
// lib/styles.ts
// 앱 전체 공유 Tailwind 클래스 상수.
// 컴포넌트에서 인라인으로 정의하던 const inp = '...' 등을 여기서 가져다 쓴다.

// ─── 버튼 ──────────────────────────────────────────────────────────────────
// 사용: <button className={btn.primary} style={{ backgroundColor: palette.colors[0] }}>
// 주의: primary는 backgroundColor를 style prop으로 별도 지정해야 함 (테마 색상)
export const btn = {
  // 주 액션 버튼 — 배경색은 style={{ backgroundColor: palette.colors[0] }}로 지정
  primary:
    'px-4 py-1.5 rounded-lg text-xs font-medium text-white ' +
    'hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap',
  // 보조 버튼 — 아웃라인
  secondary:
    'px-4 py-1.5 rounded-lg text-xs font-medium border border-slate-200 ' +
    'text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap',
  // 고스트 버튼 — 배경 없음
  ghost:
    'px-4 py-1.5 rounded-lg text-xs text-slate-500 ' +
    'hover:bg-slate-100 transition-colors',
  // 아이콘 버튼 — SVG 래퍼
  icon:
    'p-1.5 rounded-lg text-slate-300 hover:text-slate-600 ' +
    'hover:bg-slate-100 transition-colors',
  // 위험 아이콘 버튼 — 삭제 등
  danger:
    'p-1.5 rounded-lg text-slate-300 hover:text-rose-400 ' +
    'hover:bg-rose-50 transition-colors',
  // 토글 필터 — pill 형태, active 여부를 외부에서 style로 제어
  // 사용: className={btn.pill(isActive)} style={isActive ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] } : undefined}
  pill: (active: boolean) =>
    `text-xs px-2.5 py-1 rounded-full border transition-colors ${
      active
        ? 'text-white border-transparent'
        : 'border-slate-200 text-slate-500 hover:border-slate-400'
    }`,
} as const

// ─── 카드 ──────────────────────────────────────────────────────────────────
// rounded-2xl 고정. rounded-xl은 카드에 사용 금지.
// shadow-sm은 페이지 최상위 카드에만. 내부 서브카드는 shadow 없음.
export const card = {
  // 기본 카드 — 페이지 주요 섹션
  base: 'bg-white rounded-2xl shadow-sm border border-slate-100',
  // 내부 서브카드 — 카드 안의 카드 (shadow 없음)
  inner: 'bg-white rounded-2xl border border-slate-100',
  // 호버 효과 카드 — 클릭 가능한 카드
  interactive: 'bg-white rounded-2xl border border-slate-100 hover:-translate-y-0.5 transition-all cursor-pointer',
  // 배경 서브 영역 — 카드 내 구분 영역
  sub: 'bg-slate-50 rounded-xl border border-slate-100',
} as const

// ─── 폼 ───────────────────────────────────────────────────────────────────
// focus ring: ring-1 ring-blue-300 로 통일
export const field = {
  // 텍스트 인풋, 셀렉트 공통 기반
  input:
    'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 ' +
    'focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white',
  // 셀렉트 (bg-white 명시 포함 — 동일)
  select:
    'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 ' +
    'focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white',
  // 검색 인풋 — 아이콘용 왼쪽 패딩
  search:
    'w-full border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-500 ' +
    'placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white',
  // 텍스트에어리어
  textarea:
    'w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 ' +
    'focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white resize-none',
  // 폼 레이블
  label: 'block text-xs text-slate-400 mb-1',
  // 컴팩트 레이블 (공간이 매우 좁을 때)
  labelSm: 'block text-[10px] text-slate-500 mb-0.5',
  // 드래그존 (파일 업로드)
  dropzone:
    'border-2 border-dashed border-slate-200 rounded-xl p-6 text-center ' +
    'cursor-pointer hover:border-slate-300 transition-colors',
} as const

// ─── 배지 ──────────────────────────────────────────────────────────────────
export const badge = {
  // 기본 배지 — 카테고리, 중립 태그
  base: 'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
  // 소형 배지 — rounded (pill 아님)
  sm: 'inline-block px-1.5 py-0.5 rounded text-[10px] font-medium',
  // 티커 배지 — 고정폭 폰트
  ticker: 'inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono',
  // 사용자(owner) 배지 — 고정 blue 계열
  owner: 'inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600',
  // 최신 배지 — 파란 pill
  latest: 'inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-500',
  // 성공 배지 (Sheets)
  success: 'inline-block px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700',
  // 정보 배지 (Excel)
  info: 'inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700',
  // 중립 배지 (slate)
  neutral: 'inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500',
} as const

// ─── 모달 ──────────────────────────────────────────────────────────────────
// z-index 체계: 드롭다운 z-40 / 기본 모달 z-50 / 최상위 모달 z-60
// overlay: bg-black/40 으로 통일
export const modal = {
  // 전체화면 오버레이
  overlay:
    'fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4',
  // 최상위 오버레이 (모달 위의 모달)
  overlayTop:
    'fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4',
  // 모달 컨테이너 — 기본 (max-w-md)
  container:
    'bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col ' +
    'max-h-[95dvh] sm:max-h-[90vh] overflow-hidden',
  // 모달 컨테이너 — 넓음 (max-w-lg)
  containerLg:
    'bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col ' +
    'max-h-[95dvh] sm:max-h-[90vh] overflow-hidden',
  // 헤더
  header:
    'flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0',
  // 스크롤 바디
  body: 'px-6 py-4 space-y-4 overflow-y-auto flex-1',
  // 푸터
  footer:
    'flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0',
  // 닫기 버튼
  close:
    'text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 ' +
    'transition-colors shrink-0',
} as const

// ─── 텍스트 계층 ────────────────────────────────────────────────────────────
export const text = {
  pageTitle:    'text-xl font-bold text-slate-800',
  sectionTitle: 'text-sm font-semibold text-slate-700',
  cardTitle:    'text-xs font-semibold text-slate-600',
  label:        'text-xs text-slate-400 font-medium uppercase tracking-wider',
  body:         'text-xs text-slate-600',
  caption:      'text-[10px] text-slate-400',
  muted:        'text-xs text-slate-300',
  // 금액 표시 — 크기는 별도 지정
  amount:       'font-bold tabular-nums text-slate-800',
  amountSm:     'font-semibold tabular-nums text-slate-700',
  // PnL 색상 (한국 관례: 상승=빨강, 하락=파랑)
  positive:     'text-rose-500',
  negative:     'text-blue-500',
} as const

// ─── 테이블 ─────────────────────────────────────────────────────────────────
export const tbl = {
  th:      'text-left py-2 px-3 text-xs text-slate-400 font-medium',
  thRight: 'text-right py-2 px-3 text-xs text-slate-400 font-medium',
  td:      'py-2.5 px-3 text-xs text-slate-600',
  tdRight: 'py-2.5 px-3 text-xs text-slate-600 text-right tabular-nums',
  // 홀수행 기본, 짝수행 줄무늬
  rowEven: 'border-b border-slate-50 hover:bg-slate-50 transition-colors',
  rowOdd:  'border-b border-slate-50 hover:bg-slate-50 transition-colors bg-slate-50/40',
} as const

// ─── 로딩 ───────────────────────────────────────────────────────────────────
export const skeleton = {
  line:  'h-4 bg-slate-100 rounded animate-pulse',
  card:  'h-24 bg-slate-50 rounded-xl animate-pulse',
  chart: 'h-[200px] bg-slate-50 rounded-xl animate-pulse',
} as const

// ─── 레이아웃 ────────────────────────────────────────────────────────────────
export const layout = {
  page:    'max-w-7xl mx-auto px-4 py-8 space-y-6',
  section: 'space-y-4',
} as const
```

**Step 2: 타입 체크 확인**

```bash
npx tsc --noEmit
```
Expected: 오류 없음

**Step 3: 커밋**

```bash
git add lib/styles.ts
git commit -m "feat: lib/styles.ts — 공유 디자인 클래스 상수 추가"
```

---

### Task 2: `docs/design-system.md` 갱신

**Files:**
- Modify: `docs/design-system.md`

기존 문서를 `lib/styles.ts` 사용법 중심으로 전면 재작성한다. 기술 부채 표도 최신 상태로 갱신한다.

**Step 1: 전면 재작성**

기존 파일을 아래 내용으로 교체한다. 변경 포인트:
- 섹션 0 추가: "빠른 참조 — `lib/styles.ts`"
- 각 섹션에 "코드에서 어떻게 쓰나" 예시 추가
- 기술 부채 표에서 이미 해결된 항목 제거
- Chart XAxis tick fontSize 11 → 10으로 통일 (이미 수정됨)
- z-index 체계 명시

재작성 내용 (전체):

```markdown
# Ledger Design System

> 앱 전체의 시각적 일관성과 개발 효율을 위한 디자인 기준 문서.  
> **새 컴포넌트를 만들 때 이 기준과 `lib/styles.ts`를 먼저 확인할 것.**

---

## 0. 빠른 참조 — `lib/styles.ts`

컴포넌트 내부에 Tailwind 클래스를 하드코딩하지 말 것.  
`lib/styles.ts`에서 상수를 import해서 사용한다.

```tsx
import { btn, card, field, badge, modal, text, tbl } from '@/lib/styles'

// 버튼
<button className={btn.primary} style={{ backgroundColor: palette.colors[0] }}>추가</button>
<button className={btn.secondary}>취소</button>
<button className={btn.icon} title="수정"><EditIcon /></button>
<button className={btn.danger} title="삭제"><TrashIcon /></button>

// 카드
<div className={`${card.base} p-4 sm:p-6`}>...</div>
<div className={`${card.inner} p-4`}>...</div>

// 폼
<label className={field.label}>계좌명</label>
<input className={field.input} />
<select className={field.select}>...</select>
<textarea className={field.textarea} rows={3} />

// 배지
<span className={`${badge.base} bg-slate-100 text-slate-700`}>{value}</span>
<span className={badge.owner}>{owner}</span>
<span className={badge.ticker} style={{ backgroundColor: hex+'20', color: hex }}>{ticker}</span>

// 모달
<div className={modal.overlay}>
  <div className={modal.container}>
    <div className={modal.header}>...</div>
    <div className={modal.body}>...</div>
    <div className={modal.footer}>...</div>
  </div>
</div>

// 테이블
<th className={tbl.th}>날짜</th>
<td className={tbl.td}>{value}</td>
<tr className={i % 2 === 0 ? tbl.rowEven : tbl.rowOdd}>
```

---

## 1. 색상

### Slate Scale (주요 텍스트/배경)

| 토큰 | Tailwind | 용도 |
|------|----------|------|
| 최상위 텍스트 | `text-slate-800` | 페이지 제목, 금액 강조 |
| 보조 텍스트 | `text-slate-700` | 섹션 제목 |
| 3차 텍스트 | `text-slate-600` | 일반 본문 |
| 약한 텍스트 | `text-slate-400` | 날짜, 메타, 레이블 |
| 최약 텍스트 | `text-slate-300` | 플레이스홀더, 비활성 아이콘 |
| 기본 배경 | `bg-white` | 카드 내부 |
| 밝은 배경 | `bg-slate-50` | 대체행, 선택 상태 |
| 서브 배경 | `bg-slate-100` | 비활성 배지 배경 |
| 분리선 | `border-slate-100` | 카드 테두리 |
| 행 구분 | `border-slate-50` | 테이블 행 사이 |

### 시맨틱 색상

| 의미 | 색상 | 용도 |
|------|------|------|
| 수익 (+) | `text-rose-500` | 수익, 평가이익 (한국 관례 — 상승=빨강) |
| 손실 (-) | `text-blue-500` | 손실, 평가손실 |
| 성공 | `text-green-700` / `bg-green-100` | Google Sheets 태그 |
| 정보 | `text-blue-700` / `bg-blue-100` | Excel 태그 |
| 경고 | `text-orange-500` / `bg-orange-100` | 연결 해제, 주의 |
| 멤버 L | `text-blue-600` / `bg-blue-50` | 멤버 배지 |
| 멤버 P | `text-pink-600` / `bg-pink-50` | 멤버 배지 |

### 테마 색상 (ThemeContext)

앱의 강조색은 `palette.colors[0~3]`에서 가져온다. **hex 값 하드코딩 금지.**

```tsx
const { palette } = useTheme()
// palette.colors[0] — 주 강조색 (버튼, 차트 첫 번째 시리즈)
// palette.colors[1..] — 보조 강조색
```

**예외:** 이동평균선 전용 고정색 (MA 의미 색상이라 테마 무관)
- MA5: `#fb923c` (orange-400)
- MA20: `#a78bfa` (violet-400)  
- MA60: `#38bdf8` (sky-400)

---

## 2. 타이포그래피

### 텍스트 크기 규칙

| 크기 | Tailwind | 용도 |
|------|----------|------|
| 페이지 제목 | `text-xl font-bold` | 페이지 H1 |
| 섹션 제목 | `text-sm font-semibold` | 카드 내 섹션 H3 |
| 카드 제목 | `text-xs font-semibold` | 소형 카드 제목 |
| 레이블 | `text-xs font-medium uppercase tracking-wider` | KPI 레이블, 필터 제목 |
| 본문 | `text-xs` | 테이블 셀, 설명 |
| 보조 | `text-[10px]` | 배지, 메타 태그, 아이콘 버튼 옆 |

> `text-[8px]`, `text-[9px]`, `text-[11px]` 사용 금지.  
> `text-xs` (12px) 또는 `text-[10px]`로만 사용할 것.

### 금액 표시 규칙

```tsx
import { formatWonRound, formatWonCompact } from '@/lib/utils'

formatWonRound(n)   // "1,234,567원" — 테이블 셀, 정밀 표시
formatWonCompact(n) // "123만", "1.2억" — KPI 카드, 차트 툴팁
```

항상 `tabular-nums` 클래스 추가.

---

## 3. 간격 (Spacing)

### 페이지 레이아웃

```tsx
import { layout } from '@/lib/styles'
<div className={layout.page}>  {/* max-w-7xl mx-auto px-4 py-8 space-y-6 */}
```

### 카드 내부 패딩

| 상황 | 추가 클래스 |
|------|------------|
| 기본 카드 | `p-4 sm:p-6` |
| KPI 카드 | `p-4 sm:p-5` |
| 컴팩트 서브카드 | `p-3` |
| 배지 | `px-2 py-0.5` |
| 소형 버튼 | `px-2.5 py-1` |
| 기본 버튼 | `px-4 py-1.5` |

---

## 4. 컴포넌트 패턴

### 버튼

```tsx
import { btn } from '@/lib/styles'

// 주 액션 (테마 색상)
<button className={btn.primary} style={{ backgroundColor: palette.colors[0] }}>추가</button>

// 보조 (아웃라인)
<button className={btn.secondary}>취소</button>

// 고스트
<button className={btn.ghost}>더보기</button>

// 아이콘 (수정)
<button className={btn.icon} title="수정"><PencilIcon /></button>

// 아이콘 (삭제)
<button className={btn.danger} title="삭제"><TrashIcon /></button>

// 토글 필터 pill
<button
  className={btn.pill(isActive)}
  style={isActive ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] } : undefined}
>
  전체
</button>
```

### 카드

```tsx
import { card } from '@/lib/styles'

// 최상위 카드 (shadow 있음)
<div className={`${card.base} p-4 sm:p-6`}>

// 내부 서브카드 (shadow 없음)
<div className={`${card.inner} p-4`}>

// 클릭 가능한 카드
<div className={`${card.interactive} p-4`} onClick={...}>
```

### 폼

```tsx
import { field } from '@/lib/styles'

<div>
  <label className={field.label}>계좌명</label>
  <input type="text" className={field.input} />
</div>

<div>
  <label className={field.label}>종류</label>
  <select className={field.select}>...</select>
</div>

{/* 검색 인풋 */}
<div className="relative">
  <input className={field.search} placeholder="검색..." />
  <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
</div>

{/* 파일 드래그존 */}
<div className={field.dropzone} onClick={...} onDragOver={...} onDrop={...}>
```

### 배지

```tsx
import { badge } from '@/lib/styles'

// 중립 태그
<span className={`${badge.base} bg-slate-100 text-slate-700`}>{value}</span>

// 카테고리 (동적 색상)
<span className={`${badge.base} ${CAT_BADGE[cat]}`}>{cat}</span>

// 티커 (동적 색상)
<span className={badge.ticker} style={{ backgroundColor: hex+'20', color: hex }}>SCHD</span>

// 사용자
<span className={badge.owner}>L</span>

// 최신 표시
<span className={badge.latest}>최신</span>
```

### 모달

```tsx
import { modal } from '@/lib/styles'

// 기본 모달 구조
{show && (
  <div className={modal.overlay} onClick={onClose}>
    <div className={modal.container} onClick={e => e.stopPropagation()}>
      <div className={modal.header}>
        <h2 className="text-sm font-semibold text-slate-700">제목</h2>
        <button className={modal.close} onClick={onClose}>✕</button>
      </div>
      <div className={modal.body}>
        {/* 스크롤 가능 영역 */}
      </div>
      <div className={modal.footer}>
        <button className={btn.secondary} onClick={onClose}>취소</button>
        <button className={btn.primary} style={{ backgroundColor: palette.colors[0] }}>저장</button>
      </div>
    </div>
  </div>
)}
```

> SecuritiesManager처럼 `createPortal`을 쓰는 경우 `modal.overlayTop` 사용.

### 테이블

```tsx
import { tbl } from '@/lib/styles'

<table className="w-full text-sm">
  <thead>
    <tr className="border-b border-slate-100">
      <th className={tbl.th}>날짜</th>
      <th className={tbl.thRight}>금액</th>
    </tr>
  </thead>
  <tbody>
    {items.map((item, i) => (
      <tr key={item.id} className={i % 2 === 0 ? tbl.rowEven : tbl.rowOdd}>
        <td className={tbl.td}>{item.date}</td>
        <td className={tbl.tdRight}>{formatWonRound(item.amount)}</td>
      </tr>
    ))}
  </tbody>
</table>
```

### 토글 스위치

```tsx
<button
  onClick={() => setActive(!active)}
  className={`relative w-11 h-6 rounded-full transition-colors ${active ? 'bg-slate-800' : 'bg-slate-200'}`}
>
  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-5' : ''}`} />
</button>
```

### 빈 상태 (Empty State)

```tsx
// 테이블 행 내
<tr>
  <td colSpan={n} className="py-10 text-center text-slate-400 text-xs">내역이 없습니다</td>
</tr>

// 카드 내
<p className="text-center text-slate-400 text-xs py-8">내역이 없습니다</p>

// 페이지 전체 (이모지 + 설명)
<div className="text-center py-16">
  <p className="text-4xl mb-4">📭</p>
  <p className="text-sm font-semibold text-slate-700 mb-1">데이터가 없습니다</p>
  <p className="text-xs text-slate-400">설명 텍스트</p>
</div>
```

### 로딩 상태

```tsx
import { skeleton } from '@/lib/styles'

// 라인 스켈레톤
<div className={skeleton.line} />

// 카드 스켈레톤
<div className={skeleton.card} />

// 차트 스켈레톤
<div className={skeleton.chart} />

// 버튼 로딩
<button disabled className={`${btn.primary} disabled:opacity-50`} style={...}>
  {loading ? '처리 중...' : '확인'}
</button>
```

---

## 5. 반응형 규칙

### 브레이크포인트 기준

| 구분 | Tailwind | px |
|------|----------|----|
| 모바일 (기본) | — | < 640px |
| 태블릿 | `sm:` | 640px+ |
| 소형 데스크탑 | `md:` | 768px+ |
| 데스크탑 | `lg:` | 1024px+ |

### 그리드 패턴

```tsx
// KPI 카드
grid-cols-2 md:grid-cols-3 lg:grid-cols-5

// 계좌 카드
grid-cols-2 sm:grid-cols-3 lg:grid-cols-6

// 일반 2컬럼
grid-cols-1 sm:grid-cols-2

// 일반 3컬럼
grid-cols-1 sm:grid-cols-3
```

### 테이블 → 카드 분기 패턴

데이터 테이블은 반드시 모바일 카드 뷰를 함께 제공한다.

```tsx
{/* 모바일 카드 뷰 */}
<div className="sm:hidden space-y-2">
  {items.map(item => (
    <div className="border border-slate-100 rounded-xl px-4 py-3 bg-white">
      ...
    </div>
  ))}
</div>

{/* 데스크탑 테이블 뷰 */}
<div className="hidden sm:block overflow-x-auto">
  <table ...>
```

### 모달 높이

```tsx
// 기본 모달
max-h-[95dvh] sm:max-h-[90vh]
```

---

## 6. z-index 레이어 체계

| 용도 | 값 | 클래스 |
|------|-----|--------|
| 드롭다운 (인풋 위) | 40 | `z-40` |
| 일반 모달 | 50 | `z-50` (modal.overlay) |
| 최상위 모달 (portal) | 9999 | `z-[9999]` (modal.overlayTop) |

---

## 7. 차트 (Recharts)

### 기본 스타일

```tsx
<XAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
<YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
<CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
```

차트 색상은 항상 `palette.colors[i]`에서 가져온다.

### 커스텀 툴팁 타입

```tsx
import type { ChartTooltipProps } from '@/lib/chartTypes'

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-100 rounded-lg px-3 py-1.5 shadow-sm">
      <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
      <p className="text-xs font-semibold text-slate-800">{...}</p>
    </div>
  )
}
```

---

## 8. 접근성

- 아이콘 버튼에 `title` 또는 `aria-label` 필수
- 폼 인풋과 `label` 연결 (`htmlFor` + `id`)
- 색상만으로 상태 표시 금지 (텍스트·아이콘 보조)
- 모바일 터치 타깃 최소 44×44px (`py-2` 이상)

---

## 9. 파일/컴포넌트 구조 규칙

### 컴포넌트 크기 한도

| 규모 | 줄 수 | 조치 |
|------|-------|------|
| 적정 | ~200 | 유지 |
| 검토 | ~400 | 분할 고려 |
| 분할 필요 | 400+ | 서브컴포넌트 추출 |

### 네이밍 컨벤션

- 페이지 전용 클라이언트: `*Client.tsx`
- 공유 UI: `components/` 루트
- 포트폴리오 전용: `components/portfolio/`
- 가계부 전용: `components/` 루트

### 유틸 함수 위치

| 함수 | 위치 |
|------|------|
| 금액 포맷 | `lib/utils.ts` |
| 클래스 상수 | `lib/styles.ts` |
| 차트 타입 | `lib/chartTypes.ts` |
| 배당 유틸 | `lib/portfolio/dividendUtils.ts` |
| 포트폴리오 타입 | `lib/portfolio/types.ts` |

> 컴포넌트 내부에 `const inp = '...'` 형태로 클래스를 정의하지 말 것.  
> `lib/styles.ts`에 추가 후 import할 것.

---

## 10. 알려진 기술 부채

| 항목 | 파일 | 우선순위 |
|------|------|----------|
| `SecuritiesManager` 895줄 — 분할 고려 | `SecuritiesManager.tsx` | P2 |
| 컴포넌트 내 인라인 클래스 상수 | 다수 파일 | P2 (styles.ts 도입으로 점진 해결) |
```

**Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

**Step 3: 커밋**

```bash
git add docs/design-system.md
git commit -m "docs: design-system.md 전면 갱신 — styles.ts 연동, z-index 체계, 최신화"
```

---

### Task 3: DividendFormModal + DividendTable에 styles.ts 적용

**Files:**
- Modify: `components/portfolio/DividendFormModal.tsx`
- Modify: `components/portfolio/DividendTable.tsx`

가장 최근 작성된 파일로 적용 패턴을 검증한다.

**Step 1: DividendFormModal.tsx 수정**

`const inp = ...`, `const sel = ...`, `const filterBtnCls = ...` 인라인 상수 제거.  
`import { btn, field, modal } from '@/lib/styles'` 추가.

주요 변경:
```tsx
// Before
import { fmtDate } from '@/lib/portfolio/dividendUtils'
// const inp = 'w-full border border-slate-200 ...'  ← 삭제
// const sel = 'w-full border border-slate-200 ...'  ← 삭제
// const filterBtnCls = (active) => `... ${active ? ...}`  ← 삭제

// After
import { btn, field, modal } from '@/lib/styles'
import { fmtDate } from '@/lib/portfolio/dividendUtils'

// 모달 overlay
<div className={modal.overlay}>
  <div className={modal.containerLg}>
    <div className={modal.header}>
      <h2 className="text-sm font-semibold text-slate-700">제목</h2>
      <button className={modal.close} onClick={onClose}>X아이콘</button>
    </div>
    <form className={modal.body}>
      <label className={field.label}>계좌</label>
      <select className={field.select}>...</select>
      <input className={field.input} />
      <button type="button" className={btn.pill(active)} style={...}>필터</button>
    </form>
    <div className={modal.footer}>
      <button className={btn.secondary} onClick={onClose}>취소</button>
      <button className={btn.primary} style={{ backgroundColor: palette.colors[0] }}>저장</button>
    </div>
  </div>
</div>
```

**Step 2: DividendTable.tsx 수정**

추가 버튼, 아이콘 버튼, 페이지네이션 버튼에 styles.ts 적용.

```tsx
import { btn, tbl } from '@/lib/styles'

// 추가 버튼
<button className={btn.primary} style={{ backgroundColor: palette.colors[0] }}>+ 배당 추가</button>

// 수정 버튼
<button className={btn.icon} onClick={() => onEdit(d)} title="수정"><EditIcon /></button>

// 삭제 버튼
<button className={btn.danger} onClick={() => onDelete(d.id)} title="삭제"><TrashIcon /></button>

// 테이블 헤더
<th className={tbl.th}>날짜</th>
<th className={tbl.thRight}>수령액</th>

// 테이블 행
<tr key={d.id} className={i % 2 === 0 ? tbl.rowEven : tbl.rowOdd}>
```

**Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

**Step 4: 커밋**

```bash
git add components/portfolio/DividendFormModal.tsx components/portfolio/DividendTable.tsx
git commit -m "refactor: DividendFormModal+Table — lib/styles.ts 적용"
```

---

### Task 4: HoldingsManager에 styles.ts 적용

**Files:**
- Modify: `components/portfolio/HoldingsManager.tsx`

**Step 1: import 추가**

```tsx
import { btn, card, field, badge, modal, tbl } from '@/lib/styles'
```

**Step 2: 주요 변환 패턴**

파일 내 `const inp = ...` 또는 반복되는 클래스 문자열 블록 제거 후 상수로 교체.

| 패턴 | 전 | 후 |
|------|-----|-----|
| 아이콘 수정 버튼 | `"text-slate-300 hover:text-slate-500 ..."` | `btn.icon` |
| 아이콘 삭제 버튼 | `"text-slate-300 hover:text-rose-400 ..."` | `btn.danger` |
| 폼 인풋 | `"w-full border border-slate-200 rounded-lg ..."` | `field.input` |
| 폼 레이블 | `"block text-xs text-slate-400 mb-1"` | `field.label` |
| 모달 overlay | `"fixed inset-0 z-50 flex ... bg-black/40"` | `modal.overlay` |

**Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

**Step 4: 커밋**

```bash
git add components/portfolio/HoldingsManager.tsx
git commit -m "refactor: HoldingsManager — lib/styles.ts 적용"
```

---

### Task 5: AccountsManager + OptionsManager에 styles.ts 적용

**Files:**
- Modify: `components/portfolio/AccountsManager.tsx`
- Modify: `components/portfolio/OptionsManager.tsx`

**Step 1: AccountsManager — import + 변환**

```tsx
import { btn, card, field, badge, modal } from '@/lib/styles'
```

아이콘 버튼, 폼 필드, 모달 패턴 교체.

**Step 2: OptionsManager — import + 변환**

`text-xs` / `focus:ring-1 focus:ring-blue-300` 통일.

```tsx
import { btn, field } from '@/lib/styles'
// text-[11px] → text-xs (이미 완료됨)
// focus:ring-2 → focus:ring-1 focus:ring-blue-300
```

**Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

**Step 4: 커밋**

```bash
git add components/portfolio/AccountsManager.tsx components/portfolio/OptionsManager.tsx
git commit -m "refactor: AccountsManager+OptionsManager — lib/styles.ts 적용"
```

---

### Task 6: SecuritiesManager에 styles.ts 적용

**Files:**
- Modify: `components/portfolio/SecuritiesManager.tsx`

**Step 1: import 추가**

```tsx
import { btn, card, field, badge, modal } from '@/lib/styles'
```

**Step 2: SecurityModal 내부 변환**

```tsx
// Before
const inp = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300'
const lbl = 'block text-[10px] text-slate-500 mb-0.5'

// After — 상수 삭제, field.input / field.labelSm 사용
```

createPortal 모달은 `modal.overlayTop` 사용:
```tsx
<div className={modal.overlayTop} onClick={onClose}>
  <div className={modal.container} onClick={e => e.stopPropagation()}>
```

**Step 3: PriceHistoryModal 내부 변환**

HoldingCard 내 클래스 정리.

**Step 4: 타입 체크**

```bash
npx tsc --noEmit
```

**Step 5: 커밋**

```bash
git add components/portfolio/SecuritiesManager.tsx
git commit -m "refactor: SecuritiesManager — lib/styles.ts 적용"
```

---

### Task 7: 가계부 컴포넌트 (ExpenseTable, DrilldownPanel, KpiCards)

**Files:**
- Modify: `components/ExpenseTable.tsx`
- Modify: `components/DrilldownPanel.tsx`
- Modify: `components/KpiCards.tsx`
- Modify: `components/SettingsClient.tsx`
- Modify: `components/AdminClient.tsx`

**Step 1: 각 파일 import 추가 + 버튼/폼 교체**

```tsx
import { btn, card, field, badge, modal, tbl } from '@/lib/styles'
```

**Step 2: ExpenseTable**

```tsx
// 아이콘 버튼들
<button className={btn.icon} title="수정">
<button className={btn.danger} title="삭제">

// 테이블 헤더/행
<th className={tbl.th}>
<tr className={i % 2 === 0 ? tbl.rowEven : tbl.rowOdd}>
```

**Step 3: DrilldownPanel**

```tsx
// overlay 버튼/레이블 정리
// 스켈레톤 로딩 → skeleton.chart
```

**Step 4: SettingsClient, AdminClient**

```tsx
// 입력 필드들
<input className={field.input} />
// 업로드 드래그존
<div className={field.dropzone}>
// 버튼들
<button className={btn.primary} ...>
<button className={btn.secondary} ...>
```

**Step 5: 타입 체크**

```bash
npx tsc --noEmit
```

**Step 6: 커밋 + 배포**

```bash
git add components/ExpenseTable.tsx components/DrilldownPanel.tsx components/KpiCards.tsx \
        components/SettingsClient.tsx components/AdminClient.tsx
git commit -m "refactor: 가계부 컴포넌트 — lib/styles.ts 적용"
git push origin master
ssh ubuntu "cd ~/finance && git pull && docker compose build --no-cache && docker compose up -d"
```
