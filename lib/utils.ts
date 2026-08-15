import type { CSSProperties } from 'react'

export function formatWon(n: number): string {
  if (n >= 100000000) {
    return `${(n / 100000000).toFixed(1)}억원`
  }
  if (n >= 10000) {
    return `${Math.floor(n / 10000).toLocaleString()}만원`
  }
  return `${n.toLocaleString()}원`
}

export function formatWonFull(n: number): string {
  return `${n.toLocaleString()}원`
}

/** 반올림 후 원 단위 표시 (포트폴리오 금액 등) */
export function formatWonRound(n: number): string {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

/** 억/만 단위 축약 (숫자만, 원 접미사 없음) */
export function formatWonCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}억`
  if (abs >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

// 카테고리 색 — DEFAULT_PALETTE.colors와 동일한 단일 소스.
// 이 색은 "점"으로만 쓴다. 글자색으로 쓰지 않는다 (D-01b).
export const CAT_COLORS: Record<string, string> = {
  '고정비': '#1A237E',
  '대출상환': '#690043',
  '변동비': '#26A69A',
  '여행공연비': '#8D6E63',
}

/** 카테고리 점 색 — 미등록 카테고리는 중립 잉크 */
export function catColor(cat: string): string {
  return CAT_COLORS[cat] ?? INCOME_COLORS[cat] ?? '#a8b3c4'
}

export const CATEGORIES = ['고정비', '대출상환', '변동비', '여행공연비'] as const
export type Category = typeof CATEGORIES[number]

export const INCOME_CATEGORIES = ['급여', '기타'] as const
export type IncomeCategory = typeof INCOME_CATEGORIES[number]

export const INCOME_COLORS: Record<string, string> = {
  '급여': '#4527A0',
  '기타': '#5A6476',
}

/**
 * 배지 스타일 — D-01b: 카테고리색을 글자색으로 쓰지 않는다.
 * 배경은 surface-low, 글자는 잉크 고정. 의미는 앞의 점(6px)이 전달한다.
 * 점은 `catColor(cat)`으로 별도 렌더링할 것 — `<CategoryBadge>` 사용 권장.
 */
export function catBadgeStyle(_cat: string): CSSProperties {
  return { backgroundColor: '#f1f3f7', color: '#3d4a5c' }
}
