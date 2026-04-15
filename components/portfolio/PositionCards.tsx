'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MergedPosition } from './PortfolioDashboard'
import { toYahooTicker } from '@/lib/portfolio/ticker-utils'

interface Props {
  positions: MergedPosition[]
  totalValue: number
  sectorColors?: Record<string, string>
}

function fmt(n: number) {
  return Math.round(n).toLocaleString()
}

function PositionModal({ position: p, totalValue, onClose, sectorColors = {} }: {
  position: MergedPosition
  totalValue: number
  onClose: () => void
  sectorColors?: Record<string, string>
}) {
  const pnlPos = p.unrealized_pnl >= 0
  const pnlColor = pnlPos ? 'text-rose-500' : 'text-blue-500'
  const weight = totalValue > 0 ? (p.market_value / totalValue * 100) : 0
  const sectorColor = p.security.sector ? (sectorColors[p.security.sector] ?? '#334155') : '#334155'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              <span className="text-white text-xs font-bold px-2 py-0.5 rounded font-mono leading-none shrink-0"
                style={{ backgroundColor: sectorColor }}>
                {p.security.ticker}
              </span>
              {p.security.sector && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-500">
                  {p.security.sector}
                </span>
              )}
              {p.security.asset_class && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-400">
                  {p.security.asset_class}
                </span>
              )}
              {p.security.country && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-400">
                  {p.security.country}
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-slate-300 hover:text-slate-500 p-1 rounded hover:bg-slate-100 transition-colors shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm font-bold text-slate-800 mt-2 leading-snug">{p.security.name}</p>
        </div>

        {/* 카드 그리드 3열 2행 */}
        <div className="px-5 py-4 grid grid-cols-3 gap-2.5">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">수량</p>
            <p className="text-sm font-semibold text-slate-700 tabular-nums">{p.quantity.toLocaleString()}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">투자원금</p>
            <p className="text-sm font-semibold text-slate-700 tabular-nums">{fmt(p.total_invested)}원</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">포트폴리오</p>
            <p className="text-sm font-semibold text-slate-700 tabular-nums">{weight.toFixed(1)}%</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">현재가</p>
            <p className="text-sm font-semibold text-slate-700 tabular-nums">
              {fmt(p.current_price)}원
              {p.current_price_usd != null && (
                <span className="text-[9px] text-slate-400 block">${Number(p.current_price_usd).toFixed(2)}</span>
              )}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">평가금액</p>
            <p className="text-sm font-semibold text-slate-700 tabular-nums">{fmt(p.market_value)}원</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 mb-1">손익</p>
            <p className={`text-sm font-semibold tabular-nums ${pnlColor}`}>
              {pnlPos ? '+' : ''}{fmt(p.unrealized_pnl)}원
              <span className="text-[9px] block">{pnlPos ? '+' : ''}{(p.unrealized_pct * 100).toFixed(2)}%</span>
            </p>
          </div>
        </div>

        {/* 연결 계좌 */}
        {p.accounts.length > 0 && (
          <div className="px-5 pb-5 border-t border-slate-50 pt-3">
            <p className="text-[10px] text-slate-400 mb-2">연결 계좌</p>
            <div className="space-y-1.5">
              {p.accounts.map(a => {
                const acctValue = p.accountValues[a.id] ?? 0
                const acctPct = p.market_value > 0 ? (acctValue / p.market_value * 100) : 0
                return (
                  <div key={a.id} className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">{a.broker} · {a.name}</span>
                    <div className="text-right">
                      <span className="text-xs font-medium text-slate-700 tabular-nums">{fmt(acctValue)}원</span>
                      <span className="text-[10px] text-slate-400 ml-1.5 tabular-nums">({acctPct.toFixed(1)}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {p.total_dividends > 0 && (
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                <span className="text-[10px] text-slate-400">수령 배당금</span>
                <span className="text-xs font-medium text-slate-600 tabular-nums">{fmt(p.total_dividends)}원</span>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default function PositionCards({ positions, totalValue, sectorColors = {} }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<MergedPosition | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<Record<string, string>>({})

  const sorted = [...positions].sort((a, b) => b.market_value - a.market_value)

  async function syncTicker(rawTicker: string, e: React.MouseEvent) {
    e.stopPropagation()
    const yahooTicker = toYahooTicker(rawTicker)
    setSyncing(rawTicker)
    setSyncMsg(prev => ({ ...prev, [rawTicker]: '' }))
    try {
      const res = await fetch('/api/portfolio/prices/refresh/ticker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: yahooTicker }),
      })
      setSyncMsg(prev => ({ ...prev, [rawTicker]: res.ok ? '✓' : '✗' }))
      if (res.ok) router.refresh()
    } catch {
      setSyncMsg(prev => ({ ...prev, [rawTicker]: '✗' }))
    } finally {
      setSyncing(null)
    }
  }

  if (sorted.length === 0) {
    return <p className="text-center text-slate-400 text-sm py-8">선택한 조건에 해당하는 종목이 없습니다.</p>
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.map(p => {
          const pnlPos = p.unrealized_pnl >= 0
          const weight = totalValue > 0 ? (p.market_value / totalValue * 100).toFixed(1) : '0.0'
          const ticker = p.security.ticker
          const isSyncing = syncing === ticker
          const msg = syncMsg[ticker]
          const sectorColor = p.security.sector ? (sectorColors[p.security.sector] ?? null) : null
          // 섹터 컬러가 있으면 티커 배지에 적용, 없으면 기본 slate-700
          const tickerBgColor = sectorColor ?? undefined

          const currentPriceLabel = p.current_price_usd != null
            ? `${fmt(p.current_price)}원 ($${Number(p.current_price_usd).toFixed(2)})`
            : `${fmt(p.current_price)}원`

          return (
            <div key={p.security.id}
              onClick={() => setModal(p)}
              className="bg-white rounded-2xl border border-slate-100 px-4 py-3 cursor-pointer hover:shadow-sm hover:border-slate-200 hover:-translate-y-0.5 transition-all flex flex-col gap-1.5">

              {/* 헤더: 티커 배지 + 계좌수 + 새로고침 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    className="text-white text-[10px] font-bold px-1.5 py-0.5 rounded font-mono leading-none shrink-0"
                    style={{ backgroundColor: tickerBgColor ?? '#334155' }}>
                    {ticker}
                  </span>
                  <span className="text-[9px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-full shrink-0">
                    {p.accounts.length}개 계좌
                  </span>
                </div>
                <button onClick={e => syncTicker(ticker, e)} disabled={isSyncing}
                  className="shrink-0 text-slate-300 hover:text-slate-500 disabled:opacity-40 transition-colors"
                  title="가격 새로고침">
                  {msg === '✓' ? <span className="text-xs text-green-500">✓</span>
                    : msg === '✗' ? <span className="text-xs text-red-400">✗</span>
                    : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                        className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}>
                        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.389zm1.26-3.674a.75.75 0 00.219-.53V2.978a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.27 8.236a.75.75 0 101.449.389A5.5 5.5 0 0113.92 6.159l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                      </svg>
                    )}
                </button>
              </div>

              {/* 종목명 */}
              <p className="text-xs font-bold text-slate-700 leading-tight">{p.security.name}</p>

              <div className="border-t border-slate-50" />

              {/* 평가금액 (hover → 현재가 툴팁) */}
              <div className="relative group/price flex justify-end">
                <p className="text-sm font-bold text-slate-500 tabular-nums cursor-default">{fmt(p.market_value)}원</p>
                <div className="absolute bottom-full right-0 mb-1 px-2.5 py-1.5 bg-slate-800 text-white text-[10px] rounded-lg whitespace-nowrap opacity-0 group-hover/price:opacity-100 transition-opacity pointer-events-none z-10 tabular-nums shadow-lg">
                  현재가 {currentPriceLabel}
                </div>
              </div>

              {/* 손익 금액 */}
              <div className="flex justify-end">
                <span className={`text-xs font-semibold tabular-nums ${pnlPos ? 'text-rose-500' : 'text-blue-500'}`}>
                  {pnlPos ? '+' : ''}{fmt(p.unrealized_pnl)}원
                </span>
              </div>

              {/* 비중(좌) + 수익률 배지(우) */}
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <span className="text-[10px] text-slate-400 tabular-nums">{weight}%</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums shrink-0 ${
                  pnlPos ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'
                }`}>
                  {pnlPos ? '+' : ''}{(p.unrealized_pct * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <PositionModal position={modal} totalValue={totalValue} sectorColors={sectorColors} onClose={() => setModal(null)} />
      )}
    </>
  )
}
