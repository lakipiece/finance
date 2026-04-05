'use client'

import type { PortfolioPosition } from '@/lib/portfolio/types'

interface Props { positions: PortfolioPosition[] }

function fmt(n: number) {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (Math.abs(n) >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

export default function PositionsTable({ positions }: Props) {
  const sorted = [...positions].sort((a, b) => b.market_value - a.market_value)
  const total = sorted.reduce((s, p) => s + p.market_value, 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-600">종목별 보유 현황</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">종목</th>
              <th className="text-left px-4 py-3">계좌</th>
              <th className="text-right px-4 py-3">수량</th>
              <th className="text-right px-4 py-3">평균매입가</th>
              <th className="text-right px-4 py-3">현재가</th>
              <th className="text-right px-4 py-3">평가금액</th>
              <th className="text-right px-4 py-3">손익</th>
              <th className="text-right px-4 py-3">비중</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sorted.map((p, i) => {
              const pnlColor = p.unrealized_pnl >= 0 ? 'text-rose-500' : 'text-blue-500'
              const weight = total > 0 ? (p.market_value / total * 100).toFixed(1) : '0.0'
              return (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{p.security.ticker}</p>
                    <p className="text-xs text-slate-400">{p.security.name}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{p.account.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {fmt(p.avg_price)}원
                    {p.avg_price_usd != null && (
                      <p className="text-xs text-slate-400">${p.avg_price_usd.toFixed(2)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {fmt(p.current_price)}원
                    {p.current_price_usd != null && (
                      <p className="text-xs text-slate-400">${p.current_price_usd.toFixed(2)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(p.market_value)}원</td>
                  <td className={`px-4 py-3 text-right font-semibold ${pnlColor}`}>
                    {p.unrealized_pnl >= 0 ? '+' : ''}{fmt(p.unrealized_pnl)}원
                    <p className="text-xs">{(p.unrealized_pct * 100).toFixed(2)}%</p>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">{weight}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
