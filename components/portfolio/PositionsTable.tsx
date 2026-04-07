'use client'

import React, { useState } from 'react'
import type { PortfolioPosition } from '@/lib/portfolio/types'
import { toYahooTicker } from '@/lib/portfolio/ticker-utils'

interface Props { positions: PortfolioPosition[] }

function fmt(n: number) {
  return Math.round(n).toLocaleString()
}

function SyncIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
      className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}>
      <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.389zm1.26-3.674a.75.75 0 00.219-.53V2.978a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.27 8.236a.75.75 0 101.449.389A5.5 5.5 0 0113.92 6.159l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
    </svg>
  )
}

interface PositionModalProps {
  position: PortfolioPosition
  totalValue: number
  onClose: () => void
}

function PositionModal({ position: p, totalValue, onClose }: PositionModalProps) {
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
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <p className="font-bold text-slate-800 text-lg">{p.security.ticker}</p>
            <p className="text-sm text-slate-400">{p.security.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{p.account.broker} · {p.account.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none mt-0.5">×</button>
        </div>

        {/* Stats */}
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
              {p.current_price_usd != null && <span className="text-xs text-slate-400 ml-1">${p.current_price_usd.toFixed(2)}</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">포트폴리오 비중</p>
            <p className="text-slate-700">{weight}%</p>
          </div>
          {p.total_dividends > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">수령 배당금</p>
              <p className="text-slate-700">{fmt(p.total_dividends)}원</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400 mb-0.5">자산군 / 국가</p>
            <p className="text-slate-700">{p.security.asset_class} / {p.security.country}</p>
          </div>
        </div>

        {/* Edit */}
        <div className="px-6 py-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">포지션 수정</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">수량</label>
              <input type="number" step="any" value={qty} onChange={e => setQty(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                평균매입가 {isUSD ? '(USD)' : '(원)'}
              </label>
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

export default function PositionsTable({ positions }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<Record<string, string>>({})
  const [modal, setModal] = useState<PortfolioPosition | null>(null)

  const total = positions.reduce((s, p) => s + p.market_value, 0)

  // 계좌별 그룹핑
  const grouped = positions.reduce<Record<string, { label: string; positions: PortfolioPosition[] }>>(
    (acc, p) => {
      const key = p.account.id
      if (!acc[key]) acc[key] = { label: `${p.account.broker} · ${p.account.name}`, positions: [] }
      acc[key].positions.push(p)
      return acc
    }, {}
  )
  // 계좌별로 평가금액 내림차순 정렬
  const accounts = Object.entries(grouped).sort(
    (a, b) =>
      b[1].positions.reduce((s, p) => s + p.market_value, 0) -
      a[1].positions.reduce((s, p) => s + p.market_value, 0)
  )

  function toggleAccount(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-600">종목별 보유 현황</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3">종목</th>
                <th className="text-right px-4 py-3">수량</th>
                <th className="text-right px-4 py-3">평균매입가</th>
                <th className="text-right px-4 py-3">현재가</th>
                <th className="text-right px-4 py-3">평가금액</th>
                <th className="text-right px-4 py-3">손익</th>
                <th className="text-right px-4 py-3">비중</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(([accountId, { label, positions: acctPositions }]) => {
                const isOpen = !collapsed.has(accountId)
                const acctValue = acctPositions.reduce((s, p) => s + p.market_value, 0)
                const acctPnl = acctPositions.reduce((s, p) => s + p.unrealized_pnl, 0)
                const acctInvested = acctPositions.reduce((s, p) => s + p.total_invested, 0)
                const acctPct = acctInvested > 0 ? acctPnl / acctInvested : 0
                const sorted = [...acctPositions].sort((a, b) => b.market_value - a.market_value)

                return (
                  <React.Fragment key={accountId}>
                    {/* 계좌 헤더 행 */}
                    <tr
                      className="bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors select-none"
                      onClick={() => toggleAccount(accountId)}>
                      <td className="px-4 py-2.5" colSpan={5}>
                        <div className="flex items-center gap-2">
                          <span className={`text-slate-400 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                          <span className="font-semibold text-slate-700 text-xs">{label}</span>
                          <span className="text-xs text-slate-400">{acctPositions.length}종목</span>
                        </div>
                      </td>
                      <td className={`px-4 py-2.5 text-right text-xs font-semibold ${acctPnl >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                        {acctPnl >= 0 ? '+' : ''}{fmt(acctPnl)}원
                        <span className="ml-1 text-xs opacity-70">({(acctPct * 100).toFixed(1)}%)</span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs text-slate-500">
                        {total > 0 ? (acctValue / total * 100).toFixed(1) : '0.0'}%
                      </td>
                      <td className="px-4 py-2.5" />
                    </tr>

                    {/* 종목 행들 */}
                    {isOpen && sorted.map((p, i) => {
                      const pnlColor = p.unrealized_pnl >= 0 ? 'text-rose-500' : 'text-blue-500'
                      const weight = total > 0 ? (p.market_value / total * 100).toFixed(1) : '0.0'
                      const ticker = p.security.ticker
                      const isSyncing = syncing === ticker
                      const msg = syncMsg[ticker]
                      return (
                        <tr key={`${accountId}-${i}`}
                          className="border-t border-slate-50 hover:bg-blue-50/40 cursor-pointer transition-colors"
                          onClick={() => setModal(p)}>
                          <td className="px-4 py-3 pl-8">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="bg-slate-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded font-mono leading-none">
                                {ticker}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-slate-700">{p.security.name}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{p.quantity.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {fmt(p.avg_price)}원
                            {p.avg_price_usd != null && (
                              <p className="text-[10px] text-slate-400">${p.avg_price_usd.toFixed(2)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {fmt(p.current_price)}원
                            {p.current_price_usd != null && (
                              <p className="text-[10px] text-slate-400">${p.current_price_usd.toFixed(2)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmt(p.market_value)}원</td>
                          <td className={`px-4 py-3 text-right font-semibold ${pnlColor}`}>
                            {p.unrealized_pnl >= 0 ? '+' : ''}{fmt(p.unrealized_pnl)}원
                            <p className="text-[10px]">{(p.unrealized_pct * 100).toFixed(2)}%</p>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">{weight}%</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={e => syncTicker(ticker, e)} disabled={isSyncing}
                              title="가격 새로고침"
                              className="text-slate-400 hover:text-slate-600 disabled:opacity-40 transition-colors">
                              {msg === '✓' ? <span className="text-xs text-green-500">✓</span>
                                : msg === '✗' ? <span className="text-xs text-red-400">✗</span>
                                : <SyncIcon spinning={isSyncing} />}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <PositionModal position={modal} totalValue={total} onClose={() => setModal(null)} />
      )}
    </>
  )
}
