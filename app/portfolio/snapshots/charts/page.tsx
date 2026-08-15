import { getSql } from '@/lib/db'
import Link from 'next/link'
import SnapshotCharts from '@/components/portfolio/SnapshotCharts'
import PageHeader from '@/components/ui/PageHeader'
import type { SnapshotViewMode } from '@/components/portfolio/SnapshotList'
import { parseAccountBreakdown } from '@/lib/portfolio/metrics'

export const dynamic = 'force-dynamic'

type SnapshotRow = {
  id: string
  date: unknown
  total_market_value: number | null
  total_invested: number | null
  sector_breakdown: unknown
  asset_class_breakdown: unknown
  tag_breakdown: unknown
  account_breakdown: unknown
}

function parseBreakdown(raw: unknown): Record<string, number> {
  if (raw == null) return {}
  if (typeof raw === 'string') return JSON.parse(raw)
  return raw as Record<string, number>
}

export default async function SnapshotChartsPage({ searchParams }: { searchParams: { view?: string } }) {
  const sql = getSql()
  const [raw, optRows, cashflowRows] = await Promise.all([
    sql<SnapshotRow[]>`
      SELECT id, date, total_market_value, total_invested,
             sector_breakdown, asset_class_breakdown, tag_breakdown, account_breakdown
      FROM snapshots ORDER BY date ASC, created_at ASC
    `,
    sql<{ type: string; value: string; color_hex: string }[]>`
      SELECT type, value, color_hex FROM option_list
      WHERE type IN ('sector','asset_class') AND color_hex IS NOT NULL
    `,
    sql<{ account_id: string; flow_date: unknown; inflow: number; outflow: number }[]>`
      SELECT account_id, flow_date,
        COALESCE(SUM(amount) FILTER (WHERE type IN ('deposit','opening')), 0)::float AS inflow,
        COALESCE(SUM(amount) FILTER (WHERE type = 'withdrawal'), 0)::float AS outflow
      FROM account_cashflows
      GROUP BY account_id, flow_date ORDER BY flow_date
    `.catch(() => [] as { account_id: string; flow_date: unknown; inflow: number; outflow: number }[]),
  ])

  const sectorColors: Record<string, string> = {}
  const assetClassColors: Record<string, string> = {}
  for (const r of optRows) {
    if (r.type === 'sector') sectorColors[r.value] = r.color_hex
    else if (r.type === 'asset_class') assetClassColors[r.value] = r.color_hex
  }

  const points = raw
    .filter(s => s.total_market_value != null)
    .map(s => ({
      date: (s.date as unknown) instanceof Date
        ? (s.date as unknown as Date).toISOString().slice(0, 10)
        : String(s.date).slice(0, 10),
      total_market_value: Number(s.total_market_value),
      total_invested: Number(s.total_invested ?? 0),
      sector_breakdown: parseBreakdown(s.sector_breakdown),
      asset_class_breakdown: parseBreakdown(s.asset_class_breakdown),
      tag_breakdown: parseBreakdown(s.tag_breakdown),
      account_breakdown: parseAccountBreakdown(s.account_breakdown),
    }))

  const cashflowEvents = cashflowRows.map(r => ({
    account_id: r.account_id,
    date: (r.flow_date as unknown) instanceof Date
      ? (r.flow_date as unknown as Date).toISOString().slice(0, 10)
      : String(r.flow_date).slice(0, 10),
    inflow: Number(r.inflow),
    outflow: Number(r.outflow),
  }))

  const viewParam = searchParams.view
  const initialView: SnapshotViewMode =
    viewParam === 'first' || viewParam === 'all' || viewParam === 'last' ? viewParam : 'last'

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <PageHeader title="자산 추이" description="스냅샷 기반 평가액·투자원금·수익 추이">
        <Link href="/portfolio/snapshots"
          className="px-4 py-1.5 rounded-btn text-body font-medium text-ink-2 hover:bg-surface-low transition-colors whitespace-nowrap">
          ← 스냅샷 목록
        </Link>
      </PageHeader>
      {points.length < 2 ? (
        <div className="bg-surface-card rounded-card px-[13px] py-12 text-center">
          <p className="text-ink-4 text-subhead">차트를 표시하려면 평가액이 입력된 스냅샷이 2개 이상 필요합니다.</p>
          <Link href="/portfolio/snapshots" className="mt-3 inline-block text-body text-loss underline">
            스냅샷 목록으로 돌아가기
          </Link>
        </div>
      ) : (
        <SnapshotCharts
          points={points}
          sectorColors={sectorColors}
          assetClassColors={assetClassColors}
          cashflowEvents={cashflowEvents}
          initialView={initialView}
        />
      )}
    </div>
  )
}
