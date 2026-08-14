// lib/portfolio/metrics.ts
// 스냅샷 지표 계산 — 클라이언트/서버 공용 순수 함수.
//
// 지표 흐름:
//   투자원금 = 누적입금 (원장 기록 계좌) | 평균매수금액 (미기록 계좌 폴백)
//   수익금액 = 평가금액 + 누적출금 − 누적입금 | 평가금액 − 평균매수금액
// 계좌 단위로 기준을 정한 뒤 합산해야 한다 — 전체 합계끼리 비교하면
// 원장이 일부 계좌에만 있을 때 수익률이 왜곡된다.

/** 계좌별 날짜별 입출금 합계 (flow_date 오름차순 정렬 전제) */
export interface AccountCashflowEvent {
  account_id: string
  date: string
  inflow: number
  outflow: number
}

/** snapshots.account_breakdown 항목: 계좌별 평가액·평균매수금액 (KRW) */
export interface AccountSnapshotEntry {
  value: number
  cost: number
}

/** date 이하의 계좌별 누적 입금/출금. 입금 0인 계좌는 원장 미기록으로 취급해 제외. */
export function cumulativeByAccount(
  events: AccountCashflowEvent[],
  date: string,
): Record<string, { inflow: number; outflow: number }> {
  const map: Record<string, { inflow: number; outflow: number }> = {}
  for (const e of events) {
    if (e.date > date) continue
    const m = (map[e.account_id] ??= { inflow: 0, outflow: 0 })
    m.inflow += e.inflow
    m.outflow += e.outflow
  }
  for (const id of Object.keys(map)) {
    if (map[id].inflow <= 0) delete map[id]
  }
  return map
}

export interface LedgerSums { inflow: number; outflow: number }

export interface HybridMetrics {
  /** 투자원금 (계좌별 누적입금 | 매수원가 합산) */
  basis: number
  /** 수익금액 (계좌별 기준 적용 후 합산) */
  profit: number
  rate: number | null
  /** 원장 계좌들의 입금/출금 합계 */
  deposits: number
  withdrawals: number
  /** 원장 기준이 하나라도 적용됐는지 */
  ledgerApplied: boolean
  /** 표시 대상 계좌 전부가 원장 기록을 갖는지 */
  coversAll: boolean
}

/**
 * 계좌별 기준 적용 후 합산 — 모든 화면(대시보드/목록/차트/편집)의 공통 코어.
 * 전체 합계끼리 비교하면 안 된다: 원장이 일부 계좌에만 있을 때
 * "전체 평가액 vs 일부 입금"이 되어 수익률이 왜곡된다.
 */
export function hybridTotals(
  perAccount: Record<string, AccountSnapshotEntry>,
  ledger: Record<string, LedgerSums>,
): HybridMetrics {
  let basis = 0, profit = 0, deposits = 0, withdrawals = 0
  let ledgerApplied = false
  let fallbackUsed = false
  const ids = new Set([...Object.keys(perAccount), ...Object.keys(ledger)])
  for (const id of ids) {
    const entry = perAccount[id] ?? { value: 0, cost: 0 }
    const lg = ledger[id]
    if (lg && lg.inflow > 0) {
      basis += lg.inflow
      deposits += lg.inflow
      withdrawals += lg.outflow
      profit += entry.value + lg.outflow - lg.inflow
      ledgerApplied = true
    } else {
      basis += entry.cost
      profit += entry.value - entry.cost
      if (entry.cost > 0 || entry.value > 0) fallbackUsed = true
    }
  }
  return {
    basis, profit,
    rate: basis > 0 ? profit / basis : null,
    deposits, withdrawals,
    ledgerApplied,
    coversAll: ledgerApplied && !fallbackUsed,
  }
}

/**
 * 스냅샷 1개의 하이브리드 지표.
 * @param breakdown 계좌별 {value, cost}. 비어 있으면(값 갱신 전) 전체 매수원가 기준으로 폴백.
 * @param totals    스냅샷 저장 합계 (breakdown 없을 때 사용)
 */
export function snapshotMetrics(
  breakdown: Record<string, AccountSnapshotEntry> | null,
  events: AccountCashflowEvent[],
  date: string,
  totals: { value: number; cost: number },
): HybridMetrics {
  if (!breakdown || Object.keys(breakdown).length === 0) {
    // 계좌 분해가 없으면 원장을 안전하게 적용할 수 없다 → 매수원가 기준
    const profit = totals.value - totals.cost
    return {
      basis: totals.cost,
      profit,
      rate: totals.cost > 0 ? profit / totals.cost : null,
      deposits: 0, withdrawals: 0,
      ledgerApplied: false,
      coversAll: false,
    }
  }
  return hybridTotals(breakdown, cumulativeByAccount(events, date))
}

export function parseAccountBreakdown(raw: unknown): Record<string, AccountSnapshotEntry> {
  if (raw == null) return {}
  const obj = typeof raw === 'string' ? JSON.parse(raw) : raw
  if (typeof obj !== 'object' || obj === null) return {}
  const out: Record<string, AccountSnapshotEntry> = {}
  for (const [k, v] of Object.entries(obj as Record<string, { value?: number; cost?: number }>)) {
    out[k] = { value: Number(v?.value ?? 0), cost: Number(v?.cost ?? 0) }
  }
  return out
}
