'use client'

import { useState } from 'react'
import type { PortfolioPosition } from '@/lib/portfolio/types'
import { toYahooTicker } from '@/lib/portfolio/ticker-utils'

interface Props {
  positions: PortfolioPosition[]
  totalValue: number
}

function fmt(n: number) {
  return Math.round(n).toLocaleString()
}

function PositionModal({ position: p, totalValue, onClose }: {
  position: PortfolioPosition
  totalValue: number
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [qty, setQty] = useState(String(p.quantity))
  const [avgPrice, setAvgPrice] = useState(String(p.avg_price_usd ?? p.avg_price))
  const [totalInvested, setTotalInvested] = useState(String(p.total_invested))

  const isUSD = p.avg_price_usd != null
  const pnlColor = p.unrealized_pnl >= 0 ? 'text-rose-500' : 'text-blue-500'
  const weight = totalValue > 0 ? (p.market_value / totalValue * 100).toFixed(1) : '0.0'

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/portfolio/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: p.account.id,
          security_id: p.security.id,
          quantity: parseFloat(qty) || 0,
          avg_price: parseFloat(avgPrice) || null,
          total_invested: parseFloat(totalInvested) || null,
          snapshot_date: new Date().toISOString().slice(0, 10),
        }),
      })
      if (!res.ok) {
        const json = await res.json()
        setMsg(`오류: ${json.error}`)
      } else {
        setMsg('저장 완료')
      }
    } catch {
      setMsg('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <p className="font-bold text-slate-800 text-lg">{p.security.ticker}</p>
            <p className="text-sm text-slate-400">{p.security.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{p.account.broker} · {p.account.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none mt-0.5">×</button>
        </div>
        <div className="px-6 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm border-b border-slate-100">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">평가금액</p>
            <p className="font-semibold text-slate-800">{fmt(p.market_value)}원</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">손익</p>
            <p className={`font-semibold ${pnlColor}`}>
              {p.unrealized_pnl >= 0 ? '+' : ''}{fmt(p.unrealized_pnl)}원
              <span className="text-xs ml-1">({(p.unrealized_pct * 100).toFixed(2)}%)</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">현재가</p>
            <p className="text-slate-700">
              {fmt(p.current_price)}원
              {p.current_price_usd != null && <span className="text-xs text-slate-400 ml-1">${Number(p.current_price_usd).toFixed(2)}</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">포트폴리오 비중</p>
            <p className="text-slate-700">{weight}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">자산군 / 국가</p>
            <p className="text-slate-700">{p.security.asset_class} / {p.security.country}</p>
          </div>
          {p.total_dividends > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">수령 배당금</p>
              <p className="text-slate-700">{fmt(p.total_dividends)}원</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">포지션 수정</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">수량</label>
              <input type="number" step="any" value={qty} onChange={e => setQty(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">평균매입가 {isUSD ? '(USD)' : '(원)'}</label>
              <input type="number" step="any" value={avgPrice} onChange={e => setAvgPrice(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">투자원금 (원)</label>
              <input type="number" step="any" value={totalInvested} onChange={e => setTotalInvested(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving}
              className="bg-slate-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors">
              {saving ? '저장 중...' : '저장'}
            </button>
            {msg && <span className={`text-xs ${msg.startsWith('오류') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PositionCards({ positions, totalValue }: Props) {
  const [modal, setModal] = useState<PortfolioPosition | null>(null)
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {sorted.map(p => {
          const pnlPos = p.unrealized_pnl >= 0
          const weight = totalValue > 0 ? (p.market_value / totalValue * 100).toFixed(1) : '0.0'
          const ticker = p.security.ticker
          const isSyncing = syncing === ticker
          const msg = syncMsg[ticker]

          return (
            <div key={`${p.account.id}-${p.security.id}`}
              onClick={() => setModal(p)}
              className="bg-white rounded-2xl border border-slate-100 px-4 py-4 cursor-pointer hover:shadow-sm hover:border-slate-200 transition-all flex flex-col gap-2">

              {/* 헤더: 티커 + 새로고침 */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="bg-slate-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded font-mono leading-none shrink-0">
                      {ticker}
                    </span>
                    {p.security.sector && (
                      <span className="text-[9px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-full shrink-0">
                        {p.security.sector}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-tight truncate">{p.security.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{p.account.broker} · {p.account.name}</p>
                </div>
                <button onClick={e => syncTicker(ticker, e)} disabled={isSyncing}
                  className="shrink-0 text-slate-300 hover:text-slate-500 disabled:opacity-40 transition-colors mt-0.5"
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

              {/* 구분선 */}
              <div className="border-t border-slate-50" />

              {/* 평가금액 + 비중 */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-slate-400">평가금액</p>
                  <p className="text-sm font-bold text-slate-800 tabular-nums">{fmt(p.market_value)}원</p>
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums">{weight}%</span>
              </div>

              {/* 손익 */}
              <div className={`text-xs font-semibold tabular-nums ${pnlPos ? 'text-rose-500' : 'text-blue-500'}`}>
                {pnlPos ? '+' : ''}{fmt(p.unrealized_pnl)}원
                <span className="text-[10px] ml-1 font-normal opacity-80">
                  ({pnlPos ? '+' : ''}{(p.unrealized_pct * 100).toFixed(2)}%)
                </span>
              </div>

              {/* 현재가 */}
              <div className="text-[10px] text-slate-400 tabular-nums">
                현재가 {fmt(p.current_price)}원
                {p.current_price_usd != null && (
                  <span className="ml-1">${Number(p.current_price_usd).toFixed(2)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <PositionModal position={modal} totalValue={totalValue} onClose={() => setModal(null)} />
      )}
    </>
  )
}
