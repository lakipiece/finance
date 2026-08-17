// lib/palettes.ts — Metric Slate 고정 팔레트 (테마 선택 없음)
export interface Palette {
  id: string
  name: string
  colors: [string, string, string, string]  // [고정비, 대출상환, 변동비, 여행공연비]
  headerGradient: string
}

export const DEFAULT_PALETTE: Palette = {
  id: 'metric-slate',
  name: 'Metric Slate',
  // 가계부 카테고리 색상: [고정비, 대출상환, 변동비, 여행공연비]
  // D-01a: 변동비가 수입색(#00695C)과 겹쳐 #26A69A로 이동
  colors: ['#1A237E', '#690043', '#26A69A', '#8D6E63'],
  headerGradient: 'linear-gradient(135deg, #1A237E 0%, #00695C 100%)',
}

export const PALETTES: Palette[] = [DEFAULT_PALETTE]

// 포트폴리오 계좌 시리즈 색 — 마지막은 예수금 전용
export const SERIES_COLORS: string[] = [
  '#1A237E', '#00695C', '#690043', '#8D6E63', '#3949AB', '#26A69A',
]
export const CASH_COLOR = '#a8b3c4'

// ─── 차트 시리즈 10색 ───────────────────────────────────────────────────────
// 누적 막대처럼 여러 계열이 한 화면에 겹치는 차트 전용. 1번은 사이트 기준색.
// 색맹 시뮬레이션 + 대비 검사를 돌려 인접 쌍이 서로 구분되도록 순서를 잡았다
// (인접 최악 CVD ΔE 9.2 · 정상시야 ΔE 24.6 · 전 색상 흰 배경 대비 3:1 이상).
// 1번 네이비만 기준색이라 명도 밴드보다 어둡다 — 의도한 예외.
export const CHART_SERIES: string[] = [
  '#1A237E', // 네이비 (기준)
  '#C2410C', // 번트오렌지
  '#047857', // 에메랄드
  '#A21CAF', // 퍼플
  '#0891B2', // 시안
  '#9F1239', // 크림슨
  '#6D28D9', // 바이올렛
  '#A16207', // 골드
  '#0369A1', // 스틸블루
  '#65A30D', // 라임올리브
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

// 옵션 항목용 72색 팔레트 — 메인 테마 6색 선두, 이후 색상 계열별 정렬
export const OPTION_COLORS: string[] = [
  // ── 메인 테마 시리즈 (6) — 사이트 기준 컬러 ─────────────
  '#1A237E','#00695C','#390069','#690043','#396900','#006769',
  // ── Deep Blues / Navy (6) ─────────────────────────────
  '#0D1B5E','#283593','#1565C0','#01579B','#0277BD','#0288D1',
  // ── Purples / Indigo (7) ──────────────────────────────
  '#311B92','#4527A0','#512DA8','#4A148C','#6A1B9A','#7B1FA2','#6D28D9',
  // ── Pinks / Magentas (5) ──────────────────────────────
  '#880E4F','#AD1457','#C2185B','#D81B60','#E91E8C',
  // ── Crimsons / Reds (5) ───────────────────────────────
  '#7F1D1D','#B71C1C','#C62828','#D32F2F','#C0392B',
  // ── Orange-Reds (4) ───────────────────────────────────
  '#BF360C','#D84315','#E64A19','#E65100',
  // ── Ambers / Oranges (5) ──────────────────────────────
  '#FF6D00','#F57C00','#FF8F00','#F9A825','#E67E22',
  // ── Browns / Warm Earth (4) ──────────────────────────
  '#5D4037','#6D4C41','#795548','#8D6E63',
  // ── Yellows / Mustards (4) ────────────────────────────
  '#693D00','#7C4A00','#92600A','#C8961A',
  // ── Olives / Yellow-Greens (4) ───────────────────────
  '#33691E','#558B2F','#7C8B12','#827717',
  // ── Greens (5) ────────────────────────────────────────
  '#1B5E20','#2E7D32','#388E3C','#2D6A4F','#43A047',
  // ── Teals / Cyans (3) ─────────────────────────────────
  '#004D40','#00796B','#006064',
  // ── Slates / Blue-Grays (5) ──────────────────────────
  '#1A2940','#37474F','#455A64','#546E7A','#607D8B',
  // ── Grays — 다채롭게 (12) ────────────────────────────
  '#111827','#1F2937','#2D3748','#374151','#3D4558',
  '#424242','#4A5568','#4B5563','#5A6476','#64748B',
  '#718096','#8492A6',
  // ── Browns / Earth (3) ───────────────────────────────
  '#4E342E','#5D4037','#6D4C41',
]
