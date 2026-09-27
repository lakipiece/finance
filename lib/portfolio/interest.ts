import 'server-only'
import { getSql } from '@/lib/db'
import { toDateStr } from './valuation'

export interface InterestPayment {
  security_id: string
  paid_at: string
}

/**
 * 이자로 기록된 인컴(dividends.income_type = '이자')의 종목별 지급 내역.
 * 미수이자 기산점을 마지막 지급일로 당기는 데 쓴다 — accrualFactor 참고.
 */
export async function fetchInterestPayments(): Promise<InterestPayment[]> {
  const sql = getSql()
  const rows = await sql<{ security_id: string; paid_at: unknown }[]>`
    SELECT d.security_id, d.paid_at
    FROM dividends d
    JOIN option_list it ON d.income_type_id = it.id
    WHERE it.type = 'income_type' AND it.value = '이자'
      AND d.security_id IS NOT NULL
    ORDER BY d.paid_at DESC
  `
  return (rows ?? []).map(r => ({ security_id: r.security_id, paid_at: toDateStr(r.paid_at) }))
}

/** 기준일 이전 마지막 이자 지급일 맵 (security_id → 'YYYY-MM-DD') */
export function lastInterestMap(
  payments: InterestPayment[],
  asOf: string,
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const p of payments) {
    if (p.paid_at > asOf) continue
    const prev = map[p.security_id]
    if (!prev || p.paid_at > prev) map[p.security_id] = p.paid_at
  }
  return map
}
