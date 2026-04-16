import type { Dividend } from '@/lib/portfolio/types'

export function toKrw(d: Pick<Dividend, 'amount' | 'currency' | 'exchange_rate'>): number {
  return d.currency === 'KRW'
    ? Number(d.amount)
    : Number(d.amount) * (Number(d.exchange_rate) || 1)
}

export function taxKrw(d: Pick<Dividend, 'tax' | 'currency' | 'exchange_rate'>): number {
  return d.currency === 'KRW'
    ? Number(d.tax)
    : Number(d.tax) * (Number(d.exchange_rate) || 1)
}

export function fmtDate(val: unknown): string {
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`
  }
  return String(val ?? '')
}
