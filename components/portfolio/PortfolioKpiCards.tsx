'use client'

import type { PortfolioSummary } from '@/lib/portfolio/types'
import { useTheme } from '@/lib/ThemeContext'
import { formatWonRound } from '@/lib/utils'

interface Props { summary: PortfolioSummary }

function pctStr(n: number) {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

export default function PortfolioKpiCards({ summary }: Props) {
  const { palette } = useTheme()
  const { total_market_value, total_invested, total_unrealized_pnl, total_unrealized_pct, total_dividends } = summary
  const pnlPos = total_unrealized_pnl >= 0
  const pnlColor = pnlPos ? 'text-rose-500' : 'text-blue-500'

  const cards = [
    { label: '총 평가금액', value: formatWonRound(total_market_value), sub: '현재 시장가 기준', inverted: true },
    { label: '총 투자원금', value: formatWonRound(total_invested),      sub: '매수 원가 합계',  inverted: false, color: 'text-slate-700' },
    { label: '수익',        value: `${pnlPos ? '+' : ''}${formatWonRound(total_unrealized_pnl)}`, sub: '평가손익 합계', inverted: false, color: pnlColor },
    { label: '평가수익률',  value: pctStr(total_unrealized_pct), sub: '투자원금 대비', inverted: false, color: pnlColor },
    { label: '누적 분배금', value: formatWonRound(total_dividends), sub: '받은 배당·분배금', inverted: false, color: 'text-slate-700' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map(c => (
        c.inverted ? (
          <div key={c.label}
            className="rounded-2xl shadow-md p-4 sm:p-5 flex flex-col hover:-translate-y-0.5 transition-all relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1A237E 0%, #283593 60%, #00695C 100%)' }}>
            <div className="relative group/lbl inline-block self-start mb-1">
              <p className="text-[10px] text-blue-200 font-semibold uppercase tracking-widest cursor-default">{c.label}</p>
              <div className="absolute bottom-full left-0 mb-1.5 px-2 py-1 bg-white/20 text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover/lbl:opacity-100 transition-opacity pointer-events-none z-10">
                {c.sub}
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold tabular-nums leading-tight mt-auto text-right text-white">{c.value}</p>
            {/* 배경 장식 */}
            <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-10 bg-white" />
          </div>
        ) : (
          <div key={c.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sm:p-5 flex flex-col hover:-translate-y-0.5 transition-all">
            <div className="relative group/lbl inline-block self-start mb-1">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider cursor-default">{c.label}</p>
              <div className="absolute bottom-full left-0 mb-1.5 px-2 py-1 text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover/lbl:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg"
                style={{ backgroundColor: palette.colors[0] }}>
                {c.sub}
              </div>
            </div>
            <p className={`text-lg sm:text-xl font-bold tabular-nums leading-tight mt-auto text-right ${c.color}`}>{c.value}</p>
          </div>
        )
      ))}
    </div>
  )
}
