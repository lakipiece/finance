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
  /** 입금 + 기초잔액 */
  inflow: number
  outflow: number
  /**
   * inflow 중 기초잔액(opening) 몫. 기간 성과에서 "신규 투자금"과 앵커를 가르는 데 쓴다.
   * 누적 지표만 쓰는 화면은 넘기지 않아도 된다(0으로 본다).
   */
  opening?: number
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

// ─── 기간 성과 (연간 수익률) ────────────────────────────────────────────────
// 누적 지표(위)와 계산 축이 다르다. 누적은 "지금까지 넣은 돈 대비 지금 얼마",
// 기간은 "구간 시작 잔고에서 출발해 그 사이 넣은 돈을 빼고 얼마나 벌었나"다.
//
// 계좌 분류는 구간 끝(to) 시점의 누적입금으로 한 번만 정한다.
// 구간 안에서만 판정하면 그 해 입금이 없던 원장 계좌가 매수원가 폴백으로 튀고,
// 구간 시작으로 판정하면 그 해 원장이 시작된 계좌의 입금이 통째로 누락된다.
//   · 원장 계좌  → 실제 입출금 날짜와 금액을 그대로 현금흐름으로 쓴다
//   · 폴백 계좌  → 스냅샷 사이 매수원가 증분(Δcost)을 구간 중간 시점의 유입으로 근사한다

/** 기간 수익률 계산에 넣는 현금흐름 1건 */
export interface PeriodFlow {
  date: string
  amount: number
}

/** 기간 성과 계산에 필요한 스냅샷 1개 (앵커 포함, date ASC) */
export interface PeriodPoint {
  date: string
  value: number
  breakdown: Record<string, AccountSnapshotEntry>
}

export interface PeriodPerformance {
  /** 기초 앵커 날짜 — 보통 직전 연도 마지막 스냅샷 */
  from: string
  to: string
  beginValue: number
  endValue: number
  /** 신규 투자금액 = 입금 − 출금 (기초잔액 제외) + 미기록 계좌 매수원가 증분 */
  newInvestment: number
  deposits: number
  withdrawals: number
  costDelta: number
  /** 수익률 계산에 쓴 순유입 — 기간 안에 찍힌 기초잔액도 유입으로 본다 */
  netFlow: number
  gain: number
  /** Modified Dietz — 투입 시점을 가중한 실질 수익률 */
  dietz: number | null
  /** 시간가중수익률 — 스냅샷 구간별 수익률의 연쇄곱. 입금 타이밍 영향 제거 */
  twr: number | null
  /** 폴백(원장 미기록) 계좌가 섞였는지 — 근사가 들어갔다는 뜻 */
  usesCostFallback: boolean
}

function dayDiff(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000
}

function midDate(a: string, b: string): string {
  return new Date((Date.parse(a) + Date.parse(b)) / 2).toISOString().slice(0, 10)
}

/** 해당 시점까지 누적입금이 있는 원장 계좌 id 집합 */
export function ledgerAccountIds(events: AccountCashflowEvent[], asOf: string): Set<string> {
  return new Set(Object.keys(cumulativeByAccount(events, asOf)))
}

/** 두 스냅샷 사이 폴백 계좌들의 매수원가 증분 합 */
export function fallbackCostDelta(
  prev: Record<string, AccountSnapshotEntry>,
  curr: Record<string, AccountSnapshotEntry>,
  ledgerIds: Set<string>,
): number {
  let delta = 0
  const ids = new Set([...Object.keys(prev), ...Object.keys(curr)])
  for (const id of ids) {
    if (ledgerIds.has(id)) continue
    delta += (curr[id]?.cost ?? 0) - (prev[id]?.cost ?? 0)
  }
  return delta
}

/**
 * Modified Dietz — gain / (기초잔고 + 시점가중 유입).
 * 가중치는 유입일 이후 남은 기간 비율이다(구간 초 유입이면 1, 구간 말 유입이면 0).
 */
export function modifiedDietz(
  beginValue: number,
  endValue: number,
  flows: PeriodFlow[],
  from: string,
  to: string,
): { gain: number; netFlow: number; rate: number | null } {
  const span = dayDiff(from, to)
  let netFlow = 0
  let weighted = 0
  for (const f of flows) {
    netFlow += f.amount
    const elapsed = span > 0 ? dayDiff(from, f.date) / span : 0
    const w = Math.min(1, Math.max(0, 1 - elapsed))
    weighted += f.amount * w
  }
  const gain = endValue - beginValue - netFlow
  const denom = beginValue + weighted
  return { gain, netFlow, rate: denom > 0 ? gain / denom : null }
}

/**
 * 기간 성과. points는 앵커(구간 시작)를 0번으로 포함한 date ASC 배열이어야 한다.
 * 스냅샷이 2개 미만이면 null.
 */
export function periodPerformance(
  points: PeriodPoint[],
  events: AccountCashflowEvent[],
): PeriodPerformance | null {
  if (points.length < 2) return null
  const from = points[0].date
  const to = points[points.length - 1].date
  const ledgerIds = ledgerAccountIds(events, to)

  // 기초 스냅샷에 이미 잡혀 있던 계좌 — 이 계좌의 기초잔액(opening)은 유입이 아니다.
  // 기초잔액은 "기록을 시작한 시점의 잔고"라 그 금액이 이미 beginValue에 들어 있다.
  // 반대로 기간 중 새로 편입된 계좌의 기초잔액은 진짜 유입이므로 그대로 센다.
  const existingIds = new Set(Object.keys(points[0].breakdown))

  // 원장 계좌 실제 현금흐름 — from 초과 ~ to 이하
  const flows: PeriodFlow[] = []
  let deposits = 0
  let withdrawals = 0
  for (const e of events) {
    if (e.date <= from || e.date > to) continue
    if (!ledgerIds.has(e.account_id)) continue
    const opening = e.opening ?? 0
    const anchorOnly = existingIds.has(e.account_id) ? opening : 0
    deposits += e.inflow - opening
    withdrawals += e.outflow
    flows.push({ date: e.date, amount: e.inflow - e.outflow - anchorOnly })
  }

  // 폴백 계좌 — 스냅샷 구간마다 Δcost를 구간 중간 시점 유입으로
  let costDelta = 0
  let usesCostFallback = false
  for (let i = 1; i < points.length; i++) {
    const d = fallbackCostDelta(points[i - 1].breakdown, points[i].breakdown, ledgerIds)
    if (d === 0) continue
    usesCostFallback = true
    costDelta += d
    flows.push({ date: midDate(points[i - 1].date, points[i].date), amount: d })
  }

  const beginValue = points[0].value
  const endValue = points[points.length - 1].value
  const { gain, netFlow, rate } = modifiedDietz(beginValue, endValue, flows, from, to)

  // TWR — 구간마다 Modified Dietz를 내고 연쇄곱한다
  let factor = 1
  let linked = false
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (dayDiff(a.date, b.date) <= 0) continue
    const seg = flows.filter(f => f.date > a.date && f.date <= b.date)
    const r = modifiedDietz(a.value, b.value, seg, a.date, b.date).rate
    if (r == null) continue
    factor *= 1 + r
    linked = true
  }

  return {
    from, to, beginValue, endValue,
    newInvestment: deposits - withdrawals + costDelta,
    deposits, withdrawals, costDelta,
    netFlow, gain,
    dietz: rate,
    twr: linked ? factor - 1 : null,
    usesCostFallback,
  }
}
