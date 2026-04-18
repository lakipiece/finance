import { getSql } from '@/lib/db'
import OptionsManager from '@/components/portfolio/OptionsManager'

export const dynamic = 'force-dynamic'

type OptionItem = { id: string; type: string; label: string; value: string; color_hex: string | null; sort_order: number }

export default async function PortfolioOptionsPage() {
  const sql = getSql()
  const rows = await sql<OptionItem[]>`SELECT * FROM option_list ORDER BY type, sort_order, label`
  const grouped: Record<string, OptionItem[]> = {}
  for (const r of rows) {
    if (!grouped[r.type]) grouped[r.type] = []
    grouped[r.type].push(r)
  }
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>옵션 관리</h1>
          <p className="text-xs text-slate-400 mt-0.5">섹터, 계좌 유형 등 분류 옵션 설정</p>
        </div>
      </div>
      <OptionsManager initialOptions={grouped} />
    </div>
  )
}
