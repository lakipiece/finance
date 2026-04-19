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

export const CAT_COLORS: Record<string, string> = {
  '고정비': '#6B8CAE',
  '대출상환': '#C47D7D',
  '변동비': '#6DAE8C',
  '여행공연비': '#C4A96D',
}

// 카테고리 배지 — 테마 색상 기준 (DEFAULT_PALETTE.colors 순서와 동일)
export const CAT_BADGE: Record<string, { bg: string; text: string }> = {
  '고정비':   { bg: 'rgba(26,35,126,0.10)',  text: '#1A237E' },
  '대출상환': { bg: 'rgba(105,0,67,0.10)',   text: '#690043' },
  '변동비':   { bg: 'rgba(0,105,92,0.10)',   text: '#00695C' },
  '여행공연비':{ bg: 'rgba(93,64,55,0.10)',  text: '#5D4037' },
}

export const CATEGORIES = ['고정비', '대출상환', '변동비', '여행공연비'] as const
export type Category = typeof CATEGORIES[number]

export function catBadgeStyle(cat: string): CSSProperties {
  const b = CAT_BADGE[cat]
  return b
    ? { backgroundColor: b.bg, color: b.text }
    : { backgroundColor: 'rgba(100,116,139,0.08)', color: '#64748b' }
}
