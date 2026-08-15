// lib/styles.ts
// 앱 전체 공유 Tailwind 클래스 상수 — 시안 D 디자인 시스템.
//
// 원칙
//  1. 테두리를 쓰지 않는다. 구분은 배경 톤 이동 또는 그림자로 만든다.
//     유일한 예외는 표의 행 구분선(#f1f3f7)이며, 이는 "행 사이 톤 변화"로 취급한다.
//  2. 굵기는 400·500·700 세 단만 쓴다. 600은 폐기.
//  3. 크기는 display/title/heading/subhead/body/meta/micro 7단만 쓴다. 9px 이하 금지.
//  4. 카테고리색은 점으로만 쓴다. 글자색으로 쓰지 않는다.
//  5. 표·리스트만 조인다. 입력 화면에는 밀도 압축을 적용하지 않는다.

// ─── 버튼 ──────────────────────────────────────────────────────────────────
export const btn = {
  // 주 액션 — 잉크 배경 고정 (테마색 지정 불필요)
  primary:
    'px-[13px] py-1.5 rounded-btn text-body font-bold text-white bg-action ' +
    'hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap',
  // 보조 액션 — surface-high 배경. 실제 액션에만 쓴다(기간 선택 등 탐색에는 금지)
  secondary:
    'px-[15px] py-2 rounded-btn text-body font-medium bg-surface-high text-ink-2 ' +
    'hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap',
  // 고스트 — 배경 없음
  ghost:
    'px-3 py-1.5 rounded-btn text-body text-ink-3 ' +
    'hover:bg-surface-low transition-colors',
  // 텍스트 + 셰브론 — 기간 선택기 등 탐색 전용. 배경 없음
  chevron:
    'inline-flex items-center gap-[5px] px-1 py-1.5 text-subhead font-bold text-ink ' +
    'hover:opacity-70 transition-opacity whitespace-nowrap',
  // 아이콘 버튼
  icon:
    'p-1.5 rounded-btn text-ink-5 hover:text-ink-2 ' +
    'hover:bg-surface-low transition-colors',
  // 위험 아이콘 버튼 — 삭제 등
  danger:
    'p-1.5 rounded-btn text-ink-5 hover:text-gain ' +
    'hover:bg-surface-low transition-colors',
  // 토글 pill — 분류 선택 등. 선택 시 잉크 배경, 점은 그대로 유지
  pill: (active: boolean) =>
    `inline-flex items-center justify-center gap-[5px] leading-none px-[11px] py-1.5 rounded-full transition-colors ${
      active
        ? 'bg-action text-white text-meta font-bold'
        : 'bg-surface-low text-ink-2 text-meta font-medium hover:opacity-80'
    }`,
  // 세그먼트 컨트롤 한 칸 — 양 끝만 라운딩은 호출 측에서 first/last로 처리
  segment: (active: boolean) =>
    `flex-1 text-center py-2 whitespace-nowrap transition-colors ${
      active
        ? 'bg-action text-white text-body font-bold'
        : 'bg-surface-low text-ink-3 text-body font-medium'
    }`,
} as const

// ─── 카드 ──────────────────────────────────────────────────────────────────
// 테두리 없음. 흰 배경 + 확산 그림자로만 부상시킨다.
export const card = {
  // 기본 카드 — 페이지 주요 섹션
  base: 'bg-surface-card rounded-card shadow-card',
  // 내부 서브카드 — 카드 안의 카드 (그림자 없음)
  inner: 'bg-surface-card rounded-card',
  // 호버 효과 카드 — 클릭 가능
  interactive:
    'bg-surface-card rounded-card shadow-card hover:-translate-y-0.5 transition-transform cursor-pointer',
  // 배경 서브 영역 — 카드 내 구분 존
  sub: 'bg-surface-container rounded-card',
  // 카드 내부 패딩
  padTable: 'p-[13px]',       // 표 카드
  padKpi: 'px-[13px] py-[11px]', // KPI 카드
  padForm: 'p-[14px]',        // 폼 카드
} as const

// ─── 폼 ───────────────────────────────────────────────────────────────────
// D-02: 밑줄형 → 채움형 일괄 전환. 27개 화면 동시 적용, 과도기 두 벌 상태 금지.
// 5상태: 기본 / 포커스(흰 배경 + 잉크 링) / 오류 / 비활성 / 플레이스홀더
const FIELD_BASE =
  'rounded-field bg-surface-low px-3 py-[9px] text-subhead font-normal text-ink border-0 ' +
  'placeholder:text-ink-5 transition-colors ' +
  'focus:outline-none focus:bg-white focus:shadow-focus ' +
  'disabled:bg-surface disabled:text-ink-5'

export const field = {
  // 텍스트 인풋 — w-full
  input: `w-full ${FIELD_BASE}`,
  // 셀렉트 — 셰브론은 호출 측에서 겹쳐 놓거나 appearance-none 유지
  select: `w-full appearance-none ${FIELD_BASE}`,
  // 고정 너비 없는 인풋 (호출 측에서 w-* 지정)
  inputFit: FIELD_BASE,
  // 검색 인풋 — 아이콘 자리 확보
  search: `w-full rounded-field bg-surface-low pl-9 pr-3 py-[9px] text-subhead text-ink border-0
    placeholder:text-ink-5 focus:outline-none focus:bg-white focus:shadow-focus transition-colors`,
  // 텍스트에어리어
  textarea: `w-full ${FIELD_BASE} resize-none`,
  // 인라인 입력 행 내부 필드 — 흰 배경 · 7px · 더 조인 패딩
  cell:
    'rounded-cell bg-white px-2 py-1.5 text-body font-normal text-ink border-0 ' +
    'placeholder:text-ink-5 focus:outline-none focus:shadow-focus transition-colors',
  // 오류 상태 — 기본/셀에 덧붙인다
  error: 'bg-gain/[.07] text-gain shadow-error focus:bg-gain/[.07] focus:shadow-error',
  // 오류 메시지
  errorMsg: 'mt-1 text-micro tracking-normal font-normal text-gain',
  // 폼 라벨
  label: 'block text-meta font-medium text-ink-3 mb-1',
  labelSm: 'block text-meta font-medium text-ink-4 mb-0.5',
  // 폼 필드 간격 — 입력 화면은 밀도 압축 예외 구역
  gap: 'grid gap-[14px]',
  // 드래그존 — 테두리 대신 배경 존으로
  dropzone:
    'bg-surface-low rounded-field p-6 text-center cursor-pointer ' +
    'hover:bg-surface-container transition-colors',
} as const

// ─── 배지 ──────────────────────────────────────────────────────────────────
// D-01b: 점(6px) + 잉크 텍스트. 카테고리색을 글자색으로 쓰지 않는다.
export const badge = {
  // 기본 배지 — 점과 함께 쓴다 (<CategoryBadge> 권장)
  base: 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-micro uppercase bg-surface-low text-ink-2',
  // 소형 배지
  sm: 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-micro tracking-normal bg-surface-low text-ink-2',
  // 6px 점
  dot: 'inline-block w-1.5 h-1.5 rounded-full shrink-0',
  // 티커 배지 — 고정폭
  ticker: 'inline-block px-1.5 py-0.5 rounded-full text-micro tracking-normal font-bold font-mono bg-surface-low text-ink-2',
  // 사용자(owner) 배지
  owner: 'inline-block px-1.5 py-0.5 rounded-full text-micro tracking-normal font-bold bg-surface-low text-ink-2',
  // 최신 배지
  latest: 'inline-block px-1.5 py-0.5 rounded-full text-micro tracking-normal bg-surface-low text-ink-3',
  // 경고 배지 — 예산 초과 · 임박
  warning: 'inline-block px-1.5 py-0.5 rounded-full text-micro tracking-normal bg-warning/10 text-warning',
  // 성공 · 정보 · 중립 — 전부 중성 표면 + 잉크. 색은 의미가 있을 때만 쓴다
  success: 'inline-block px-1.5 py-0.5 rounded-full text-micro tracking-normal bg-income/10 text-income',
  info: 'inline-block px-1.5 py-0.5 rounded-full text-micro tracking-normal bg-surface-low text-ink-3',
  neutral: 'inline-block px-1.5 py-0.5 rounded-full text-micro tracking-normal bg-surface-low text-ink-4',
} as const

// ─── 모달 ──────────────────────────────────────────────────────────────────
// D-04: 오버레이는 #0d1c2e/30 + blur(6px)로 통일. z-index 차이만 유지.
// blur 미지원 시 #0d1c2e/42 폴백 — globals.css의 @supports 규칙이 처리한다.
export const modal = {
  overlay:
    'modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain',
  overlayTop:
    'modal-scrim fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto overscroll-contain',
  container:
    'bg-surface-card rounded-dialog shadow-dialog w-full max-w-md flex flex-col ' +
    'max-h-[calc(100dvh-2rem)] overflow-hidden',
  containerLg:
    'bg-surface-card rounded-dialog shadow-dialog w-full max-w-lg flex flex-col ' +
    'max-h-[calc(100dvh-2rem)] overflow-hidden',
  // 헤더 15px 18px — 구분선 없음
  header:
    'flex items-center justify-between px-[18px] py-[15px] shrink-0',
  title: 'text-heading text-ink',
  // 본문 0 18px 16px · gap 14px
  body: 'px-[18px] pb-4 grid gap-[14px] overflow-y-auto flex-1 content-start',
  // 푸터 12px 18px — 바닥색이라 구분선 없이 분리된다
  footer:
    'flex justify-end gap-2 px-[18px] py-3 bg-surface shrink-0',
  close:
    'text-ink-5 hover:text-ink-2 p-1 rounded-btn hover:bg-surface-low ' +
    'transition-colors shrink-0',
} as const

// ─── 브랜드 색상 ────────────────────────────────────────────────────────────
export const brand = {
  primary: '#131b2e',   // action — 주 버튼 · 선택 상태 · 포커스 링
  navy: '#1A237E',      // 카테고리/시리즈 1번 색
  accent: '#00695C',    // income — 수입 · 입금
} as const

// 의미색 리터럴 — SVG·Recharts 등 클래스를 못 쓰는 곳에서 참조
export const color = {
  surface: '#fafafb',
  surfaceLow: '#f1f3f7',
  surfaceContainer: '#e9ecf2',
  surfaceHigh: '#e0e4ec',
  ink: '#0d1c2e',
  ink2: '#3d4a5c',
  ink3: '#5b6a80',
  ink4: '#8794a8',
  ink5: '#a8b3c4',
  income: '#00695C',
  warning: '#b45309',
  action: '#131b2e',
  gain: '#e11d48',
  loss: '#2563eb',
} as const

// ─── 텍스트 계층 ────────────────────────────────────────────────────────────
export const text = {
  pageTitle:    'text-title text-ink',
  sectionTitle: 'text-heading text-ink',
  cardTitle:    'text-subhead font-medium text-ink',
  label:        'text-micro uppercase text-ink-4',
  body:         'text-body text-ink-2',
  caption:      'text-micro text-ink-4 normal-case tracking-normal',
  muted:        'text-body text-ink-5',
  // 금액 — 크기는 별도 지정
  amount:       'font-bold tabular-nums text-ink',
  amountSm:     'font-medium tabular-nums text-ink-2',
  // 가계부 금액 색 (D-01) — 수입만 틸, 지출은 무채색
  income:       'font-bold tabular-nums text-income',
  expense:      'font-normal tabular-nums text-ink',
  // 포트폴리오 손익 2색 — 가계부에 쓰지 않는다
  positive:     'text-gain',
  negative:     'text-loss',
} as const

// ─── 테이블 ─────────────────────────────────────────────────────────────────
// C안 밀도: 행 패딩 5px 0. 행 구분선은 톤 변화이므로 유일하게 허용되는 선.
export const tbl = {
  th:      'text-left py-[5px] px-2 text-micro uppercase text-ink-5',
  thRight: 'text-right py-[5px] px-2 text-micro uppercase text-ink-5',
  // Windows는 macOS처럼 획을 두껍게 그리지 않아 400이 얇게 보인다.
  // 데이터가 빽빽한 표 본문만 500으로 올려 가독성을 맞춘다 (라벨·캡션은 그대로).
  td:      'py-[5px] px-2 text-body font-medium text-ink-2',
  tdRight: 'py-[5px] px-2 text-body font-medium text-ink text-right tabular-nums',
  // 행 — 줄무늬 없음. 구분선만
  row:     'border-b border-surface-low last:border-0 hover:bg-surface-low/60 transition-colors',
  // 하위 호환 (줄무늬 폐기 — 둘 다 동일)
  rowEven: 'border-b border-surface-low last:border-0 hover:bg-surface-low/60 transition-colors',
  rowOdd:  'border-b border-surface-low last:border-0 hover:bg-surface-low/60 transition-colors',
} as const

// ─── 로딩 ───────────────────────────────────────────────────────────────────
export const skeleton = {
  line:  'h-4 bg-surface-low rounded animate-pulse',
  card:  'h-24 bg-surface-low rounded-card animate-pulse',
  chart: 'h-[200px] bg-surface-low rounded-card animate-pulse',
} as const

// ─── 레이아웃 ────────────────────────────────────────────────────────────────
export const layout = {
  page:    'max-w-7xl mx-auto px-4 py-8 space-y-6',
  section: 'space-y-4',
  // 대시보드 외곽 컨테이너 — 바닥색 · 18px · 16px 패딩
  container: 'bg-surface rounded-dialog p-4',
  // 카드 간 gap
  grid: 'grid gap-2',
} as const

// ─── 표면 계층 ──────────────────────────────────────────────────────────────
export const surface = {
  foundation: 'bg-surface',
  canvas: 'bg-surface-low',
  card: 'bg-surface-card rounded-card',
  cardElevated: 'bg-surface-card rounded-card shadow-card',
  zone: 'bg-surface-container rounded-card',
} as const

// 글래스 — 오버레이는 modal.overlay와 같은 값을 쓴다 (D-04)
export const glass = {
  panel: 'bg-surface-card shadow-card rounded-card',
  overlay: 'modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain',
} as const

// ─── 폰트 스케일 ────────────────────────────────────────────────────────────
export const font = {
  display:  'text-display tabular-nums',
  headline: 'text-title',
  title:    'text-heading text-ink',
  body:     'text-body text-ink-2',
  meta:     'text-meta text-ink-3',
} as const

// 주요 CTA — 그라디언트 폐기. 단색 잉크 배경
export const cta = {
  primary:
    'px-[17px] py-2 rounded-btn text-body font-bold text-white bg-action ' +
    'hover:opacity-90 disabled:opacity-50 transition-opacity',
  secondary:
    'px-[15px] py-2 rounded-btn text-body font-medium bg-surface-high text-ink-2 ' +
    'hover:opacity-90 disabled:opacity-50 transition-opacity',
} as const

// 상태 배지 — 손익 2색은 포트폴리오 전용, 가계부에서는 warning/income만 쓴다
export const statusBadge = {
  success:  'px-2 py-0.5 rounded-full text-micro tracking-normal bg-income/10 text-income',
  warning:  'px-2 py-0.5 rounded-full text-micro tracking-normal bg-warning/10 text-warning',
  danger:   'px-2 py-0.5 rounded-full text-micro tracking-normal bg-gain/10 text-gain',
  info:     'px-2 py-0.5 rounded-full text-micro tracking-normal bg-surface-low text-ink-3',
  neutral:  'px-2 py-0.5 rounded-full text-micro tracking-normal bg-surface-low text-ink-4',
} as const
