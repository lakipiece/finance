// lib/palettes.ts — F · 오션 & 피치 고정 팔레트 (2026-09 재정비, 테마 선택 없음)
// 기준색 네이비 + 흰 배경에서 조화를 우선해 고른 10색. 구분성(CVD)보다 톤 통일이 목표다.
// 밝은 색이 많아 흰 글자를 올리지 않는다 — 글자는 잉크, 색은 점·면에만.
export interface Palette {
  id: string
  name: string
  colors: [string, string, string, string]  // [고정비, 대출상환, 변동비, 여행공연비]
  headerGradient: string
}

/** F 팔레트 — 이름으로 참조할 때 */
export const F = {
  navy:      '#1A237E', // 기준
  ocean:     '#3A9AB2',
  rose:      '#C99BB5',
  pistachio: '#A9CFA6',
  denim:     '#6C8EBF',
  cream:     '#F2C57C',
  slate:     '#4B6584',
  peach:     '#F4A582',
  aqua:      '#8FBCD4',
  salmon:    '#E2786B',
} as const

export const DEFAULT_PALETTE: Palette = {
  id: 'ocean-peach',
  name: 'Ocean & Peach',
  // 가계부 카테고리 색상: [고정비, 대출상환, 변동비, 여행공연비]
  colors: [F.navy, F.slate, F.ocean, F.rose],
  headerGradient: F.navy,
}

export const PALETTES: Palette[] = [DEFAULT_PALETTE]

// 포트폴리오 계좌 시리즈 색
export const SERIES_COLORS: string[] = [F.navy, F.ocean, F.rose, F.pistachio, F.denim, F.cream]
export const CASH_COLOR = '#a8b3c4'

// ─── 차트 시리즈 10색 ───────────────────────────────────────────────────────
// 여러 계열이 한 화면에 겹치는 차트 전용. 1번은 사이트 기준색 네이비,
// 이어서 오션·로즈가 한 톤으로 묶이고 웜톤(크림·피치·살몬)은 뒤쪽에 둔다.
// 비슷한 색(오션↔아쿠아, 로즈↔피치)은 서로 떨어뜨렸다.
export const CHART_SERIES: string[] = [
  F.navy, F.ocean, F.rose, F.pistachio, F.denim,
  F.cream, F.slate, F.peach, F.aqua, F.salmon,
]

/** 흰색 쪽으로 t(0~1)만큼 섞는다 */
function lighten(hex: string, t: number): string {
  const h = hex.replace('#', '')
  const mix = (v: number) => Math.round(v + (255 - v) * t)
  const r = mix(parseInt(h.slice(0, 2), 16))
  const g = mix(parseInt(h.slice(2, 4), 16))
  const b = mix(parseInt(h.slice(4, 6), 16))
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** a에서 b 쪽으로 t(0~1)만큼 섞는다 */
function mix(a: string, b: string, t: number): string {
  const pa = a.replace('#', ''), pb = b.replace('#', '')
  const ch = (i: number) => {
    const x = parseInt(pa.slice(i, i + 2), 16), y = parseInt(pb.slice(i, i + 2), 16)
    return Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  }
  return `#${ch(0)}${ch(2)}${ch(4)}`.toUpperCase()
}

/** 검정 쪽으로 t(0~1)만큼 섞는다 */
function deepen(hex: string, t: number): string {
  return mix(hex, '#000000', t)
}

/** hex에 알파를 붙인 rgba */
function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`
}

/**
 * 시리즈 색 — 10색을 돌고, 한 바퀴를 넘기면 밝기를 한 단 올려 다시 돈다.
 * 색은 항목의 고정 순번을 따라야 한다(표시 순위가 아니라). 필터로 계열 수가
 * 바뀔 때 남은 계열의 색이 바뀌면 같은 항목을 다른 것으로 읽게 된다.
 */
export function chartSeriesColor(i: number): string {
  const n = CHART_SERIES.length
  const idx = ((i % n) + n) % n
  const cycle = Math.max(0, Math.floor(i / n))
  const base = CHART_SERIES[idx]
  return cycle === 0 ? base : lighten(base, Math.min(cycle * 0.18, 0.54))
}

// 옵션 항목용 30색 — 1행은 F 기본 순서(자동 배정 순서), 2행 진하게, 3행 연하게
export const OPTION_COLORS: string[] = [
  ...CHART_SERIES,
  ...CHART_SERIES.map(c => deepen(c, 0.28)),
  ...CHART_SERIES.map(c => lighten(c, 0.5)),
]

// ─── 데이터 색 — 컴포넌트에 raw hex를 두지 않도록 이름 붙여 모은다 ────────────
/** 카테고리 색이 지정되지 않았을 때 */
export const FALLBACK_SERIES_COLOR = F.aqua
/** 가계부 수입 카테고리 */
export const INCOME_CATEGORY_COLORS: Record<string, string> = {
  '급여': F.denim,
  '기타': F.pistachio,
}
/** 가계부 입력 — 지출 강조색 (수입은 의미색 income) */
export const EXPENSE_ACCENT = F.navy
/** 네이비 바탕 위 수입 강조 — 입력 화면 요약 카드. 딥 오션은 네이비 위에서 묻혀 한 단 밝게 */
export const INCOME_ON_NAVY = '#9FD3DF'
/** 입출금 — 출금 계열 */
export const OUTFLOW_COLOR = F.slate
/** 사용자 기본색 (members 테이블 로드 전 폴백) */
export const DEFAULT_MEMBER_COLORS: Record<string, string> = { L: F.rose, P: F.denim }
/** 자산 탭 — 유형자산 종류 · 금융자산 */
export const ASSET_TYPE_COLORS: Record<string, string> = { '부동산': F.navy, '자동차': F.cream }
export const ASSET_TYPE_FALLBACK = F.slate
export const FINANCIAL_ASSET_COLOR = F.denim
/** 종목 상세 차트 이동평균선 */
export const MA_COLORS = { ma5: F.peach, ma20: F.rose, ma60: F.aqua } as const
/** 예산 누적 기준선 */
export const BUDGET_BASELINE_COLOR = '#C5CAE9'
/** 에너지 — 따뜻한 두 항목(온수·난방)만 웜톤 */
export const ENERGY_COLORS = { electricity: F.navy, water: F.ocean, hot_water: F.peach, heating: F.salmon } as const

/**
 * 연도 색 — 네이비 한 계열, 기준 연도가 가장 진하고 오래될수록 옅어진다.
 * 연도는 순서가 의미라 계열색을 돌려 쓰지 않는다. 8년 전부터는 가장 옅은 색으로 고정.
 */
export function yearColor(year: number, latestYear: number): string {
  const t = Math.min(Math.max((latestYear - year) / 8, 0), 1) ** 0.85
  return mix(F.navy, '#C5CAE9', t)
}

/**
 * 색 배지 — 항목 색을 연하게 깐 배경 + 같은 색을 잉크 쪽으로 누른 글자.
 * 원색에 흰 글자를 올리면 밝은 톤(로즈 2.4:1)이 묻혀서 이 방식으로 통일한다.
 * 사용자(L·P), 티커 배지 등.
 */
export function tintBadgeStyle(hex: string): { backgroundColor: string; color: string } {
  return { backgroundColor: alpha(hex, 0.22), color: mix(hex, '#0d1c2e', 0.45) }
}
export const memberBadgeStyle = tintBadgeStyle
