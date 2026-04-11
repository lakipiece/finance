import { getSql } from '@/lib/db'
import SnapshotCharts from '@/components/portfolio/SnapshotCharts'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type SnapshotRow = {
  id: string
  date: unknown
  total_market_value: number | null
  sector_breakdown: unknown
}

export default async function SnapshotChartsPage() {
  const sql = getSql()
  const [raw, sectorRows] = await Promise.all([
    sql<SnapshotRow[]>`
      SELECT id, date, total_market_value, sector_breakdown
      FROM snapshots ORDER BY date ASC, created_at ASC
    `,
    sql<{ value: string; color_hex: string }[]>`
      SELECT value, color_hex FROM option_list WHERE type = 'sector' AND color_hex IS NOT NULL
    `,
  ])

  const sectorColors: Record<string, string> = Object.fromEntries(
    sectorRows.map(r => [r.value, r.color_hex])
  )

  const points = raw
    .filter(s => s.total_market_value != null)
    .map(s => {
      const raw_breakdown = s.sector_breakdown
      const breakdown: Record<string, number> =
        raw_breakdown == null ? {}
        : typeof raw_breakdown === 'string' ? JSON.parse(raw_breakdown)
        : raw_breakdown as Record<string, number>
      return {
        date: (s.date as unknown) instanceof Date
          ? (s.date as unknown as Date).toISOString().slice(0, 10)
          : String(s.date).slice(0, 10),
        total_market_value: Number(s.total_market_value),
        breakdown,
      }
    })

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/portfolio/snapshots"
          className="text-slate-400 hover:text-slate-600 transition-colors text-sm">
          ← 스냅샷 목록
        </Link>
        <h1 className="text-sm font-semibold text-slate-700">자산 추이 차트</h1>
      </div>
      {points.length < 2 ? (
        <div className="bg-white rounded-2xl border border-slate-100 px-6 py-12 text-center">
          <p className="text-slate-400 text-sm">차트를 표시하려면 평가액이 입력된 스냅샷이 2개 이상 필요합니다.</p>
          <Link href="/portfolio/snapshots" className="mt-3 inline-block text-xs text-blue-500 underline">
            스냅샷 목록으로 돌아가기
          </Link>
        </div>
      ) : (
        <SnapshotCharts points={points} sectorColors={sectorColors} />
      )}
    </div>
  )
}
