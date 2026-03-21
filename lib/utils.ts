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

export const CAT_COLORS: Record<string, string> = {
  '고정비': '#6B8CAE',
  '대출상환': '#C47D7D',
  '변동비': '#6DAE8C',
  '여행공연비': '#C4A96D',
}

export const CAT_BADGE: Record<string, string> = {
  '고정비': 'bg-blue-100 text-blue-700',
  '대출상환': 'bg-rose-100 text-rose-700',
  '변동비': 'bg-green-100 text-green-700',
  '여행공연비': 'bg-amber-100 text-amber-700',
}

export const CATEGORIES = ['고정비', '대출상환', '변동비', '여행공연비'] as const
export type Category = typeof CATEGORIES[number]
