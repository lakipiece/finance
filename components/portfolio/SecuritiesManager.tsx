'use client'

import { useState, useMemo } from 'react'
import type { Security } from '@/lib/portfolio/types'
import { toYahooTicker } from '@/lib/portfolio/ticker-utils'

interface Props {
  securities: Security[]
  latestPrices: Record<string, { price: number; currency: string; date: string; change_pct: number | null; exchange: string | null }>
  priceHistory?: Record<string, { price: number; date: string }[]>
}

function Sparkline({ data }: { data: { price: number }[] }) {
  if (data.length < 2) return null
  const w = 64, h = 24
  const prices = data.map(d => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - min) / range) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = prices[prices.length - 1]
  const first = prices[0]
  const color = last >= first ? '#22c55e' : '#ef4444'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const COUNTRY_STYLE: Record<string, { badge: string; border: string; ticker: string }> = {
  '국내':  { badge: 'bg-emerald-50 text-emerald-700', border: 'border-l-emerald-400', ticker: 'bg-emerald-100 text-emerald-800' },
  '미국':  { badge: 'bg-blue-50 text-blue-700',      border: 'border-l-blue-400',    ticker: 'bg-blue-100 text-blue-800' },
  '글로벌':{ badge: 'bg-amber-50 text-amber-700',    border: 'border-l-amber-400',   ticker: 'bg-amber-100 text-amber-800' },
  '기타':  { badge: 'bg-slate-100 text-slate-500',   border: 'border-l-slate-300',   ticker: 'bg-slate-100 text-slate-600' },
}
function countryStyle(country: string | null) {
  return COUNTRY_STYLE[country ?? ''] ?? { badge: 'bg-slate-100 text-slate-500', border: 'border-l-slate-200', ticker: 'bg-slate-100 text-slate-600' }
}

// ─── Security Modal (add & edit) ─────────────────────────────────────────────
function SecurityModal({ security, onSave, onClose }: {
  security: Security | null
  onSave: (s: Security) => void
  onClose: () => void
}) {
  const isEdit = security !== null
  const [form, setForm] = useState({
    ticker: security?.ticker ?? '',
    name: security?.name ?? '',
    asset_class: security?.asset_class ?? '주식',
    country: security?.country ?? '미국',
    style: security?.style ?? '성장',
    sector: security?.sector ?? '',
    currency: security?.currency ?? 'USD',
    url: security?.url ?? '',
    memo: security?.memo ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/portfolio/securities', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit ? { id: security!.id } : {}),
          ticker: form.ticker.toUpperCase(),
          name: form.name, asset_class: form.asset_class, country: form.country,
          style: form.style, sector: form.sector || null, currency: form.currency,
          url: form.url || null, memo: form.memo || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSave(data)
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300'
  const lbl = 'block text-[10px] text-slate-500 mb-0.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isEdit && <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">{security!.ticker}</span>}
            <h3 className="text-sm font-semibold text-slate-800">{isEdit ? '종목 수정' : '종목 추가'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {!isEdit && (
            <div className="col-span-2"><label className={lbl}>티커 *</label>
              <input value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                className={inp} placeholder="SCHD" /></div>
          )}
          <div className="col-span-2"><label className={lbl}>종목명 *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp}
              placeholder="슈왑 배당 ETF" /></div>
          <div><label className={lbl}>국가</label>
            <select value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} className={inp}>
              {['미국','국내','글로벌','기타'].map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div><label className={lbl}>통화</label>
            <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className={inp}>
              <option>USD</option><option>KRW</option>
            </select></div>
          <div><label className={lbl}>자산군</label>
            <select value={form.asset_class} onChange={e => setForm(p => ({ ...p, asset_class: e.target.value }))} className={inp}>
              {['주식','채권','대체자산'].map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div><label className={lbl}>섹터</label>
            <input value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} className={inp}
              placeholder="테크" /></div>
          <div className="col-span-2"><label className={lbl}>URL</label>
            <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} className={inp} placeholder="https://..." /></div>
          <div className="col-span-2"><label className={lbl}>메모</label>
            <input value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} className={inp} /></div>
        </div>
        {err && <p className="text-xs text-red-500 mb-3">{err}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || (!isEdit && !form.ticker) || !form.name}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
            {saving ? '저장 중...' : isEdit ? '저장' : '추가'}
          </button>
          <button onClick={onClose} className="text-slate-500 px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors">취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SecuritiesManager({ securities: initSecurities, latestPrices, priceHistory = {} }: Props) {
  const [securities, setSecurities] = useState(initSecurities)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [editModalSecurity, setEditModalSecurity] = useState<Security | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [secSearch, setSecSearch] = useState('')
  const [secFilter, setSecFilter] = useState<{ country: string; currency: string }>({ country: '', currency: '' })
  const [secSort, setSecSort] = useState<'ticker' | 'name' | 'country_name'>('country_name')

  const [syncing, setSyncing] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<Record<string, string>>({})
  const [refreshingAll, setRefreshingAll] = useState(false)

  function notify(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  async function apiFetch(url: string, method: string, body?: object) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? '오류')
    return json
  }

  async function deleteSecurity(id: string) {
    if (!confirm('종목을 삭제하시겠습니까?')) return
    try {
      await apiFetch(`/api/portfolio/securities?id=${id}`, 'DELETE')
      setSecurities(prev => prev.filter(s => s.id !== id))
      notify('종목 삭제 완료')
    } catch (e: unknown) { notify(e instanceof Error ? e.message : '오류', false) }
  }

  async function syncTicker(rawTicker: string) {
    const yahooTicker = toYahooTicker(rawTicker)
    setSyncing(rawTicker)
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

  async function handleRefreshAll() {
    setRefreshingAll(true)
    try {
      await fetch('/api/portfolio/prices/refresh', { method: 'POST' })
      notify('전체 가격 업데이트 완료')
    } catch {
      notify('전체 가격 업데이트 실패', false)
    } finally {
      setRefreshingAll(false)
    }
  }

  const countries = [...new Set(securities.map(s => s.country).filter(Boolean))] as string[]

  const filteredSecurities = useMemo(() => {
    let list = [...securities]
    if (secSearch.trim()) {
      const q = secSearch.toLowerCase()
      list = list.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    }
    if (secFilter.country) list = list.filter(s => s.country === secFilter.country)
    if (secFilter.currency) list = list.filter(s => s.currency === secFilter.currency)
    list.sort((a, b) => {
      if (secSort === 'ticker') return a.ticker.localeCompare(b.ticker)
      if (secSort === 'name') return a.name.localeCompare(b.name)
      if (secSort === 'country_name') {
        const countryOrder: Record<string, number> = { '국내': 0, '미국': 1, '글로벌': 2, '기타': 3 }
        const ca = countryOrder[a.country ?? '기타'] ?? 3
        const cb = countryOrder[b.country ?? '기타'] ?? 3
        return ca !== cb ? ca - cb : a.name.localeCompare(b.name)
      }
      return 0
    })
    return list
  }, [securities, secSearch, secFilter, secSort])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-3">
      {msg && (
        <div className={`px-4 py-2 rounded-lg text-sm ${msg.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Search + filter + sort + actions bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={secSearch} onChange={e => setSecSearch(e.target.value)}
            placeholder="티커 또는 종목명 검색"
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300" />
        </div>
        <select value={secFilter.country} onChange={e => setSecFilter(p => ({ ...p, country: e.target.value }))}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-600">
          <option value="">전체 국가</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={secFilter.currency} onChange={e => setSecFilter(p => ({ ...p, currency: e.target.value }))}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-600">
          <option value="">전체 통화</option>
          <option value="KRW">KRW</option>
          <option value="USD">USD</option>
        </select>
        <select value={secSort} onChange={e => setSecSort(e.target.value as 'ticker' | 'name' | 'country_name')}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-600">
          <option value="country_name">국가/이름순</option>
          <option value="ticker">티커순</option>
          <option value="name">이름순</option>
        </select>
        <span className="text-[10px] text-slate-400">{filteredSecurities.length}개</span>
        <div className="ml-auto flex items-center gap-2">
          <a href="/portfolio/securities/prices" className="text-xs text-blue-500 hover:underline">가격 이력 →</a>
          <button onClick={handleRefreshAll} disabled={refreshingAll}
            className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
            {refreshingAll ? '수집 중...' : '전체 가격 업데이트'}
          </button>
        </div>
      </div>

      {/* Security cards — 5 columns */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {filteredSecurities.map(s => {
          const cs = countryStyle(s.country)
          return (
            <div key={s.id}
              className={`bg-white rounded-xl border-l-2 border border-slate-100 ${cs.border} flex flex-col gap-1.5 p-2.5 hover:shadow-sm transition-all`}>
              {/* Row 1: ticker (left) + currency + link (right) */}
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono leading-none ${cs.ticker}`}>{s.ticker}</span>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[10px] text-slate-400">{s.currency}</span>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-blue-500 hover:underline">링크 ↗</a>
                  ) : s.country === '국내' ? (
                    <a href={`https://finance.naver.com/item/main.naver?code=${s.ticker.replace('KRX:', '')}`} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-blue-500 hover:underline">네이버 ↗</a>
                  ) : (() => {
                    const lp = latestPrices[s.ticker]
                    const ex = lp?.exchange
                    const YAHOO_TO_GOOGLE: Record<string, string> = {
                      PCX: 'NYSEARCA', BTS: 'NYSEARCA',
                      NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ', NIM: 'NASDAQ',
                      NYQ: 'NYSE', ASE: 'NYSEAMERICAN', PNK: 'OTCMKTS',
                    }
                    const googleEx = ex ? YAHOO_TO_GOOGLE[ex] : null
                    const url = googleEx
                      ? `https://www.google.com/finance/quote/${s.ticker}:${googleEx}`
                      : `https://www.google.com/finance/quote/${s.ticker}`
                    return (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-blue-500 hover:underline">구글 ↗</a>
                    )
                  })()}
                </div>
              </div>
              {/* Row 2: name (left) + price (right) */}
              <div className="flex items-start justify-between gap-1">
                <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug flex-1">{s.name}</p>
                <div className="text-right shrink-0">
                  {latestPrices[s.ticker] ? (() => {
                    const lp = latestPrices[s.ticker]
                    const pct = lp.change_pct
                    const priceColor = pct == null ? 'text-slate-700' : pct > 0 ? 'text-red-500' : pct < 0 ? 'text-blue-500' : 'text-slate-700'
                    return (
                      <>
                        <span className={`text-xs font-semibold font-mono ${priceColor} cursor-default`} title={lp.date}>
                          {lp.currency === 'USD' ? `$${lp.price.toFixed(2)}` : `${lp.price.toLocaleString()}원`}
                        </span>
                        {pct != null && (
                          <div className={`text-[9px] font-mono ${pct > 0 ? 'text-red-400' : pct < 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                            {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
                          </div>
                        )}
                        {(priceHistory[s.ticker]?.length ?? 0) >= 2 && (
                          <div className="mt-0.5 flex justify-end">
                            <Sparkline data={priceHistory[s.ticker]} />
                          </div>
                        )}
                      </>
                    )
                  })() : <span className="text-[10px] text-slate-300">-</span>}
                </div>
              </div>
              {/* Row 3: tags + action icons */}
              <div className="flex items-center gap-0.5 flex-wrap">
                {s.country && <span className={`text-[9px] px-1 py-0.5 rounded ${cs.badge}`}>{s.country}</span>}
                {s.sector && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 py-0.5 rounded">{s.sector}</span>}
                <div className="ml-auto flex gap-0.5 items-center">
                  <button onClick={() => syncTicker(s.ticker)} disabled={syncing === s.ticker} title="가격 업데이트"
                    className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40">
                    {syncing === s.ticker ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : syncMsg[s.ticker] ? (
                      <span className="text-[10px] font-mono">{syncMsg[s.ticker]}</span>
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                  <button onClick={() => setEditModalSecurity(s)}
                    className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => deleteSecurity(s.id)}
                    className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {/* Add card */}
        <button onClick={() => setShowAddModal(true)}
          className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors min-h-[80px]">
          <svg className="w-4 h-4 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-xs">추가</span>
        </button>
      </div>

      {/* Add / Edit modal */}
      {(showAddModal || editModalSecurity !== null) && (
        <SecurityModal
          security={editModalSecurity}
          onSave={saved => {
            if (editModalSecurity) {
              setSecurities(prev => prev.map(s => s.id === saved.id ? saved : s))
              notify('종목 수정 완료')
            } else {
              setSecurities(prev => [...prev, saved])
              notify('종목 추가 완료')
            }
            setEditModalSecurity(null)
            setShowAddModal(false)
          }}
          onClose={() => { setEditModalSecurity(null); setShowAddModal(false) }}
        />
      )}
    </div>
  )
}
