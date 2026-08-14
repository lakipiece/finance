'use client'

import type { PortfolioSummary } from '@/lib/portfolio/types'
import type { HybridMetrics } from '@/lib/portfolio/metrics'
import { useTheme } from '@/lib/ThemeContext'
import { formatWonRound } from '@/lib/utils'

/**
 * 지표 흐름:
 *   투자원금     = 누적입금 (원장 계좌) + 평균매수금액 (미기록 계좌 폴백) — 계좌별 적용 후 합산
 *   평균매수금액 = Σ(수량 × 평균매수단가)
 *   평가손익     = 평가금액 − 평균매수금액   (보유 종목의 가치 증감)
 *   수익금액     = 계좌별 (평가액 + 출금 − 입금 | 평가액 − 매수원가) 합산
 * 원장 미기록 시(ledger=null) 매수원가 기준의 기존 지표로 폴백.
 */
interface Props {
  summary: PortfolioSummary
  /** 계좌별 하이브리드 지표 (lib/portfolio/metrics.ts hybridTotals). 원장 기록 없으면 null */
  ledger?: HybridMetrics | null
}

function pctStr(n: number) {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`
}

export default function PortfolioKpiCards({ summary, ledger = null }: Props) {
  const { palette } = useTheme()
  const { total_market_value, total_invested, total_unrealized_pnl, total_unrealized_pct, total_dividends } = summary
  const pnlPos = total_unrealized_pnl >= 0
  const pnlColor = pnlPos ? 'text-rose-500' : 'text-blue-500'

  const cards = ledger ? (() => {
    // 원장 기준 흐름 (계좌별 하이브리드 합산)
    const profitColor = ledger.profit >= 0 ? 'text-rose-500' : 'text-blue-500'
    const basisSub = ledger.coversAll
      ? `누적입금${ledger.withdrawals > 0 ? ` · 출금 ${formatWonRound(ledger.withdrawals)}` : ''}`
      : `입금 ${formatWonRound(ledger.deposits)} + 미기록 계좌 매수원가`
    return [
      { label: '총 평가금액', value: formatWonRound(total_market_value), sub: '현재 시장가 기준', inverted: true },
      { label: '투자원금', value: formatWonRound(ledger.basis), sub: basisSub, inverted: false, color: 'text-slate-700' },
      { label: '평가손익', value: `${pnlPos ? '+' : ''}${formatWonRound(total_unrealized_pnl)}`, sub: `평균매수금액 ${formatWonRound(total_invested)} 대비`, inverted: false, color: pnlColor },
      { label: '수익금액', value: `${ledger.profit >= 0 ? '+' : ''}${formatWonRound(ledger.profit)}`, sub: `수익률 ${ledger.rate != null ? pctStr(ledger.rate) : '-'} — 계좌별 입금·원가 기준`, inverted: false, color: profitColor },
      { label: '누적 분배금', value: formatWonRound(total_dividends), sub: '받은 배당·분배금', inverted: false, color: 'text-slate-700' },
    ]
  })() : [
    // 원장 미기록 — 매수원가 기준 (기존)
    { label: '총 평가금액', value: formatWonRound(total_market_value), sub: '현재 시장가 기준', inverted: true },
    { label: '총 투자원금', value: formatWonRound(total_invested),      sub: '매수 원가 합계 (입출금 미기록)',  inverted: false, color: 'text-slate-700' },
    { label: '평가손익',    value: `${pnlPos ? '+' : ''}${formatWonRound(total_unrealized_pnl)}`, sub: '평가금액 − 매수원가', inverted: false, color: pnlColor },
    { label: '평가수익률',  value: pctStr(total_unrealized_pct), sub: '매수원가 대비', inverted: false, color: pnlColor },
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
