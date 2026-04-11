'use client'

import type { PortfolioSummary } from '@/lib/portfolio/types'

interface Props { summary: PortfolioSummary }

function fmtKrw(n: number) {
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

function pctStr(n: number) {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

export default function PortfolioKpiCards({ summary }: Props) {
  const { total_market_value, total_invested, total_unrealized_pnl, total_unrealized_pct, total_dividends } = summary
  const pnlPos = total_unrealized_pnl >= 0
  const pnlColor = pnlPos ? 'text-rose-500' : 'text-blue-500'

  const cards = [
    {
      label: '총 평가금액',
      value: fmtKrw(total_market_value),
      sub: '현재 시장가 기준',
      color: 'text-slate-800',
    },
    {
      label: '총 투자원금',
      value: fmtKrw(total_invested),
      sub: '매수 원가 합계',
      color: 'text-slate-800',
    },
    {
      label: '수익',
      value: `${pnlPos ? '+' : ''}${fmtKrw(total_unrealized_pnl)}`,
      sub: '평가손익 합계',
      color: pnlColor,
    },
    {
      label: '평가수익률',
      value: pctStr(total_unrealized_pct),
      sub: '투자원금 대비',
      color: pnlColor,
    },
    {
      label: '누적 분배금',
      value: fmtKrw(total_dividends),
      sub: '받은 배당·분배금',
      color: 'text-slate-800',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 flex flex-col">
          <p className="text-xs font-medium text-slate-500 mb-2">{c.label}</p>
          <p className={`text-xl font-bold tabular-nums text-right leading-tight ${c.color}`}>{c.value}</p>
          <p className="text-[10px] text-slate-300 mt-1 text-right">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}
