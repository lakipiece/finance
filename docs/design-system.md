# Ledger Design System

> 앱 전체의 시각적 일관성과 개발 효율을 위한 디자인 기준 문서.  
> **새 컴포넌트를 만들 때 이 문서와 `lib/styles.ts`를 먼저 확인할 것.**

---

## 0. 빠른 참조 — `lib/styles.ts`

컴포넌트 내부에 Tailwind 클래스를 하드코딩하지 말 것.  
`lib/styles.ts`에서 상수를 import해서 사용한다.

```tsx
import { btn, card, field, badge, modal, text, tbl, skeleton, layout } from '@/lib/styles'

// 버튼
<button className={btn.primary} style={{ backgroundColor: palette.colors[0] }}>추가</button>
<button className={btn.secondary}>취소</button>
<button className={btn.icon} title="수정"><EditIcon /></button>
<button className={btn.danger} title="삭제"><TrashIcon /></button>
<button className={btn.pill(isActive)} style={isActive ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] } : undefined}>전체</button>

// 카드
<div className={`${card.base} p-4 sm:p-6`}>메인 카드</div>
<div className={`${card.inner} p-4`}>서브 카드</div>
<div className={`${card.interactive} p-4`} onClick={...}>클릭 카드</div>

// 폼
<label className={field.label}>계좌명</label>
<input className={field.input} />
<select className={field.select}>...</select>
<textarea className={field.textarea} rows={3} />
<input className={field.search} placeholder="검색..." />

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

// 레이아웃
<div className={layout.page}>
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
| 수익 (+) | `text-rose-500` | 수익, 평가이익 (한국 관례: 상승=빨강) |
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
```

**이동평균선 전용 고정색 (예외)**
- MA5: `#fb923c` (orange-400)
- MA20: `#a78bfa` (violet-400)
- MA60: `#38bdf8` (sky-400)

---

## 2. 타이포그래피

### 텍스트 크기 규칙

| 크기 | Tailwind | 용도 |
|------|----------|------|
| 페이지 제목 | `text-xl font-bold` | H1 |
| 섹션 제목 | `text-sm font-semibold` | 카드 내 H3 |
| 카드 제목 | `text-xs font-semibold` | 소형 카드 제목 |
| 레이블 | `text-xs font-medium uppercase tracking-wider` | KPI 레이블 |
| 본문 | `text-xs` | 테이블 셀, 설명 |
| 보조 | `text-[10px]` | 배지, 메타 태그 |

> `text-[8px]`, `text-[9px]`, `text-[11px]` **사용 금지**.  
> `text-xs` (12px) 또는 `text-[10px]`만 허용.

### 금액 표시

```tsx
import { formatWonRound, formatWonCompact } from '@/lib/utils'

formatWonRound(n)   // "1,234,567원" — 테이블, 정밀 표시
formatWonCompact(n) // "123만", "1.2억" — KPI 카드, 차트
```

항상 `tabular-nums` 클래스 추가.

---

## 3. 간격 (Spacing)

```tsx
// 페이지 레이아웃
<div className={layout.page}>  {/* max-w-7xl mx-auto px-4 py-8 space-y-6 */}
```

| 상황 | 추가 클래스 |
|------|------------|
| 기본 카드 | `p-4 sm:p-6` |
| KPI 카드 | `p-4 sm:p-5` |
| 컴팩트 서브카드 | `p-3` |
| 기본 버튼 | `px-4 py-1.5` (btn.primary/secondary에 내장) |

---

## 4. 컴포넌트 패턴

### 버튼

```tsx
import { btn } from '@/lib/styles'

<button className={btn.primary} style={{ backgroundColor: palette.colors[0] }}>추가</button>
<button className={btn.secondary}>취소</button>
<button className={btn.ghost}>더보기</button>
<button className={btn.icon} title="수정"><PencilIcon /></button>
<button className={btn.danger} title="삭제"><TrashIcon /></button>
<button
  className={btn.pill(isActive)}
  style={isActive ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] } : undefined}
>전체</button>
```

### 카드

```tsx
import { card } from '@/lib/styles'

<div className={`${card.base} p-4 sm:p-6`}>       {/* 최상위, shadow 있음 */}
<div className={`${card.inner} p-4`}>              {/* 서브카드, shadow 없음 */}
<div className={`${card.interactive} p-4`} onClick={...}>  {/* 클릭 가능 */}
<div className={`${card.sub} p-3`}>               {/* 배경 구분 영역 */}
```

> `rounded-xl`과 `rounded-2xl` 혼용 금지. **카드는 항상 `rounded-2xl`** (상수에 내장됨).

### 폼

```tsx
import { field } from '@/lib/styles'

<div>
  <label className={field.label}>계좌명</label>
  <input className={field.input} />
</div>

<select className={field.select}>...</select>
<textarea className={field.textarea} rows={3} />

{/* 검색 인풋 */}
<div className="relative">
  <input className={field.search} placeholder="검색..." />
  <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
</div>

{/* 파일 드래그존 */}
<div className={field.dropzone} onClick={...}>...</div>
```

### 배지

```tsx
import { badge } from '@/lib/styles'

<span className={`${badge.base} bg-slate-100 text-slate-700`}>{value}</span>
<span className={`${badge.base} ${CAT_BADGE[cat]}`}>{cat}</span>
<span className={badge.ticker} style={{ backgroundColor: hex+'20', color: hex }}>SCHD</span>
<span className={badge.owner}>L</span>
<span className={badge.latest}>최신</span>
<span className={badge.success}>Sheets</span>
<span className={badge.info}>Excel</span>
```

### 모달

```tsx
import { btn, modal } from '@/lib/styles'

{show && (
  <div className={modal.overlay} onClick={onClose}>
    <div className={modal.container} onClick={e => e.stopPropagation()}>
      <div className={modal.header}>
        <h2 className="text-sm font-semibold text-slate-700">제목</h2>
        <button className={modal.close} onClick={onClose}>
          <XIcon className="w-5 h-5" />
        </button>
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

> `createPortal` 사용 시: `modal.overlayTop` (z-[9999]) 사용.  
> 일반 모달: `modal.overlay` (z-50).

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
{/* 테이블 행 내 */}
<tr><td colSpan={n} className="py-10 text-center text-slate-400 text-xs">내역이 없습니다</td></tr>

{/* 카드 내 */}
<p className="text-center text-slate-400 text-xs py-8">내역이 없습니다</p>

{/* 페이지 전체 */}
<div className="text-center py-16">
  <p className="text-4xl mb-4">📭</p>
  <p className="text-sm font-semibold text-slate-700 mb-1">데이터가 없습니다</p>
  <p className="text-xs text-slate-400">설명 텍스트</p>
</div>
```

### 로딩 상태

```tsx
import { skeleton } from '@/lib/styles'

<div className={skeleton.line} />   {/* 한 줄 */}
<div className={skeleton.card} />   {/* 카드 */}
<div className={skeleton.chart} />  {/* 차트 */}

{/* 버튼 로딩 */}
<button disabled className={btn.primary} style={{ backgroundColor: palette.colors[0] }}>
  {loading ? '처리 중...' : '확인'}
</button>
```

---

## 5. 반응형 규칙

### 브레이크포인트

| 구분 | Tailwind | px |
|------|----------|----|
| 모바일 | — | < 640px |
| 태블릿 | `sm:` | 640px+ |
| 소형 데스크탑 | `md:` | 768px+ |
| 데스크탑 | `lg:` | 1024px+ |

### 그리드 패턴

```tsx
grid-cols-2 md:grid-cols-3 lg:grid-cols-5   // KPI 카드
grid-cols-2 sm:grid-cols-3 lg:grid-cols-6   // 계좌 카드
grid-cols-1 sm:grid-cols-2                  // 2컬럼
grid-cols-1 sm:grid-cols-3                  // 3컬럼
```

### 테이블 → 카드 분기

데이터 테이블은 모바일 카드 뷰를 반드시 함께 제공한다.

```tsx
{/* 모바일 */}
<div className="sm:hidden space-y-2">
  {items.map(item => (
    <div className="border border-slate-100 rounded-xl px-4 py-3 bg-white">...</div>
  ))}
</div>

{/* 데스크탑 */}
<div className="hidden sm:block overflow-x-auto">
  <table ...>
```

### 모달 높이

```
max-h-[95dvh] sm:max-h-[90vh]  ← modal.container/containerLg에 내장됨
```

---

## 6. z-index 레이어 체계

| 용도 | 값 | 비고 |
|------|-----|------|
| 드롭다운 (인풋 위) | `z-40` | 직접 사용 |
| 일반 모달 | `z-50` | `modal.overlay` |
| 최상위 모달 (portal) | `z-[9999]` | `modal.overlayTop` |

---

## 7. 차트 (Recharts)

```tsx
<XAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
<YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
<CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
```

차트 색상은 항상 `palette.colors[i]`에서 가져온다.

### 커스텀 툴팁

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
- 모바일 터치 타깃 최소 44×44px

---

## 9. 파일/컴포넌트 구조 규칙

### 컴포넌트 크기 한도

| 규모 | 줄 수 | 조치 |
|------|-------|------|
| 적정 | ~200 | 유지 |
| 검토 | ~400 | 분할 고려 |
| 분할 필요 | 400+ | 서브컴포넌트 추출 |

### 네이밍 컨벤션

- 페이지 전용: `*Client.tsx`
- 공유 UI: `components/` 루트
- 포트폴리오 전용: `components/portfolio/`
- 가계부 전용: `components/` 루트

### 유틸 위치

| 함수/상수 | 위치 |
|-----------|------|
| 클래스 상수 | `lib/styles.ts` ← **여기서 import** |
| 금액 포맷 | `lib/utils.ts` |
| 차트 타입 | `lib/chartTypes.ts` |
| 배당 유틸 | `lib/portfolio/dividendUtils.ts` |
| 포트폴리오 타입 | `lib/portfolio/types.ts` |

> 컴포넌트 내부에 `const inp = '...'` 형태로 클래스를 정의하지 말 것.

---

## 10. 알려진 기술 부채

| 항목 | 파일 | 우선순위 |
|------|------|----------|
| 컴포넌트 내 인라인 클래스 상수 | 다수 파일 | P2 (styles.ts 도입으로 점진 해결 중) |
| `SecuritiesManager` 분할 고려 | `SecuritiesManager.tsx` (~895줄) | P3 |
