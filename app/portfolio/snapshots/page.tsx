import { getSql } from '@/lib/db'
import SnapshotList from '@/components/portfolio/SnapshotList'

export const dynamic = 'force-dynamic'

import { breakdownToPct, parseAccountBreakdown } from '@/lib/portfolio/metrics'

type SnapshotRow = {
  id: string
  date: unknown
  memo: string | null
  total_market_value: number | null
  total_invested: number | null
  sector_breakdown: Record<string, number> | null
  account_breakdown: unknown
  value_updated_at: unknown
  unpriced_tickers: string[] | null
}

export default async function SnapshotsPage() {
  const sql = getSql()
  const [raw, sectorRows, cashflowRows, dividendRows, reportRows] = await Promise.all([
    sql<SnapshotRow[]>`
      SELECT id, date, memo, total_market_value, total_invested, sector_breakdown, account_breakdown, value_updated_at,
             unpriced_tickers
      FROM snapshots ORDER BY date DESC, created_at DESC
    `,
    sql<{ value: string; color_hex: string }[]>`
      SELECT value, color_hex FROM option_list WHERE type = 'sector' AND color_hex IS NOT NULL
    `,
    // 계좌별 입출금 이벤트 — 스냅샷 시점별 누적입금/출금 계산용 (테이블 없으면 빈 배열)
    sql<{ account_id: string; flow_date: unknown; inflow: number; outflow: number }[]>`
      SELECT account_id, flow_date,
        COALESCE(SUM(amount) FILTER (WHERE type IN ('deposit','opening')), 0)::float AS inflow,
        COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal'), 0)::float AS outflow
      FROM account_cashflows
      GROUP BY account_id, flow_date ORDER BY flow_date
    `.catch(() => [] as { account_id: string; flow_date: unknown; inflow: number; outflow: number }[]),
    // 월별 배당 합계 (KRW 환산)
    sql<{ ym: string; total: number }[]>`
      SELECT to_char(paid_at, 'YYYY-MM') AS ym,
        SUM(CASE WHEN currency = 'KRW' THEN amount ELSE amount * COALESCE(exchange_rate, 1) END)::float AS total
      FROM dividends
      GROUP BY ym
    `.catch(() => [] as { ym: string; total: number }[]),
    // 첨부 보고서 (원문 제외, 최신순)
    sql<{ snapshot_id: string; id: string; title: string }[]>`
      SELECT snapshot_id, id, title FROM snapshot_reports ORDER BY created_at DESC
    `.catch(() => [] as { snapshot_id: string; id: string; title: string }[]),
  ])

  const cashflowEvents = cashflowRows.map(r => ({
    account_id: r.account_id,
    date: (r.flow_date as unknown) instanceof Date
      ? (r.flow_date as unknown as Date).toISOString().slice(0, 10)
      : String(r.flow_date).slice(0, 10),
    inflow: Number(r.inflow),
    outflow: Number(r.outflow),
  }))
  const dividendsByMonth: Record<string, number> = Object.fromEntries(
    dividendRows.map(r => [r.ym, Number(r.total)])
  )
  const sectorColors: Record<string, string> = Object.fromEntries(
    sectorRows.map(r => [r.value, r.color_hex])
  )
  const reportsBySnapshot = new Map<string, { id: string; title: string }[]>()
  for (const r of reportRows) {
    if (!reportsBySnapshot.has(r.snapshot_id)) reportsBySnapshot.set(r.snapshot_id, [])
    reportsBySnapshot.get(r.snapshot_id)!.push({ id: r.id, title: r.title })
  }
  const snapshots = raw.map(s => ({
    id: s.id,
    memo: s.memo,
    date: (s.date as unknown) instanceof Date
      ? (s.date as unknown as Date).toISOString().slice(0, 10)
      : String(s.date).slice(0, 10),
    total_market_value: s.total_market_value != null ? Number(s.total_market_value) : null,
    total_invested: s.total_invested != null ? Number(s.total_invested) : null,
    // DB는 금액(KRW), 화면은 비중(%)
    sector_breakdown: s.sector_breakdown != null
      ? breakdownToPct(s.sector_breakdown, Number(s.total_market_value ?? 0))
      : null,
    account_breakdown: parseAccountBreakdown(s.account_breakdown),
    unpriced_tickers: s.unpriced_tickers ?? [],
    reports: reportsBySnapshot.get(s.id) ?? [],
  }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SnapshotList
        snapshots={snapshots}
        sectorColors={sectorColors}
        cashflowEvents={cashflowEvents}
        dividendsByMonth={dividendsByMonth}
      />
    </div>
  )
}
