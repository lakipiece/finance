'use client'

// 타입·필터·숫자 포맷·차트 라벨 렌더러·분해 버킷팅 (SnapshotCharts.tsx에서 분리)
import { color as tone } from '@/lib/styles'
import type { SnapshotViewMode } from '../SnapshotList'
import type { AccountSnapshotEntry } from '@/lib/portfolio/metrics'

export interface SnapshotPoint {
  date: string
  total_market_value: number
  total_invested: number
  sector_breakdown: Record<string, number>
  asset_class_breakdown: Record<string, number>
  tag_breakdown: Record<string, number>
  account_breakdown?: Record<string, AccountSnapshotEntry>
}

/** 월별 최초/최종/전체 필터 (points는 date ASC) */
export function filterByView(points: SnapshotPoint[], view: SnapshotViewMode): SnapshotPoint[] {
  if (view === 'all') return points
  const byMonth = new Map<string, SnapshotPoint[]>()
  for (const p of points) {
    const ym = p.date.slice(0, 7)
    if (!byMonth.has(ym)) byMonth.set(ym, [])
    byMonth.get(ym)!.push(p)
  }
  return [...byMonth.values()].map(items =>
    view === 'first' ? items[0] : items[items.length - 1]
  )
}

export const POS = tone.gainSoft  // 한국식 — 상승 (차트 면은 한 톤 누른 색, 글자는 tone.gain)
export const NEG = tone.lossSoft  // 한국식 — 하락

/**
 * 값 라벨이 축 눈금과 겹치지 않게 위아래로 여백을 준다.
 * 0을 넘겨 잡으면 막대가 축 밖으로 나가므로 0은 항상 범위 안에 둔다.
 */
export const LABEL_HEADROOM: [(min: number) => number, (max: number) => number] = [
  (min: number) => Math.min(0, min * 1.18),
  (max: number) => Math.max(0, max * 1.12),
]

/** 차트 위 금액 — 백만원 자리까지 보이도록 단위별로 소수점을 남긴다 */
export function fmtY(v: number) {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(2)}억`
  if (abs >= 10_000_000) return `${sign}${(abs / 10_000_000).toFixed(1)}천만`
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000)}만`
  return `${sign}${Math.round(abs)}`
}
export function fmtKrw(v: number) {
  return `${Math.round(v).toLocaleString('ko-KR')}원`
}
/**
 * 퍼센트 표기 자릿수 — 유효숫자 3자리로 맞춘다.
 * 정수부가 1자리면 소수 2자리(3.45%), 2자리면 1자리(12.3%), 3자리면 정수(100%).
 * 비중이 작을수록 소수점이 살아나 0.5%p 차이가 뭉개지지 않는다.
 */
export function pctDigits(v: number) {
  const abs = Math.abs(v)
  return abs >= 100 ? 0 : abs >= 10 ? 1 : 2
}
/**
 * 끝자리 0은 지운다. 비중은 0.1%까지만 저장돼 있어 2자리로 늘리면
 * 항상 0으로 끝나는 가짜 정밀도가 된다 (3.10% 같은 표기).
 */
export function trimZeros(s: string) {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}
export function fmtPctSigned(v: number) {
  return `${v >= 0 ? '+' : ''}${trimZeros(v.toFixed(pctDigits(v)))}%`
}
export function fmtPct(v: number) {
  return `${trimZeros(v.toFixed(pctDigits(v)))}%`
}

/**
 * 차트에 값 라벨을 붙일 인덱스.
 * 열이 넉넉하면 전부, 좁으면 겹치지 않는 선에서 최근 → 최고 → 최저 순으로 고른다.
 */
export function labelIndices(values: number[], allUpTo = 10): number[] {
  const n = values.length
  if (n === 0) return []
  if (n <= allUpTo) return values.map((_, i) => i)
  const gap = Math.ceil(n / allUpTo)
  let maxI = 0
  let minI = 0
  values.forEach((v, i) => {
    if (v > values[maxI]) maxI = i
    if (v < values[minI]) minI = i
  })
  const picked: number[] = []
  for (const i of [n - 1, maxI, minI]) {
    if (picked.some(p => Math.abs(p - i) < gap)) continue
    picked.push(i)
  }
  return picked
}

export interface LabelRenderProps {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: number | string
  index?: number
}

/** 점(라인) 값 라벨 — 양수는 점 위, 음수는 점 아래. picked 인덱스만 그린다 */
export function pointLabel(picked: Set<number>, lastIndex: number, fill: string) {
  return function renderPointLabel(props: LabelRenderProps) {
    const { x, y, index, value } = props
    if (index == null || !picked.has(index)) return null
    const v = Number(value)
    if (!Number.isFinite(v)) return null
    const anchor = index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle'
    const ty = v < 0 ? Number(y) + 14 : Number(y) - 8
    return (
      <text x={Number(x)} y={ty} textAnchor={anchor} fontSize={10} fill={fill} fontWeight={500}>
        {fmtY(v)}
      </text>
    )
  }
}

/** 배경색 위에 올릴 글자색 — 밝은 조각에는 잉크, 어두운 조각에는 흰색 */
export function textOn(bg: string): string {
  const hex = bg.replace('#', '')
  if (hex.length !== 6) return tone.white
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  if ([r, g, b].some(n => Number.isNaN(n))) return tone.white
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? tone.ink : tone.white
}

/**
 * 막대 바깥 값 라벨 — 양수는 막대 위, 음수는 막대 아래.
 * Recharts는 음수 막대에 음수 height를 주고 y를 아래 끝에 놓는다.
 * 부호를 가정하지 말고 두 끝을 정렬해서 위/아래를 잡는다.
 */
export function barTopLabel(picked: Set<number>, fill: string) {
  return function renderBarTopLabel(props: LabelRenderProps) {
    const { x, y, width, height, index, value } = props
    if (index == null || !picked.has(index)) return null
    const raw = Number(value)
    if (!Number.isFinite(raw) || raw === 0) return null
    const w = Number(width)
    const y0 = Number(y)
    const y1 = y0 + Number(height)
    const ty = raw < 0 ? Math.max(y0, y1) + 12 : Math.min(y0, y1) - 6
    return (
      <text x={Number(x) + w / 2} y={ty} textAnchor="middle" fontSize={10} fill={fill} fontWeight={500}>
        {fmtY(raw)}
      </text>
    )
  }
}

/** 스택 막대 조각 안쪽 값 라벨 — picked 인덱스 + 충분한 높이일 때만 */
export function segmentLabel(
  picked: Set<number>,
  fmt: (v: number) => string,
  fill: string = tone.white,
  minHeight = 15,
) {
  return function renderSegmentLabel(props: LabelRenderProps) {
    const { x, y, width, height, index, value } = props
    if (index == null || !picked.has(index)) return null
    const h = Math.abs(Number(height))
    const w = Number(width)
    const v = Number(value)
    if (!Number.isFinite(v) || v <= 0 || !(h >= minHeight)) return null
    const top = Math.min(Number(y), Number(y) + Number(height))
    return (
      <text x={Number(x) + w / 2} y={top + h / 2} textAnchor="middle" dominantBaseline="central"
        fontSize={10} fontWeight={700} fill={fill}>
        {fmt(v)}
      </text>
    )
  }
}

export function bucketize(breakdown: Record<string, number>, keys: string[]): Record<string, number> {
  const keep: Record<string, number> = {}
  let others = 0
  for (const k of keys) keep[k] = breakdown[k] ?? 0
  for (const [k, v] of Object.entries(breakdown)) {
    if (!keys.includes(k)) others += v
  }
  if (others > 0) keep['기타'] = (keep['기타'] ?? 0) + Math.round(others * 100) / 100
  return keep
}

export function topKeysByMean(points: SnapshotPoint[], accessor: (p: SnapshotPoint) => Record<string, number>, n: number): string[] {
  const sum: Record<string, number> = {}
  for (const p of points) {
    for (const [k, v] of Object.entries(accessor(p))) sum[k] = (sum[k] ?? 0) + v
  }
  return Object.entries(sum)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
}

export function keysAboveThreshold(points: SnapshotPoint[], accessor: (p: SnapshotPoint) => Record<string, number>, thresholdPct: number): string[] {
  const max: Record<string, number> = {}
  for (const p of points) {
    for (const [k, v] of Object.entries(accessor(p))) {
      if (v > (max[k] ?? 0)) max[k] = v
    }
  }
  return Object.entries(max).filter(([, v]) => v >= thresholdPct).sort((a, b) => b[1] - a[1]).map(([k]) => k)
}
