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
      small: true,
    },
    {
      label: '총 투자원금',
      value: fmtKrw(total_invested),
      sub: '매수 원가 합계',
      color: 'text-slate-800',
      small: true,
    },
    {
      label: '수익',
      value: `${pnlPos ? '+' : ''}${fmtKrw(total_unrealized_pnl)}`,
      sub: '평가손익 합계',
      color: pnlColor,
      small: false,
    },
    {
      label: '평가수익률',
      value: pctStr(total_unrealized_pct),
      sub: '투자원금 대비',
      color: pnlColor,
      small: false,
    },
    {
      label: '누적 분배금',
      value: fmtKrw(total_dividends),
      sub: '받은 배당·분배금',
      color: 'text-slate-800',
      small: false,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map(c => (
        <div key={c.label} className="relative group/kpi bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col hover:-translate-y-0.5 transition-all">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{c.label}</p>
          <p className={`font-bold tabular-nums leading-tight mt-1 ${c.small ? 'text-xl' : 'text-2xl'} ${c.color}`}>{c.value}</p>
          {/* 툴팁 */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-700 text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover/kpi:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
            {c.sub}
          </div>
        </div>
      ))}
    </div>
  )
}
