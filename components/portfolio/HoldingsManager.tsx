'use client'

import { useState, useMemo, useEffect } from 'react'
import type { Account, Security } from '@/lib/portfolio/types'

interface AccountSecurity { account_id: string; security_id: string }

interface Props {
  accounts: Account[]
  securities: Security[]
  accountSecurities: AccountSecurity[]
}

type Tab = 'accounts' | 'securities'

const COUNTRY_STYLE: Record<string, { badge: string; border: string }> = {
  '국내':  { badge: 'bg-emerald-50 text-emerald-700', border: 'border-l-emerald-400' },
  '미국':  { badge: 'bg-blue-50 text-blue-700',      border: 'border-l-blue-400' },
  '글로벌':{ badge: 'bg-amber-50 text-amber-700',    border: 'border-l-amber-400' },
  '기타':  { badge: 'bg-slate-100 text-slate-500',   border: 'border-l-slate-300' },
}
function countryStyle(country: string | null) {
  return COUNTRY_STYLE[country ?? ''] ?? { badge: 'bg-slate-100 text-slate-500', border: 'border-l-slate-200' }
}

// ─── Security Modal (add & edit) ─────────────────────────────────────────────
function SecurityModal({ security, onSave, onClose }: {
  security: Security | null   // null = add mode
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

// ─── Main Component ──────────────────────────────────────────────────────────
export default function HoldingsManager({ accounts: initAccounts, securities: initSecurities, accountSecurities: initLinks }: Props) {
  const [tab, setTab] = useState<Tab>('accounts')
  const [accounts, setAccounts] = useState(initAccounts)
  const [securities, setSecurities] = useState(initSecurities)
  const [links, setLinks] = useState<AccountSecurity[]>(initLinks)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Account UI
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [accountForm, setAccountForm] = useState({ name: '', broker: '', owner: '', type: '종합위탁' })

  // Link UI — pending (unsaved) state
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [linkSearch, setLinkSearch] = useState('')
  const [savingLinks, setSavingLinks] = useState(false)

  // Security UI
  const [editModalSecurity, setEditModalSecurity] = useState<Security | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [secSearch, setSecSearch] = useState('')
  const [secFilter, setSecFilter] = useState<{ country: string; currency: string }>({ country: '', currency: '' })
  const [secSort, setSecSort] = useState<'ticker' | 'name' | 'country'>('ticker')

  // When selected account changes, reset pendingIds from current links
  useEffect(() => {
    if (!selectedAccountId) return
    const current = new Set(links.filter(l => l.account_id === selectedAccountId).map(l => l.security_id))
    setPendingIds(current)
    setLinkSearch('')
  }, [selectedAccountId, links])

  const isDirty = useMemo(() => {
    if (!selectedAccountId) return false
    const saved = new Set(links.filter(l => l.account_id === selectedAccountId).map(l => l.security_id))
    if (saved.size !== pendingIds.size) return true
    for (const id of pendingIds) if (!saved.has(id)) return true
    return false
  }, [selectedAccountId, pendingIds, links])

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

  // --- Save pending link changes ---
  async function saveLinks() {
    if (!selectedAccountId) return
    setSavingLinks(true)
    try {
      await apiFetch('/api/portfolio/account-securities', 'PUT', {
        account_id: selectedAccountId,
        security_ids: [...pendingIds],
      })
      setLinks(prev => {
        const withoutAccount = prev.filter(l => l.account_id !== selectedAccountId)
        return [...withoutAccount, ...[...pendingIds].map(sid => ({ account_id: selectedAccountId!, security_id: sid }))]
      })
      notify(`저장 완료 (${pendingIds.size}종목 연결됨)`)
    } catch (e: unknown) { notify(e instanceof Error ? e.message : '오류', false) }
    finally { setSavingLinks(false) }
  }

  // --- Account CRUD ---
  async function saveAccount() {
    try {
      if (editingAccountId) {
        const updated = await apiFetch('/api/portfolio/accounts', 'PATCH', { id: editingAccountId, ...accountForm })
        setAccounts(prev => prev.map(a => a.id === editingAccountId ? updated : a))
        notify('계좌 수정 완료'); setEditingAccountId(null)
      } else {
        const created = await apiFetch('/api/portfolio/accounts', 'POST', { ...accountForm, currency: 'KRW' })
        setAccounts(prev => [...prev, created])
        notify('계좌 추가 완료'); setShowAddAccount(false)
      }
    } catch (e: unknown) { notify(e instanceof Error ? e.message : '오류', false) }
  }

  async function deleteAccount(id: string) {
    if (!confirm('계좌를 삭제하시겠습니까?')) return
    try {
      await apiFetch(`/api/portfolio/accounts?id=${id}`, 'DELETE')
      setAccounts(prev => prev.filter(a => a.id !== id))
      setLinks(prev => prev.filter(l => l.account_id !== id))
      if (selectedAccountId === id) setSelectedAccountId(null)
      notify('계좌 삭제 완료')
    } catch (e: unknown) { notify(e instanceof Error ? e.message : '오류', false) }
  }

  // --- Security CRUD ---
  async function deleteSecurity(id: string) {
    if (!confirm('종목을 삭제하시겠습니까?')) return
    try {
      await apiFetch(`/api/portfolio/securities?id=${id}`, 'DELETE')
      setSecurities(prev => prev.filter(s => s.id !== id))
      setLinks(prev => prev.filter(l => l.security_id !== id))
      notify('종목 삭제 완료')
    } catch (e: unknown) { notify(e instanceof Error ? e.message : '오류', false) }
  }

  // --- Filtered/sorted securities for the securities tab ---
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
      return (a.country ?? '').localeCompare(b.country ?? '')
    })
    return list
  }, [securities, secSearch, secFilter, secSort])

  // --- Filtered securities for the link checklist ---
  const filteredLinkSecurities = useMemo(() => {
    let list = [...securities]
    if (linkSearch.trim()) {
      const q = linkSearch.toLowerCase()
      list = list.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    }
    // 연결된 종목 먼저, 그다음 ticker 순
    return list.sort((a, b) => {
      const aLinked = pendingIds.has(a.id) ? 0 : 1
      const bLinked = pendingIds.has(b.id) ? 0 : 1
      if (aLinked !== bLinked) return aLinked - bLinked
      return a.ticker.localeCompare(b.ticker)
    })
  }, [securities, linkSearch, pendingIds])

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300'
  const labelCls = 'block text-xs text-slate-500 mb-1'
  const selectedAccount = accounts.find(a => a.id === selectedAccountId)

  const countries = [...new Set(securities.map(s => s.country).filter(Boolean))] as string[]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {(['accounts', 'securities'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {t === 'accounts' ? '계좌' : '종목'}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`px-4 py-2 rounded-lg text-sm ${msg.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* ===== Accounts Tab ===== */}
      {tab === 'accounts' && (
        <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 240px)' }}>
          {/* Left: account list */}
          <div className="w-56 shrink-0 flex flex-col gap-1.5">
            {accounts.map(a => (
              <div key={a.id}
                onClick={() => { setSelectedAccountId(a.id); setEditingAccountId(null); setShowAddAccount(false) }}
                className={`rounded-xl border p-3 cursor-pointer transition-all shrink-0 ${selectedAccountId === a.id ? 'bg-slate-700 border-slate-700' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs font-semibold ${selectedAccountId === a.id ? 'text-white' : 'text-slate-800'}`}>{a.name}</span>
                      {a.type && <span className={`text-[9px] px-1 py-0.5 rounded ${selectedAccountId === a.id ? 'bg-white/20 text-white/70' : 'bg-slate-100 text-slate-500'}`}>{a.type}</span>}
                    </div>
                    <p className={`text-[10px] mt-0.5 ${selectedAccountId === a.id ? 'text-slate-300' : 'text-slate-400'}`}>{a.broker}</p>
                    <p className={`text-[9px] mt-1 ${selectedAccountId === a.id ? 'text-slate-400' : 'text-slate-300'}`}>
                      {links.filter(l => l.account_id === a.id).length}종목 연결됨
                    </p>
                  </div>
                  <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingAccountId(a.id); setAccountForm({ name: a.name, broker: a.broker, owner: a.owner ?? '', type: a.type ?? '종합위탁' }); setShowAddAccount(false) }}
                      className={`p-1 rounded ${selectedAccountId === a.id ? 'hover:bg-white/20 text-white/60 hover:text-white' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => deleteAccount(a.id)}
                      className={`p-1 rounded ${selectedAccountId === a.id ? 'hover:bg-red-500/30 text-white/60 hover:text-red-300' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'}`}>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {showAddAccount ? (
              <div className="bg-white rounded-xl border border-blue-100 p-3 space-y-2 shrink-0">
                {[
                  { key: 'name', label: '계좌명 *', placeholder: '종합위탁' },
                  { key: 'broker', label: '금융사 *', placeholder: '카카오페이' },
                  { key: 'owner', label: '소유자', placeholder: '' },
                ].map(f => (
                  <div key={f.key}>
                    <label className={labelCls}>{f.label}</label>
                    <input value={(accountForm as any)[f.key]}
                      onChange={e => setAccountForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} className={inputCls} />
                  </div>
                ))}
                <div><label className={labelCls}>유형</label>
                  <select value={accountForm.type} onChange={e => setAccountForm(p => ({ ...p, type: e.target.value }))} className={inputCls}>
                    {['종합위탁','연금저축','ISA','IRP','예금','CMA'].map(t => <option key={t}>{t}</option>)}
                  </select></div>
                <div className="flex gap-1.5">
                  <button onClick={saveAccount} className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800">추가</button>
                  <button onClick={() => setShowAddAccount(false)} className="text-slate-500 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-100">취소</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setShowAddAccount(true); setSelectedAccountId(null); setEditingAccountId(null) }}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-slate-200 text-slate-400 hover:text-slate-600 text-xs transition-colors shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>계좌 추가
              </button>
            )}
          </div>

          {/* Right panel */}
          <div className="flex-1 min-w-0">
            {editingAccountId ? (
              <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-700">계좌 수정</p>
                <div className="grid grid-cols-2 gap-3">
                  {[{key:'name',label:'계좌명 *'},{key:'broker',label:'금융사 *'},{key:'owner',label:'소유자'}].map(f => (
                    <div key={f.key}><label className={labelCls}>{f.label}</label>
                      <input value={(accountForm as any)[f.key]} onChange={e => setAccountForm(p => ({ ...p, [f.key]: e.target.value }))} className={inputCls} /></div>
                  ))}
                  <div><label className={labelCls}>유형</label>
                    <select value={accountForm.type} onChange={e => setAccountForm(p => ({ ...p, type: e.target.value }))} className={inputCls}>
                      {['종합위탁','연금저축','ISA','IRP','예금','CMA'].map(t => <option key={t}>{t}</option>)}
                    </select></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveAccount} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800">저장</button>
                  <button onClick={() => setEditingAccountId(null)} className="text-slate-500 px-4 py-2 rounded-lg text-sm hover:bg-slate-100">취소</button>
                </div>
              </div>
            ) : selectedAccount ? (
              <div className="bg-white rounded-xl border border-slate-100 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-semibold text-slate-800">{selectedAccount.name}</h3>
                    <p className="text-xs text-slate-400">{selectedAccount.broker}{selectedAccount.type ? ` · ${selectedAccount.type}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDirty && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">미저장</span>
                    )}
                    <button onClick={saveLinks} disabled={!isDirty || savingLinks}
                      className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors">
                      {savingLinks ? '저장 중...' : '저장하기'}
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <div className="relative">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      value={linkSearch}
                      onChange={e => setLinkSearch(e.target.value)}
                      placeholder="티커 또는 종목명 검색"
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    {pendingIds.size}종목 선택됨 · {filteredLinkSecurities.length}개 표시
                  </p>
                </div>

                {/* Checklist — fills remaining height */}
                <div className="flex-1 overflow-y-auto">
                  {filteredLinkSecurities.map(s => {
                    const checked = pendingIds.has(s.id)
                    const cs = countryStyle(s.country)
                    return (
                      <label key={s.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            setPendingIds(prev => {
                              const next = new Set(prev)
                              e.target.checked ? next.add(s.id) : next.delete(s.id)
                              return next
                            })
                          }}
                          className="w-3.5 h-3.5 rounded accent-slate-700 cursor-pointer shrink-0"
                        />
                        <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0">{s.ticker}</span>
                        <span className="text-xs text-slate-700 flex-1 min-w-0 truncate">{s.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${cs.badge}`}>{s.country}</span>
                        <span className="text-[9px] text-slate-400 shrink-0">{s.currency}</span>
                      </label>
                    )
                  })}
                  {filteredLinkSecurities.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-8">검색 결과가 없습니다</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-slate-400">
                왼쪽에서 계좌를 선택하세요
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Securities Tab ===== */}
      {tab === 'securities' && (
        <div className="space-y-3">
          {/* Search + filter + sort bar */}
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
            <select value={secSort} onChange={e => setSecSort(e.target.value as any)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 text-slate-600">
              <option value="ticker">티커순</option>
              <option value="name">이름순</option>
              <option value="country">국가순</option>
            </select>
            <span className="text-[10px] text-slate-400">{filteredSecurities.length}개</span>
          </div>

          {/* Security cards — 5 columns, ~70% height ratio */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {filteredSecurities.map(s => {
              const cs = countryStyle(s.country)
              return (
                <div key={s.id}
                  className={`bg-white rounded-xl border-l-2 border border-slate-100 ${cs.border} flex flex-col justify-between p-3 hover:shadow-sm transition-all`}
                  style={{ aspectRatio: '10/7' }}>
                  <div>
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-1.5 py-0.5 rounded font-mono leading-none">{s.ticker}</span>
                      <span className="text-[10px] text-slate-400">{s.currency}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 line-clamp-2 leading-snug">{s.name}</p>
                  </div>
                  <div>
                    <div className="flex flex-wrap gap-0.5 mb-1.5">
                      {s.country && <span className={`text-[9px] px-1 py-0.5 rounded ${cs.badge}`}>{s.country}</span>}
                      {s.sector && <span className="text-[9px] text-slate-500 bg-slate-50 px-1 py-0.5 rounded">{s.sector}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-blue-500 hover:underline">링크 ↗</a>
                      ) : s.country === '국내' ? (
                        <a href={`https://finance.naver.com/item/main.naver?code=${s.ticker}`} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-blue-500 hover:underline">네이버 ↗</a>
                      ) : <span />}
                      <div className="flex gap-0.5">
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
                </div>
              )
            })}

            {/* Add card */}
            <button onClick={() => setShowAddModal(true)}
              style={{ aspectRatio: '10/7' }}
              className="bg-white rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors">
              <svg className="w-4 h-4 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs">추가</span>
            </button>
          </div>
        </div>
      )}

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
