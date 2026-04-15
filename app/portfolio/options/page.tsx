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
    <div className="max-w-7xl mx-auto px-4 py-6">
      <OptionsManager initialOptions={grouped} />
    </div>
  )
}
