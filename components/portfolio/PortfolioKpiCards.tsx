'use client'

import type { PortfolioSummary } from '@/lib/portfolio/types'

function fmt(n: number) {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (Math.abs(n) >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

function pct(n: number) {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

interface Props { summary: PortfolioSummary }

export default function PortfolioKpiCards({ summary }: Props) {
  const { total_market_value, total_invested, total_unrealized_pnl, total_unrealized_pct, total_dividends } = summary
  const pnlColor = total_unrealized_pnl >= 0 ? 'text-rose-500' : 'text-blue-500'

  const cards = [
    { label: '총 평가금액', value: `${fmt(total_market_value)}원`, sub: '현재 시장가 기준' },
    { label: '총 투자원금', value: `${fmt(total_invested)}원`, sub: '매수 원가 합계' },
    {
      label: '평가손익',
      value: `${total_unrealized_pnl >= 0 ? '+' : ''}${fmt(total_unrealized_pnl)}원`,
      sub: pct(total_unrealized_pct),
      highlight: pnlColor,
    },
    { label: '누적 분배금', value: `${fmt(total_dividends)}원`, sub: '받은 배당/분배금 합계' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{c.label}</p>
          <p className={`text-2xl font-bold text-slate-800 ${c.highlight ?? ''}`}>{c.value}</p>
          <p className="text-xs text-slate-400 mt-1">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}
