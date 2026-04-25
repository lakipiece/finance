import type { Dividend } from '@/lib/portfolio/types'

export function toKrw(d: Pick<Dividend, 'amount' | 'currency' | 'exchange_rate'>): number {
  return d.currency === 'KRW'
    ? Number(d.amount)
    : Number(d.amount) * (Number(d.exchange_rate) || 1)
}

export function taxKrw(
  d: Pick<Dividend, 'amount' | 'tax' | 'currency' | 'exchange_rate'> & {
    account?: { dividend_tax_rate?: number | null }
  }
): number {
  const raw = Number(d.tax)
  if (raw > 0) {
    return d.currency === 'KRW' ? raw : raw * (Number(d.exchange_rate) || 1)
  }
  // tax=0인 경우 계좌 세율로 자동 계산
  const rate = d.account?.dividend_tax_rate
  if (rate) {
    return Math.round(toKrw(d) * Number(rate) / 100)
  }
  return 0
}

export function fmtDate(val: unknown): string {
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`
  }
  return String(val ?? '')
}
