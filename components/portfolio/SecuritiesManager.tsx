'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot } from 'recharts'
import type { Security } from '@/lib/portfolio/types'
import { toYahooTicker } from '@/lib/portfolio/ticker-utils'

type OptionItem = { id: string; type: string; label: string; value: string; color_hex: string | null; sort_order: number }

type HoldingRow = {
  security_id: string
  account_id: string
  account_name: string
  account_broker: string
  quantity: number
  avg_price: number | null
}

interface Props {
  securities: Security[]
  latestPrices: Record<string, { price: number; currency: string; date: string; change_pct: number | null; exchange: string | null }>
  priceHistory?: Record<string, { price: number; date: string }[]>
  options: Record<string, OptionItem[]>
  holdingsMap?: Record<string, HoldingRow[]>
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

function getColorHex(options: Record<string, OptionItem[]>, type: string, value: string | null): string {
  if (!value) return '#94a3b8'
  return options[type]?.find(o => o.value === value)?.color_hex ?? '#94a3b8'
}

function cardColors(options: Record<string, OptionItem[]>, country: string | null, assetClass: string | null) {
  // asset_class takes priority (except 주식 which falls through to country)
  const hex = assetClass && assetClass !== '주식'
    ? getColorHex(options, 'asset_class', assetClass)
    : getColorHex(options, 'country', country)
  return { hex }
}

// ─── Security Modal (add & edit) ─────────────────────────────────────────────
function SecurityModal({ security, onSave, onClose, options }: {
  security: Security | null
  onSave: (s: Security) => void
  onClose: () => void
  options: Record<string, OptionItem[]>
}) {
  const isEdit = security !== null
  const [form, setForm] = useState({
    ticker:        security?.ticker ?? '',
    name:          security?.name ?? '',
    asset_class_id: security?.asset_class_id ?? (options.asset_class?.find(o => o.value === '주식')?.id ?? ''),
    country_id:    security?.country_id     ?? (options.country?.find(o => o.value === '미국')?.id ?? ''),
    style:         security?.style ?? '',
    sector_id:     security?.sector_id      ?? '',
    currency_id:   security?.currency_id    ?? (options.currency?.find(o => o.value === 'USD')?.id ?? ''),
    url:  security?.url ?? '',
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
          name: form.name,
          asset_class_id: form.asset_class_id || null,
          country_id:     form.country_id     || null,
          style:          form.style          || null,
          sector_id:      form.sector_id      || null,
          currency_id:    form.currency_id    || null,
          url:  form.url  || null,
          memo: form.memo || null,
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

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
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
            <select value={form.country_id} onChange={e => setForm(p => ({ ...p, country_id: e.target.value }))} className={inp}>
              <option value="">선택 안함</option>
              {(options.country ?? []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select></div>
          <div><label className={lbl}>통화</label>
            <select value={form.currency_id} onChange={e => setForm(p => ({ ...p, currency_id: e.target.value }))} className={inp}>
              <option value="">선택 안함</option>
              {(options.currency ?? []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select></div>
          <div><label className={lbl}>자산군</label>
            <select value={form.asset_class_id} onChange={e => setForm(p => ({ ...p, asset_class_id: e.target.value }))} className={inp}>
              <option value="">선택 안함</option>
              {(options.asset_class ?? []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select></div>
          <div><label className={lbl}>섹터</label>
            <select value={form.sector_id} onChange={e => setForm(p => ({ ...p, sector_id: e.target.value }))} className={inp}>
              <option value="">선택 안함</option>
              {(options.sector ?? []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select></div>
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
  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}

// ─── Holding Card ─────────────────────────────────────────────────────────────
function HoldingCard({
  label, value, sub, hoverLines, valueColor,
}: {
  label: string
  value: string
  sub?: { text: string; positive?: boolean }
  hoverLines?: { left: string; right: string }[]
  valueColor?: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="relative flex flex-col items-center justify-center rounded-xl bg-white border border-slate-100 px-2 py-3 text-center min-w-0 cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p className="text-[9px] text-slate-400 mb-1 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold tabular-nums leading-tight ${valueColor ?? 'text-slate-700'}`}>{value}</p>
      {sub && (
        <p className={`text-[10px] mt-0.5 tabular-nums font-medium ${sub.positive === true ? 'text-green-600' : sub.positive === false ? 'text-red-500' : 'text-slate-400'}`}>
          {sub.text}
        </p>
      )}
      {hovered && hoverLines && hoverLines.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 bg-slate-800 text-white rounded-lg px-3 py-2 shadow-xl whitespace-nowrap min-w-max">
          {hoverLines.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-4 text-[10px]">
              <span className="text-slate-300">{l.left}</span>
              <span className="font-medium">{l.right}</span>
            </div>
          ))}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  )
}

// ─── Price History Modal ──────────────────────────────────────────────────────
function PriceHistoryModal({
  security,
  history,
  latestPrice,
  holdings,
  hex,
  tickerUrl,
  usdKrwRate,
  onClose,
}: {
  security: Security
  history: { price: number; date: string }[]
  latestPrice: { price: number; currency: string; date: string; change_pct: number | null } | null
  holdings: HoldingRow[]
  hex: string
  tickerUrl: string | null
  usdKrwRate?: number | null
  onClose: () => void
}) {
  const isUSD = latestPrice?.currency === 'USD'
  const recent30 = useMemo(() => [...history].slice(-30), [history])
  const tableRows = useMemo(() => [...recent30].reverse(), [recent30])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // 가중평균 계산
  const totalQty = holdings.reduce((s, h) => s + h.quantity, 0)
  const weightedSum = holdings.reduce((s, h) => s + (h.avg_price ?? 0) * h.quantity, 0)
  const avgPrice = totalQty > 0 ? weightedSum / totalQty : null
  const totalInvested = avgPrice != null ? avgPrice * totalQty : null
  const currentPrice = latestPrice?.price ?? 0
  const marketValue = currentPrice * totalQty

  // USD → KRW 변환
  const toKrw = (v: number) => isUSD && usdKrwRate ? v * usdKrwRate : v
  const investedKrw = totalInvested != null ? toKrw(totalInvested) : null
  const marketValueKrw = toKrw(marketValue)
  const pnlKrw = investedKrw != null ? marketValueKrw - investedKrw : null
  const returnPct = investedKrw && pnlKrw != null && investedKrw > 0
    ? (pnlKrw / investedKrw) * 100 : null

  const fmt = (v: number) => isUSD ? `$${v.toFixed(2)}` : `${Math.round(v).toLocaleString()}원`
  const fmtKrw = (v: number) => {
    const abs = Math.abs(v)
    const sign = v < 0 ? '-' : ''
    if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억`
    if (abs >= 10_000) return `${sign}${Math.floor(abs / 10_000).toLocaleString()}만원`
    return `${Math.round(v).toLocaleString()}원`
  }
  const fmtPnl = (v: number) => `${v > 0 ? '+' : ''}${fmtKrw(v)}`
  const pnlColor = (v: number | null) => v == null ? 'text-slate-700' : v > 0 ? 'text-red-500' : v < 0 ? 'text-blue-500' : 'text-slate-700'

  // 차트 min/max
  const minIdx = recent30.length >= 2 ? recent30.reduce((mi, d, i) => d.price < recent30[mi].price ? i : mi, 0) : -1
  const maxIdx = recent30.length >= 2 ? recent30.reduce((mi, d, i) => d.price > recent30[mi].price ? i : mi, 0) : -1
  const fmtChartPrice = (v: number) => isUSD
    ? `$${v >= 1000 ? v.toFixed(0) : v.toFixed(1)}`
    : v >= 10000 ? `${(v / 10000).toFixed(1)}만` : `${Math.round(v)}`

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="relative flex items-start justify-between px-5 pt-5 pb-3 pr-12 shrink-0">
          {/* X — 우상단 고정 */}
          <button onClick={onClose} className="absolute top-3 right-3 text-slate-300 hover:text-slate-500 p-1 rounded hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            {/* Ticker + tags */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              {tickerUrl ? (
                <a href={tickerUrl} target="_blank" rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-xs font-bold px-2 py-0.5 rounded font-mono hover:opacity-75 transition-opacity"
                  style={{ backgroundColor: hex + '20', color: hex }}>
                  {security.ticker}
                </a>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 rounded font-mono"
                  style={{ backgroundColor: hex + '20', color: hex }}>
                  {security.ticker}
                </span>
              )}
              {security.asset_class && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{security.asset_class}</span>}
              {security.country    && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{security.country}</span>}
              {security.sector     && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{security.sector}</span>}
              <span className="text-[10px] text-slate-300 ml-0.5">{security.currency}</span>
            </div>
            {/* Name */}
            <p className="text-xl font-bold text-slate-500 leading-tight">{security.name}</p>
          </div>

          {/* 증감율(좌) + 가격(우, hover→날짜 툴팁) */}
          {latestPrice && (
            <div className="ml-4 shrink-0">
              <div className="flex items-baseline gap-1.5 justify-end">
                {latestPrice.change_pct != null && (
                  <span className={`text-[10px] font-medium ${latestPrice.change_pct > 0 ? 'text-red-400' : latestPrice.change_pct < 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                    {latestPrice.change_pct > 0 ? '+' : ''}{latestPrice.change_pct.toFixed(2)}%
                  </span>
                )}
                <div className="relative group cursor-default">
                  <p className="text-base font-semibold text-slate-400 tabular-nums">
                    {isUSD ? `$${latestPrice.price.toFixed(2)}` : `${latestPrice.price.toLocaleString()}원`}
                  </p>
                  <div className="absolute top-full right-0 mt-1 hidden group-hover:block bg-slate-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10 shadow-lg">
                    {latestPrice.date}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Holdings — 2행 × 3카드 ── */}
        {holdings.length > 0 && (
          <div className="mx-5 mb-4 space-y-1.5 shrink-0">
            {/* 1행: 총수량, 평균매수가, 투자원금 */}
            <div className="grid grid-cols-3 gap-1.5">
              <HoldingCard
                label="총 수량"
                value={totalQty.toLocaleString()}
                hoverLines={holdings.map(h => ({ left: h.account_name, right: `${h.quantity.toLocaleString()}주` }))}
              />
              <HoldingCard
                label="평균매수가"
                value={avgPrice != null ? fmt(avgPrice) : '—'}
                hoverLines={holdings.map(h => ({ left: h.account_name, right: h.avg_price != null ? fmt(h.avg_price) : '—' }))}
              />
              <HoldingCard
                label="투자원금"
                value={investedKrw != null ? fmtKrw(investedKrw) : '—'}
                hoverLines={holdings.map(h => ({
                  left: h.account_name,
                  right: h.avg_price != null ? fmtKrw(toKrw(h.avg_price * h.quantity)) : '—',
                }))}
              />
            </div>
            {/* 2행: 평가금액, 수익, 수익률 */}
            <div className="grid grid-cols-3 gap-1.5">
              <HoldingCard
                label="평가금액"
                value={marketValueKrw > 0 ? fmtKrw(marketValueKrw) : '—'}
                hoverLines={holdings.map(h => ({
                  left: h.account_name,
                  right: currentPrice > 0 ? fmtKrw(toKrw(currentPrice * h.quantity)) : '—',
                }))}
              />
              <HoldingCard
                label="수익"
                value={pnlKrw != null ? fmtPnl(pnlKrw) : '—'}
                valueColor={pnlColor(pnlKrw)}
                hoverLines={holdings.map(h => ({
                  left: h.account_name,
                  right: h.avg_price != null && currentPrice > 0
                    ? fmtPnl(toKrw((currentPrice - h.avg_price) * h.quantity))
                    : '—',
                }))}
              />
              <HoldingCard
                label="수익률"
                value={returnPct != null ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%` : '—'}
                valueColor={pnlColor(returnPct)}
              />
            </div>
          </div>
        )}

        {/* ── Chart ── */}
        <div className="mx-5 mb-3 rounded-xl bg-slate-50 border border-slate-100 p-3 shrink-0">
          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            가격 이력 {recent30.length > 0 ? `(${recent30.length}일)` : ''}
          </p>
          {recent30.length >= 2 ? (
            <ResponsiveContainer width="100%" height={145}>
              <LineChart data={recent30} margin={{ top: 22, right: 12, left: 0, bottom: 8 }}
                style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  interval="preserveStartEnd"
                  tickFormatter={d => String(d).slice(5)}
                  padding={{ left: 12, right: 12 }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px' }}
                  formatter={(v: number) => [isUSD ? `$${v.toFixed(2)}` : `${v.toLocaleString()}원`, '가격']}
                  labelFormatter={label => String(label)}
                />
                <Line type="monotone" dataKey="price" stroke={hex} dot={false} strokeWidth={1.5} />
                {minIdx >= 0 && maxIdx >= 0 && minIdx !== maxIdx && (
                  <>
                    <ReferenceDot x={recent30[minIdx].date} y={recent30[minIdx].price} r={3} fill={hex} stroke="white" strokeWidth={1.5}
                      label={{ value: fmtChartPrice(recent30[minIdx].price), position: 'bottom', fontSize: 8, fill: '#64748b' }} />
                    <ReferenceDot x={recent30[maxIdx].date} y={recent30[maxIdx].price} r={3} fill={hex} stroke="white" strokeWidth={1.5}
                      label={{ value: fmtChartPrice(recent30[maxIdx].price), position: 'top', fontSize: 8, fill: '#64748b' }} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : recent30.length === 1 ? (
            <p className="text-xs text-slate-400 text-center py-4">데이터가 1개뿐이라 차트를 표시할 수 없습니다</p>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">수집된 가격 이력이 없습니다</p>
          )}
        </div>

        {/* ── Table ── */}
        {tableRows.length > 0 && (
          <div className="overflow-y-auto mx-5 mb-5 rounded-xl border border-slate-100 shrink-1">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="text-[9px] text-slate-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-2">날짜</th>
                  <th className="text-right px-4 py-2">가격</th>
                  <th className="text-right px-4 py-2">등락</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((r, i) => {
                  const prev = tableRows[i + 1]
                  const pct = prev ? ((r.price - prev.price) / prev.price) * 100 : null
                  return (
                    <tr key={r.date} className="border-t border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-1.5 text-[10px] font-sans text-slate-500 tabular-nums">{r.date}</td>
                      <td className="px-4 py-1.5 text-[10px] text-right font-sans text-slate-400 tabular-nums">
                        {isUSD ? `$${r.price.toFixed(2)}` : r.price.toLocaleString()}
                      </td>
                      <td className={`px-4 py-1.5 text-[10px] text-right font-sans tabular-nums ${pct == null ? 'text-slate-300' : pct > 0 ? 'text-red-400' : pct < 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                        {pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SecuritiesManager({ securities: initSecurities, latestPrices, priceHistory = {}, options, holdingsMap = {} }: Props) {
  const [securities, setSecurities] = useState(initSecurities)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [editModalSecurity, setEditModalSecurity] = useState<Security | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [historyModalSecurity, setHistoryModalSecurity] = useState<Security | null>(null)
  const [secSearch, setSecSearch] = useState('')
  const [secFilter, setSecFilter] = useState<{ country: string; currency: string; asset_class: string; sector: string }>({ country: '', currency: '', asset_class: '', sector: '' })
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
  const assetClasses = [...new Set(securities.map(s => s.asset_class).filter(Boolean))] as string[]
  const sectors = [...new Set(securities.map(s => s.sector).filter(Boolean))] as string[]

  const filteredSecurities = useMemo(() => {
    let list = [...securities]
    if (secSearch.trim()) {
      const q = secSearch.toLowerCase()
      list = list.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    }
    if (secFilter.country) list = list.filter(s => s.country === secFilter.country)
    if (secFilter.currency) list = list.filter(s => s.currency === secFilter.currency)
    if (secFilter.asset_class) list = list.filter(s => s.asset_class === secFilter.asset_class)
    if (secFilter.sector) list = list.filter(s => s.sector === secFilter.sector)
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
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={secSearch} onChange={e => setSecSearch(e.target.value)}
            placeholder="티커 또는 종목명 검색"
            className="w-full pl-7 pr-6 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300" />
          {secSearch && (
            <button onClick={() => setSecSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
        <select value={secFilter.asset_class} onChange={e => setSecFilter(p => ({ ...p, asset_class: e.target.value }))}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-600">
          <option value="">전체 자산군</option>
          {assetClasses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={secFilter.country} onChange={e => setSecFilter(p => ({ ...p, country: e.target.value }))}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-600">
          <option value="">전체 국가</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={secFilter.sector} onChange={e => setSecFilter(p => ({ ...p, sector: e.target.value }))}
          className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-600">
          <option value="">전체 섹터</option>
          {sectors.map(c => <option key={c} value={c}>{c}</option>)}
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
        {(secSearch || secFilter.asset_class || secFilter.country || secFilter.sector || secFilter.currency) && (
          <button onClick={() => { setSecSearch(''); setSecFilter({ country: '', currency: '', asset_class: '', sector: '' }) }}
            className="text-[10px] text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors whitespace-nowrap">
            필터 초기화
          </button>
        )}
        <span className="text-[10px] text-slate-400">{filteredSecurities.length}개</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleRefreshAll} disabled={refreshingAll}
            className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors">
            {refreshingAll ? '수집 중...' : '전체 가격 업데이트'}
          </button>
        </div>
      </div>

      {/* Security cards — 5 columns */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {filteredSecurities.map(s => {
          const { hex } = cardColors(options, s.country, s.asset_class)
          return (
            <div key={s.id}
              onClick={() => setHistoryModalSecurity(s)}
              className="bg-white rounded-xl border-l-2 border border-slate-100 flex flex-col gap-1.5 p-2.5 cursor-pointer hover:shadow-md hover:border-slate-200 hover:bg-slate-50/50 transition-all"
              style={{ borderLeftColor: hex }}>
              {/* Row 1: ticker (left, clickable) + currency (right) */}
              <div className="flex items-center justify-between gap-1">
                {(() => {
                  const lp = latestPrices[s.ticker]
                  const tickerUrl = s.url ? s.url
                    : s.asset_class === '현금'
                      ? 'https://search.naver.com/search.naver?sm=mtb_drt&where=m&query=%EB%AF%B8%EA%B5%AD%ED%99%98%EC%9C%A8'
                    : s.asset_class === '코인'
                      ? `https://www.coingecko.com/en/coins/${s.ticker.toLowerCase()}`
                    : s.country === '국내'
                      ? `https://finance.naver.com/item/main.naver?code=${s.ticker.replace('KRX:', '')}`
                    : (() => {
                        const ex = lp?.exchange
                        const YAHOO_TO_GOOGLE: Record<string, string> = {
                          PCX: 'NYSEARCA', BTS: 'NYSEARCA',
                          NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ', NIM: 'NASDAQ',
                          NYQ: 'NYSE', ASE: 'NYSEAMERICAN', PNK: 'OTCMKTS',
                        }
                        const googleEx = ex ? YAHOO_TO_GOOGLE[ex] : null
                        return googleEx
                          ? `https://www.google.com/finance/quote/${s.ticker}:${googleEx}`
                          : `https://www.google.com/finance/quote/${s.ticker}`
                      })()
                  return tickerUrl ? (
                    <a href={tickerUrl} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono leading-none hover:opacity-75 transition-opacity"
                      style={{ backgroundColor: hex + '15', color: hex }}>
                      {s.ticker}
                    </a>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono leading-none"
                      style={{ backgroundColor: hex + '15', color: hex }}>{s.ticker}</span>
                  )
                })()}
                <span className="text-[10px] text-slate-300 ml-auto">{s.currency}</span>
              </div>
              {/* Row 2: name (left) + price (right) */}
              <div className="flex items-start justify-between gap-1">
                <p className="text-sm font-semibold text-slate-600 line-clamp-2 leading-snug flex-1">{s.name}</p>
                <div className="text-right shrink-0">
                  {latestPrices[s.ticker] ? (() => {
                    const lp = latestPrices[s.ticker]
                    const pct = lp.change_pct
                    const priceColor = pct == null ? 'text-slate-500' : pct > 0 ? 'text-red-500' : pct < 0 ? 'text-blue-500' : 'text-slate-500'
                    return (
                      <>
                        <span className={`text-xs font-semibold font-sans ${priceColor} cursor-default`} title={lp.date}>
                          {lp.currency === 'KRW' ? `${lp.price.toLocaleString()}원` : `$${lp.price.toFixed(2)}`}
                        </span>
                        {pct != null && (
                          <div className={`text-[9px] font-sans ${pct > 0 ? 'text-red-400' : pct < 0 ? 'text-blue-400' : 'text-slate-400'}`}>
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
              <div className="flex items-center gap-0.5 flex-wrap" onClick={e => e.stopPropagation()}>
                {s.asset_class && (
                  <button onClick={() => setSecFilter(p => ({ ...p, asset_class: p.asset_class === s.asset_class ? '' : (s.asset_class ?? '') }))}
                    className="text-[9px] px-1 py-0.5 rounded cursor-pointer hover:opacity-75 transition-opacity"
                    style={{ backgroundColor: hex + '20', color: hex }}>
                    {s.asset_class}
                  </button>
                )}
                {s.country && (
                  <button onClick={() => setSecFilter(p => ({ ...p, country: p.country === s.country ? '' : (s.country ?? '') }))}
                    className="text-[9px] px-1 py-0.5 rounded cursor-pointer hover:opacity-75 transition-opacity"
                    style={{ backgroundColor: hex + '20', color: hex }}>
                    {s.country}
                  </button>
                )}
                {s.sector && (
                  <button onClick={() => setSecFilter(p => ({ ...p, sector: p.sector === s.sector ? '' : (s.sector ?? '') }))}
                    className="text-[9px] text-slate-400 bg-slate-50 px-1 py-0.5 rounded cursor-pointer hover:opacity-75 transition-opacity">
                    {s.sector}
                  </button>
                )}
                <div className="ml-auto flex gap-0.5 items-center">
                  <button onClick={() => syncTicker(s.ticker)} disabled={syncing === s.ticker} title="가격 업데이트"
                    className="p-0.5 rounded hover:bg-slate-100 text-slate-200 hover:text-slate-500 transition-colors disabled:opacity-40">
                    {syncing === s.ticker ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : syncMsg[s.ticker] ? (
                      <span className="text-[10px] font-mono text-slate-400">{syncMsg[s.ticker]}</span>
                    ) : (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                  <button onClick={() => setEditModalSecurity(s)}
                    className="p-0.5 rounded hover:bg-slate-100 text-slate-200 hover:text-slate-500 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => deleteSecurity(s.id)}
                    className="p-0.5 rounded hover:bg-red-50 text-slate-200 hover:text-red-400 transition-colors">
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

      {/* Price History modal */}
      {historyModalSecurity && (() => {
        const s = historyModalSecurity
        const lp = latestPrices[s.ticker]
        const { hex: modalHex } = cardColors(options, s.country, s.asset_class)
        const ex = lp?.exchange
        const YAHOO_TO_GOOGLE: Record<string, string> = {
          PCX: 'NYSEARCA', BTS: 'NYSEARCA', NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ',
          NIM: 'NASDAQ', NYQ: 'NYSE', ASE: 'NYSEAMERICAN', PNK: 'OTCMKTS',
        }
        const modalTickerUrl = s.url ? s.url
          : s.asset_class === '현금' ? 'https://search.naver.com/search.naver?sm=mtb_drt&where=m&query=%EB%AF%B8%EA%B5%AD%ED%99%98%EC%9C%A8'
          : s.asset_class === '코인' ? `https://www.coingecko.com/en/coins/${s.ticker.toLowerCase()}`
          : s.country === '국내' ? `https://finance.naver.com/item/main.naver?code=${s.ticker.replace('KRX:', '')}`
          : ex ? (YAHOO_TO_GOOGLE[ex] ? `https://www.google.com/finance/quote/${s.ticker}:${YAHOO_TO_GOOGLE[ex]}` : `https://www.google.com/finance/quote/${s.ticker}`)
          : `https://www.google.com/finance/quote/${s.ticker}`
        return (
          <PriceHistoryModal
            security={s}
            history={priceHistory[s.ticker] ?? []}
            latestPrice={lp ?? null}
            holdings={holdingsMap[s.id] ?? []}
            hex={modalHex}
            tickerUrl={modalTickerUrl}
            usdKrwRate={latestPrices['KRW=X']?.price ?? null}
            onClose={() => setHistoryModalSecurity(null)}
          />
        )
      })()}

      {/* Add / Edit modal */}
      {(showAddModal || editModalSecurity !== null) && (
        <SecurityModal
          security={editModalSecurity}
          options={options}
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
