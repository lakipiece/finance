import { getSql } from '@/lib/db'
import SnapshotList from '@/components/portfolio/SnapshotList'
import SnapshotCharts from '@/components/portfolio/SnapshotCharts'

export const dynamic = 'force-dynamic'

type SnapshotRow = {
  id: string
  date: unknown
  memo: string | null
  total_market_value: number | null
  total_invested: number | null
  sector_breakdown: Record<string, number> | null
  value_updated_at: unknown
}

export default async function SnapshotsPage() {
  const sql = getSql()
  const raw = await sql<SnapshotRow[]>`
    SELECT id, date, memo, total_market_value, total_invested, sector_breakdown, value_updated_at
    FROM snapshots ORDER BY date DESC, created_at DESC
  `
  const snapshots = raw.map(s => ({
    id: s.id,
    memo: s.memo,
    date: (s.date as unknown) instanceof Date
      ? (s.date as unknown as Date).toISOString().slice(0, 10)
      : String(s.date).slice(0, 10),
    total_market_value: s.total_market_value != null ? Number(s.total_market_value) : null,
    total_invested: s.total_invested != null ? Number(s.total_invested) : null,
    sector_breakdown: s.sector_breakdown,
  }))

  // Chart data from stored values
  const chartPoints = snapshots
    .filter(s => s.total_market_value != null)
    .slice().reverse()
    .map(s => ({
      date: s.date,
      total_market_value: s.total_market_value!,
      breakdown: s.sector_breakdown ?? {},
    }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <SnapshotCharts points={chartPoints} />
      <SnapshotList snapshots={snapshots} />
    </div>
  )
}
