import { describe, expect, it } from 'vitest'
import {
  cumulativeByAccount, hybridTotals, modifiedDietz, periodPerformance, snapshotMetrics,
} from '@/lib/portfolio/metrics'

describe('원장 누적', () => {
  it('기준일 이하만 합산, 입금 0인 계좌는 원장 미기록으로 제외', () => {
    const events = [
      { account_id: 'a', date: '2026-01-01', inflow: 100, outflow: 0 },
      { account_id: 'a', date: '2026-02-01', inflow: 50, outflow: 20 },
      { account_id: 'b', date: '2026-01-10', inflow: 0, outflow: 10 },
      { account_id: 'a', date: '2026-03-01', inflow: 999, outflow: 0 },
    ]
    expect(cumulativeByAccount(events, '2026-02-15')).toEqual({ a: { inflow: 150, outflow: 20 } })
  })
})

describe('계좌별 하이브리드', () => {
  it('원장 계좌는 입금 기준, 미기록 계좌는 매수원가 기준으로 각각 계산 후 합산', () => {
    const m = hybridTotals(
      { a: { value: 130, cost: 90 }, b: { value: 60, cost: 50 } },
      { a: { inflow: 100, outflow: 10 } },
    )
    // a: 130 + 10 − 100 = 40,  b: 60 − 50 = 10
    expect(m.profit).toBe(50)
    expect(m.basis).toBe(150)
    expect(m.ledgerApplied).toBe(true)
    expect(m.coversAll).toBe(false)
  })

  it('계좌 분해가 없으면(값 갱신 전) 원장을 적용하지 않는다', () => {
    const m = snapshotMetrics(null, [{ account_id: 'a', date: '2026-01-01', inflow: 100, outflow: 0 }], '2026-02-01', { value: 120, cost: 100 })
    expect(m.profit).toBe(20)
    expect(m.ledgerApplied).toBe(false)
  })
})

describe('Modified Dietz', () => {
  it('유입이 없으면 단순 수익률', () => {
    expect(modifiedDietz(100, 110, [], '2026-01-01', '2026-12-31').rate).toBeCloseTo(0.1, 10)
  })

  it('구간 초 유입은 전액, 구간 말 유입은 0으로 가중', () => {
    const early = modifiedDietz(100, 220, [{ date: '2026-01-01', amount: 100 }], '2026-01-01', '2026-12-31')
    expect(early.rate).toBeCloseTo(20 / 200, 10)
    const late = modifiedDietz(100, 220, [{ date: '2026-12-31', amount: 100 }], '2026-01-01', '2026-12-31')
    expect(late.rate).toBeCloseTo(20 / 100, 10)
  })
})

describe('기간 성과', () => {
  it('앵커 계좌의 기초잔액은 유입이 아니다 (이미 기초 평가액에 포함)', () => {
    const points = [
      { date: '2026-01-01', value: 1000, breakdown: { a: { value: 1000, cost: 1000 } } },
      { date: '2026-12-31', value: 1100, breakdown: { a: { value: 1100, cost: 1000 } } },
    ]
    const events = [{ account_id: 'a', date: '2026-01-02', inflow: 1000, outflow: 0, opening: 1000 }]
    const r = periodPerformance(points, events)!
    expect(r.gain).toBe(100)
    expect(r.dietz).toBeCloseTo(0.1, 10)
  })

  it('스냅샷이 2개 미만이면 null', () => {
    expect(periodPerformance([], [])).toBeNull()
  })
})
