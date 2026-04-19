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
    'hover:opacity-90 transition-opacity whitespace-nowrap',
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
// 인풋: 박스 테두리 제거, 하단 테두리만 유지 + 포커스 시 테마 색상
export const field = {
  // 텍스트 인풋 — w-full, 하단 테두리만
  input:
    'w-full border-0 border-b border-slate-200 bg-transparent px-0 pb-1.5 pt-1 text-xs text-slate-600 ' +
    'focus:outline-none focus:border-[#1A237E] transition-colors placeholder:text-slate-300',
  // 셀렉트 — 자동 너비, 하단 테두리만
  select:
    'border-0 border-b border-slate-200 bg-transparent px-0 pb-1.5 pt-1 text-xs text-slate-600 ' +
    'focus:outline-none focus:border-[#1A237E] transition-colors appearance-none',
  // 숫자/짧은 인풋 — 고정 너비 없음 (호출 측에서 w-* 지정)
  inputFit:
    'border-0 border-b border-slate-200 bg-transparent px-0 pb-1.5 pt-1 text-xs text-slate-600 ' +
    'focus:outline-none focus:border-[#1A237E] transition-colors',
  // 검색 인풋 — 박스 유지 (독립 검색 UI)
  search:
    'w-full border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-500 ' +
    'placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1A237E]/30 bg-white',
  // 텍스트에어리어 — 박스 유지 (여러 줄)
  textarea:
    'w-full border border-slate-100 rounded-lg px-3 py-2 text-xs text-slate-600 ' +
    'focus:outline-none focus:border-[#1A237E] focus:ring-0 bg-white resize-none transition-colors',
  // 폼 레이블
  label: 'block text-[10px] text-slate-400 mb-1',
  // 컴팩트 레이블
  labelSm: 'block text-[10px] text-slate-500 mb-0.5',
  // 드래그존
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
// z-index 체계: 드롭다운 z-40 / 기본 모달 z-50 / 최상위 모달 z-[9999]
// overlay: bg-black/40 으로 통일
export const modal = {
  // 전체화면 오버레이
  overlay:
    'fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4',
  // 최상위 오버레이 (모달 위의 모달, createPortal 사용 시)
  overlayTop:
    'fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4',
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
  // 짝수행 기본, 홀수행 줄무늬
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

// ─── The Orchestrated Lens — 고급 편집 디자인 토큰 ─────────────────────────
// 경계선 대신 배경 레이어링으로 깊이를 표현한다. 1px 경계선 섹션 분리 금지.

// Surface 계층 — tailwind.config.ts의 surface.* 색상 토큰에 대응
// Foundation(#f8f9ff) → Canvas(#eff4ff) → Card(#fff) 순으로 "부상"
export const surface = {
  // 앱 최상위 배경
  foundation: 'bg-surface',
  // 사이드바, 보조 패널
  canvas: 'bg-surface-low',
  // 주요 카드 — 경계선 없이 배경 대비로 "팝업" 효과
  card: 'bg-surface-card rounded-2xl',
  // 강조 카드 — 그림자로 부상감
  cardElevated: 'bg-surface-card rounded-2xl shadow-[0_4px_32px_0_rgba(13,28,46,0.06)]',
  // 구분 존 (섹션 분리 배경)
  zone: 'bg-surface-container rounded-2xl',
} as const

// 글래스모피즘 — 모달, 플로팅 메뉴 등 포커스 필요 요소
export const glass = {
  // 표준 글래스 패널
  panel:
    'bg-white/70 backdrop-blur-[20px] ' +
    'shadow-[0_4px_32px_0_rgba(13,28,46,0.08)] rounded-2xl',
  // 오버레이 — 모달 배경 (기존 modal.overlay 대체 가능)
  overlay:
    'fixed inset-0 z-50 flex items-center justify-center ' +
    'bg-[#0d1c2e]/30 backdrop-blur-[6px] px-4',
} as const

// 폰트 — Noto Sans KR 고딕 단일 폰트 체계
export const font = {
  // 대형 KPI 숫자
  display: 'text-[2.75rem] font-bold leading-none tracking-tight tabular-nums',
  // 페이지/섹션 타이틀
  headline: 'text-2xl font-semibold',
  // 카드 타이틀
  title: 'text-lg font-semibold text-slate-800',
  // 본문
  body: 'text-sm text-slate-700',
  // 메타
  meta: 'text-[11px] font-medium text-slate-500',
} as const

// 주요 CTA 버튼 — "Machined Metal" 그라디언트
// primary는 기존 btn.primary(테마색)와 병행. 이건 다크 네이비 고정 CTA용.
export const cta = {
  // 다크 네이비 그라디언트 — 135° "machined metal" 효과
  primary:
    'px-4 py-2 rounded-md text-xs font-semibold text-white transition-opacity ' +
    'bg-gradient-to-br from-[#131b2e] to-[#7c839b] hover:opacity-90 disabled:opacity-50',
  // 보조 — surface-container-high 배경, 경계선 없음
  secondary:
    'px-4 py-2 rounded-md text-xs font-semibold transition-colors ' +
    'bg-surface-container-high text-[#131b2e] hover:bg-surface-dim disabled:opacity-50',
} as const

// Intelligence Badge — 상태 표시 반투명 배지 (solid pill 금지)
// 배경: 상태색 10% 불투명도 + 고대비 텍스트
export const statusBadge = {
  success:  'px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700',
  warning:  'px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700',
  danger:   'px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-600',
  info:     'px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/10 text-sky-700',
  neutral:  'px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-600',
} as const
