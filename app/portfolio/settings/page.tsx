import Link from 'next/link'

export default function PortfolioSettingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h2 className="text-lg font-bold text-slate-800 mb-6">포트폴리오 관리</h2>
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
    </div>
  )
}
