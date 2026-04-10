import Link from 'next/link'
import { getSql } from '@/lib/db'
import OptionsManager from '@/components/portfolio/OptionsManager'

export const dynamic = 'force-dynamic'

type OptionItem = { id: string; type: string; label: string; value: string; color_hex: string | null; sort_order: number }

export default async function PortfolioSettingsPage() {
  const sql = getSql()
  const rows = await sql<OptionItem[]>`SELECT * FROM option_list ORDER BY type, sort_order, label`
  const grouped: Record<string, OptionItem[]> = {}
  for (const r of rows) {
    if (!grouped[r.type]) grouped[r.type] = []
    grouped[r.type].push(r)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <h2 className="text-lg font-bold text-slate-800">설정</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: '포지션 관리', desc: '계좌/종목 보유 현황 직접 편집', href: '/portfolio/holdings' },
          { title: '구글시트 Import', desc: '구글시트에서 포지션 일괄 가져오기', href: '/portfolio/import' },
          { title: '리밸런싱', desc: '목표 비율 설정 및 리밸런싱 계산', href: '/portfolio/rebalance' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="bg-white rounded-xl border border-slate-100 px-5 py-5 hover:shadow-sm transition-shadow block">
            <p className="font-semibold text-slate-800 mb-1">{item.title}</p>
            <p className="text-xs text-slate-400">{item.desc}</p>
          </Link>
        ))}
      </div>

      <OptionsManager initialOptions={grouped} />
    </div>
  )
}
