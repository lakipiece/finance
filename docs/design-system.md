# Ledger Design System

> 앱 전체의 시각적 일관성과 개발 효율을 위한 디자인 기준 문서.
> 새 컴포넌트를 만들 때 이 기준을 먼저 참조할 것.

---

## 1. 색상

### Slate Scale (주요 텍스트/배경)

| 토큰 | Tailwind | 용도 |
|------|----------|------|
| 최상위 텍스트 | `text-slate-800` | 페이지 제목, 금액 등 강조 |
| 보조 텍스트 | `text-slate-600` | 섹션 제목, 레이블 |
| 약한 텍스트 | `text-slate-400` | 날짜, 메타 정보 |
| 최약 텍스트 | `text-slate-300` | 플레이스홀더, 비활성 아이콘 |
| 기본 배경 | `bg-white` | 카드 내부 |
| 밝은 배경 | `bg-slate-50` | 대체행, 선택 상태 배경 |
| 분리선 | `border-slate-100` | 카드 테두리, 테이블 구분선 |
| 구분선 | `border-slate-50` | 테이블 행 사이 |

### 시맨틱 색상

| 의미 | 색상 | 용도 |
|------|------|------|
| 수익 (+) | `text-rose-500` / `bg-rose-50` | 수익, 평가이익 |
| 손실 (-) | `text-blue-500` / `bg-blue-50` | 손실, 평가손실 |
| 성공 | `text-green-700` / `bg-green-100` | Google Sheets 태그 |
| 정보 | `text-blue-700` / `bg-blue-100` | Excel 태그 |
| 멤버 L | `text-blue-600` / `bg-blue-50` | 멤버 뱃지 L |
| 멤버 P | `text-pink-600` / `bg-pink-50` | 멤버 뱃지 P |

### 테마 색상 (ThemeContext)

앱의 강조색은 `palette.colors[0~3]`에서 가져온다. 하드코딩하지 말 것.

```tsx
const { palette } = useTheme()
// palette.colors[0] — 주 강조색 (버튼, 차트 첫 번째 시리즈)
// palette.colors[1] — 두 번째 강조색
```

---

## 2. 타이포그래피

### 텍스트 크기 규칙

| 크기 | Tailwind | 용도 |
|------|----------|------|
| 페이지 제목 | `text-lg font-bold` | DrilldownPanel 헤더 |
| 섹션 제목 | `text-sm font-semibold` | 카드 내 섹션 |
| 레이블 | `text-xs font-medium` | 컨트롤 레이블, 테이블 헤더 |
| 본문 | `text-xs` | 테이블 셀, 설명 |
| 보조 | `text-[10px]` | 뱃지, 메타 태그 |
| 미니 | `text-[9px]` | 아주 작은 수익률 뱃지만 허용 |

> `text-[11px]`, `text-[8px]` 사용 금지. `text-xs` 또는 `text-[10px]`로 통일.

### 금액 표시 규칙

```tsx
// 전체 금액 (만원 이하 포함)
formatWonFull(n)  // → "1,234,567원"

// 축약 (차트 툴팁)
fmt(n)            // → "123만", "1.2억"

// 수익률
`${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
```

항상 `tabular-nums` 클래스 추가.

---

## 3. 간격 (Spacing)

### 페이지 레이아웃

```tsx
<div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
```

- 최대 너비: `max-w-7xl`
- 수평 패딩: `px-4` (고정, 반응형 불필요)
- 수직 패딩: `py-8`
- 섹션 간격: `space-y-6`

### 카드 내부 패딩

| 상황 | 클래스 |
|------|--------|
| 기본 카드 | `p-4 sm:p-6` |
| 컴팩트 카드 (KPI 등) | `p-4 sm:p-5` |
| 표 컨테이너 | `p-4 sm:p-6` |
| 인라인 뱃지 | `px-2 py-0.5` |
| 소형 버튼 | `px-2.5 py-1` |
| 일반 버튼 | `px-3 py-1.5` |

---

## 4. 컴포넌트 패턴

### 카드 컨테이너

```tsx
// 기본
<div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-6">

// 컴팩트 (내부 패딩 작은 경우)
<div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">

// 호버 효과 있는 카드
<div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 hover:-translate-y-0.5 transition-all">
```

> `rounded-xl`과 `rounded-2xl` 혼용 금지. **카드는 항상 `rounded-2xl`.**
> `shadow-sm`은 페이지 메인 카드에만. 내부 서브카드는 `shadow-sm` 제거.

### KPI 카드 그리드

```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
  {cards.map(c => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 flex flex-col hover:-translate-y-0.5 transition-all">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{c.label}</p>
      <p className="text-lg sm:text-xl font-bold tabular-nums mt-auto text-right">{c.value}</p>
    </div>
  ))}
</div>
```

### 뱃지

```tsx
// 카테고리 뱃지 (색상별 — CAT_BADGE 사용)
<span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[cat]}`}>
  {cat}
</span>

// 일반 태그 (중립)
<span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
  {value}
</span>

// 멤버 뱃지
<span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
  member === 'L' ? 'bg-blue-50 text-blue-600' :
  member === 'P' ? 'bg-pink-50 text-pink-600' :
  'bg-slate-100 text-slate-500'
}`}>
  {member}
</span>
```

### 버튼

```tsx
// 주 액션 버튼 (테마 색상)
<button
  className="text-white px-3 py-1.5 rounded-lg text-xs hover:opacity-90 transition-opacity"
  style={{ backgroundColor: palette.colors[0] }}>
  + 추가
</button>

// 보조 버튼 (아웃라인)
<button className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors">
  취소
</button>

// 토글 필터 버튼 (pill)
<button className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
  active ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
}`}>
  전체
</button>

// 아이콘 버튼
<button className="text-slate-300 hover:text-slate-500 transition-colors p-1 rounded hover:bg-slate-100">
  <svg className="w-4 h-4">...</svg>
</button>

// 비활성 (disabled)
// disabled:opacity-50 만 추가, cursor-not-allowed 옵션
```

### 폼 인풋

```tsx
// 텍스트 인풋
<input
  type="text"
  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
/>

// 셀렉트
<select className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white">

// 검색 인풋 (아이콘 포함)
<div className="relative">
  <input className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs ..." />
  <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" .../>
</div>
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

### 페이지네이션 푸터

```tsx
<div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 flex-wrap gap-3">
  <div className="flex items-center gap-2 text-xs text-slate-400">
    <span>총 {total}건</span>
    <span className="text-slate-200">|</span>
    {/* 정렬/페이지당 버튼들 */}
  </div>
  <div className="flex items-center gap-1">
    {/* 처음 / 이전 / N/M / 다음 / 끝 */}
  </div>
</div>
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
| 와이드 | `xl:` | 1280px+ |

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

데이터 테이블은 반드시 모바일 카드 뷰를 제공한다.

```tsx
{/* 모바일 카드 뷰 */}
<div className="sm:hidden space-y-2">
  {items.map(item => (
    <div className="border border-slate-100 rounded-xl px-4 py-3 bg-white">
      {/* 카드 내용 */}
    </div>
  ))}
</div>

{/* 데스크탑 테이블 뷰 */}
<div className="hidden sm:block overflow-x-auto">
  <table className="w-full text-sm">
    {/* 테이블 내용 */}
  </table>
</div>
```

### 헤더/컨트롤 모바일 패턴

```tsx
{/* 제목 + 액션 버튼 헤더 */}
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
  <h3 className="text-sm font-semibold text-slate-700 shrink-0">제목</h3>
  <div className="flex items-center gap-2 flex-1 sm:justify-end">
    <div className="relative flex-1 sm:w-64 sm:flex-none">
      {/* 검색 인풋 */}
    </div>
    <button>+ 추가</button>
  </div>
</div>
```

### 모달

```tsx
<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[95dvh] sm:max-h-[90vh]">
    {/* 헤더 (shrink-0) */}
    {/* 스크롤 영역 (flex-1 overflow-y-auto) */}
    {/* 푸터 (shrink-0) */}
  </div>
</div>
```

---

## 6. 차트 (Recharts)

### 기본 스타일

```tsx
// XAxis / YAxis 공통
<XAxis
  tick={{ fontSize: 11, fill: '#94a3b8' }}
  axisLine={false}
  tickLine={false}
/>
<YAxis
  tick={{ fontSize: 11, fill: '#94a3b8' }}
  axisLine={false}
  tickLine={false}
/>

// CartesianGrid
<CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

// Tooltip 컨테이너
<div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
```

### 색상 사용

차트 색상은 항상 `palette.colors[i]`에서 가져온다. 고정 hex 사용 금지.

```tsx
const { palette } = useTheme()
<Bar fill={palette.colors[0]} />
<Line stroke={palette.colors[1]} />
```

이동평균선 예외 (MA 전용 고정색):
- MA5: `#fb923c` (orange-400)
- MA20: `#a78bfa` (violet-400)
- MA60: `#38bdf8` (sky-400)

---

## 7. 로딩 상태

```tsx
// Skeleton 카드
<div className="h-10 bg-slate-50 rounded-lg animate-pulse" />

// Skeleton 차트
<div className="h-[220px] bg-slate-50 rounded-xl animate-pulse" />

// 버튼 로딩
<button disabled className="... disabled:opacity-50">
  {loading ? '처리 중...' : '확인'}
</button>

// 동기화 중 (항목 레벨)
<div className={`... ${syncing ? 'animate-pulse' : ''}`}>
```

---

## 8. 접근성

- 모든 아이콘 버튼에 `title` 또는 `aria-label` 필수
- 폼 인풋에 `label` 또는 연결된 `htmlFor` 필수
- 색상만으로 상태 표시 금지 (텍스트 또는 아이콘 보조)
- 터치 타깃 최소 44×44px (모바일 버튼은 `py-2` 이상)

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
- 가계부 전용: `components/` 루트 (Dashboard*, Category*, Expense*, Drilldown*)

### 유틸 함수 위치

| 함수 | 위치 |
|------|------|
| 금액 포맷 | `lib/utils.ts` — `formatWon`, `formatWonFull` |
| 색상 매핑 | `lib/utils.ts` — `CAT_BADGE`, `CATEGORIES` |
| 포트폴리오 타입 | `lib/portfolio/types.ts` |
| 공통 타입 | `lib/types.ts` |

> 컴포넌트 내부에 포맷 함수 직접 정의 금지. `lib/utils.ts`에 추가 후 import.

---

## 10. 알려진 기술 부채

| 항목 | 파일 | 우선순위 |
|------|------|----------|
| `AdminClient` + `SettingsClient` 중복 로직 | 두 파일 | P0 |
| `any` 타입 Recharts 툴팁 (7개 파일) | 차트 컴포넌트들 | P1 |
| `mergeBySecuirty` 오타 | `PortfolioDashboard.tsx` | P2 |
| `IncomeDashboard` 778줄 — 분할 필요 | `IncomeDashboard.tsx` | P1 |
| `SecuritiesManager` 895줄 — 분할 필요 | `SecuritiesManager.tsx` | P1 |
| API insert 트랜잭션 부재 | `app/api/insert/route.ts` | P1 |
| `formatWon` 중복 정의 (4곳) | 포트폴리오 컴포넌트들 | P2 |
