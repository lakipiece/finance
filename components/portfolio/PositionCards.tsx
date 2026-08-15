'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { MergedPosition } from './PortfolioDashboard'
import { toYahooTicker } from '@/lib/portfolio/ticker-utils'

interface Props {
  positions: MergedPosition[]
  totalValue: number
  sectorColors?: Record<string, string>
  onEdit?: (security: MergedPosition['security']) => void
}

function fmt(n: number) {
  return Math.round(n).toLocaleString()
}

function PositionModal({ position: p, totalValue, onClose, onEdit, sectorColors = {} }: {
  position: MergedPosition
  totalValue: number
  onClose: () => void
  onEdit?: (security: MergedPosition['security']) => void
  sectorColors?: Record<string, string>
}) {
  const pnlPos = p.unrealized_pnl >= 0
  const pnlColor = pnlPos ? 'text-gain' : 'text-loss'
  const weight = totalValue > 0 ? (p.market_value / totalValue * 100) : 0
  const sectorColor = p.security.sector ? (sectorColors[p.security.sector] ?? '#334155') : '#334155'

  return (
    <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card rounded-card shadow-dialog w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="px-[18px] pt-5 pb-4 border-b border-surface-low">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              <span className="text-white text-body font-bold px-2 py-0.5 rounded font-mono leading-none shrink-0"
                style={{ backgroundColor: sectorColor }}>
                {p.security.ticker}
              </span>
              {p.security.sector && (
                <span className="text-micro tracking-normal px-2 py-0.5 rounded-full text-ink-3">
                  {p.security.sector}
                </span>
              )}
              {p.security.asset_class && (
                <span className="text-micro tracking-normal px-2 py-0.5 rounded-full text-ink-4">
                  {p.security.asset_class}
                </span>
              )}
              {p.security.country && (
                <span className="text-micro tracking-normal px-2 py-0.5 rounded-full text-ink-4">
                  {p.security.country}
                </span>
              )}
            </div>
            <button onClick={onClose} className="text-ink-5 hover:text-ink-3 p-1 rounded hover:bg-surface-low transition-colors shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-subhead font-bold text-ink leading-snug flex-1">{p.security.name}</p>
            {onEdit && (
              <button
                onClick={() => onEdit(p.security)}
                title="종목 수정"
                className="shrink-0 text-ink-5 hover:text-ink-3 p-1 rounded hover:bg-surface-low transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 카드 그리드 3열 2행 */}
        <div className="px-[18px] py-[15px] grid grid-cols-3 gap-2.5">
          <div className="bg-surface-low rounded-field p-3">
            <p className="text-micro tracking-normal text-ink-4 mb-1">수량</p>
            <p className="text-subhead font-bold text-ink tabular-nums">{p.quantity.toLocaleString()}</p>
          </div>
          <div className="bg-surface-low rounded-field p-3">
            <p className="text-micro tracking-normal text-ink-4 mb-1">투자원금</p>
            <p className="text-subhead font-bold text-ink tabular-nums">{fmt(p.total_invested)}원</p>
          </div>
          <div className="bg-surface-low rounded-field p-3">
            <p className="text-micro tracking-normal text-ink-4 mb-1">포트폴리오</p>
            <p className="text-subhead font-bold text-ink tabular-nums">{weight.toFixed(1)}%</p>
          </div>
          <div className="bg-surface-low rounded-field p-3">
            <p className="text-micro tracking-normal text-ink-4 mb-1">현재가</p>
            <p className="text-subhead font-bold text-ink tabular-nums">
              {fmt(p.current_price)}원
              {p.current_price_usd != null && (
                <span className="text-micro tracking-normal text-ink-4 block">${Number(p.current_price_usd).toFixed(2)}</span>
              )}
            </p>
          </div>
          <div className="bg-surface-low rounded-field p-3">
            <p className="text-micro tracking-normal text-ink-4 mb-1">평가금액</p>
            <p className="text-subhead font-bold text-ink tabular-nums">{fmt(p.market_value)}원</p>
          </div>
          <div className="bg-surface-low rounded-field p-3">
            <p className="text-micro tracking-normal text-ink-4 mb-1">손익</p>
            <p className={`text-subhead font-bold tabular-nums ${pnlColor}`}>
              {pnlPos ? '+' : ''}{fmt(p.unrealized_pnl)}원
              <span className="text-micro tracking-normal block">{pnlPos ? '+' : ''}{(p.unrealized_pct * 100).toFixed(2)}%</span>
            </p>
          </div>
        </div>

        {/* 연결 계좌 */}
        {p.accounts.length > 0 && (
          <div className="px-[18px] pb-5 border-t border-surface-low pt-3">
            <p className="text-micro tracking-normal text-ink-4 mb-2">연결 계좌</p>
            <div className="space-y-1.5">
              {p.accounts.map(a => {
                const acctValue = p.accountValues[a.id] ?? 0
                const acctPct = p.market_value > 0 ? (acctValue / p.market_value * 100) : 0
                return (
                  <div key={a.id} className="flex items-center justify-between">
                    <span className="text-body text-ink-2">{a.broker} · {a.name}</span>
                    <div className="text-right">
                      <span className="text-body font-medium text-ink tabular-nums">{fmt(acctValue)}원</span>
                      <span className="text-micro tracking-normal text-ink-4 ml-1.5 tabular-nums">({acctPct.toFixed(1)}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {p.total_dividends > 0 && (
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-low">
                <span className="text-micro tracking-normal text-ink-4">수령 배당금</span>
                <span className="text-body font-medium text-ink-2 tabular-nums">{fmt(p.total_dividends)}원</span>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default function PositionCards({ positions, totalValue, sectorColors = {}, onEdit }: Props) {
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
    return <p className="text-center text-ink-4 text-subhead py-8">선택한 조건에 해당하는 종목이 없습니다.</p>
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
              className="bg-surface-card rounded-card px-[13px] py-3 cursor-pointer hover:shadow-card hover:-translate-y-0.5 transition-all flex flex-col gap-1.5">

              {/* 헤더: 티커 배지 + 계좌수 + 새로고침 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    className="text-white text-micro tracking-normal font-bold px-1.5 py-0.5 rounded font-mono leading-none shrink-0"
                    style={{ backgroundColor: tickerBgColor ?? '#334155' }}>
                    {ticker}
                  </span>
                  <span className="text-micro tracking-normal text-ink-4 bg-surface-low px-1.5 py-0.5 rounded-full shrink-0">
                    {p.accounts.length}개 계좌
                  </span>
                </div>
                <button onClick={e => syncTicker(ticker, e)} disabled={isSyncing}
                  className="shrink-0 text-ink-5 hover:text-ink-3 disabled:opacity-40 transition-colors"
                  title="가격 새로고침">
                  {msg === '✓' ? <span className="text-body text-income">✓</span>
                    : msg === '✗' ? <span className="text-body text-gain">✗</span>
                    : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                        className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}>
                        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.389zm1.26-3.674a.75.75 0 00.219-.53V2.978a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.27 8.236a.75.75 0 101.449.389A5.5 5.5 0 0113.92 6.159l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
                      </svg>
                    )}
                </button>
              </div>

              {/* 종목명 */}
              <p className="text-body font-bold text-ink leading-tight">{p.security.name}</p>

              <div className="border-t border-surface-low" />

              {/* 평가금액 (hover → 현재가 툴팁) */}
              <div className="relative group/price flex justify-end">
                <p className="text-subhead font-bold text-ink-3 tabular-nums cursor-default">{fmt(p.market_value)}원</p>
                <div className="absolute bottom-full right-0 mb-1 px-2.5 py-1.5 bg-action text-white text-micro tracking-normal rounded-btn whitespace-nowrap opacity-0 group-hover/price:opacity-100 transition-opacity pointer-events-none z-10 tabular-nums shadow-card">
                  현재가 {currentPriceLabel}
                </div>
              </div>

              {/* 손익 금액 */}
              <div className="flex justify-end">
                <span className={`text-body font-medium tabular-nums ${pnlPos ? 'text-gain' : 'text-loss'}`}>
                  {pnlPos ? '+' : ''}{fmt(p.unrealized_pnl)}원
                </span>
              </div>

              {/* 비중(좌) + 수익률 배지(우) */}
              <div className="flex items-center justify-between gap-1 mt-0.5">
                <span className="text-micro tracking-normal text-ink-4 tabular-nums">{weight}%</span>
                <span className={`text-micro tracking-normal px-1.5 py-0.5 rounded-full font-medium tabular-nums shrink-0 ${
                  pnlPos ? 'bg-gain/10 text-gain' : 'bg-loss/10 text-loss'
                }`}>
                  {pnlPos ? '+' : ''}{(p.unrealized_pct * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <PositionModal
          position={modal}
          totalValue={totalValue}
          sectorColors={sectorColors}
          onEdit={onEdit ? (sec) => { setModal(null); onEdit(sec) } : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
