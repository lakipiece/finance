'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Account, Security } from '@/lib/portfolio/types'

interface AccountSecurity { account_id: string; security_id: string }

type OptionItem = { id: string; label: string; value: string; color_hex: string | null }

interface Props {
  accounts: Account[]
  securities: Security[]
  accountSecurities: AccountSecurity[]
  typeColors?: Record<string, string>
  accountTypeOptions?: OptionItem[]
}

const COUNTRY_STYLE: Record<string, { badge: string; border: string }> = {
  '국내':  { badge: 'bg-emerald-50 text-emerald-700', border: 'border-l-emerald-400' },
  '미국':  { badge: 'bg-blue-50 text-blue-700',      border: 'border-l-blue-400' },
  '글로벌':{ badge: 'bg-amber-50 text-amber-700',    border: 'border-l-amber-400' },
  '기타':  { badge: 'bg-slate-100 text-slate-500',   border: 'border-l-slate-300' },
}
function countryStyle(country: string | null) {
  return COUNTRY_STYLE[country ?? ''] ?? { badge: 'bg-slate-100 text-slate-500', border: 'border-l-slate-200' }
}

function SortableAccountItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button {...attributes} {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500 touch-none shrink-0"
        tabIndex={-1}>
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm8-16a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z"/>
        </svg>
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

export default function AccountsManager({ accounts: initAccounts, securities, accountSecurities: initLinks, typeColors = {}, accountTypeOptions = [] }: Props) {
  const [accounts, setAccounts] = useState(initAccounts)
  const [links, setLinks] = useState<AccountSecurity[]>(initLinks)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [accountForm, setAccountForm] = useState({ name: '', broker: '', owner: '', type_id: '' })

  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [linkSearch, setLinkSearch] = useState('')
  const [savingLinks, setSavingLinks] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = accounts.findIndex(a => a.id === active.id)
    const newIndex = accounts.findIndex(a => a.id === over.id)
    const reordered = arrayMove(accounts, oldIndex, newIndex)
    setAccounts(reordered)
    await fetch('/api/portfolio/accounts/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reordered.map((a, i) => ({ id: a.id, sort_order: i }))),
    })
  }

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

  async function saveAccount() {
    try {
      if (editingAccountId) {
        const updated = await apiFetch('/api/portfolio/accounts', 'PATCH', { id: editingAccountId, ...accountForm })
        setAccounts(prev => prev.map(a => a.id === editingAccountId ? updated : a))
        notify('계좌 수정 완료'); setEditingAccountId(null)
      } else {
        const created = await apiFetch('/api/portfolio/accounts', 'POST', { ...accountForm })
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

  const filteredLinkSecurities = useMemo(() => {
    let list = [...securities]
    if (linkSearch.trim()) {
      const q = linkSearch.toLowerCase()
      list = list.filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    }
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {msg && (
        <div className={`px-4 py-2 rounded-lg text-sm ${msg.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 240px)' }}>
        {/* Left: account list */}
        <div className="w-56 shrink-0 flex flex-col gap-1.5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={accounts.map(a => a.id)} strategy={verticalListSortingStrategy}>
              {accounts.map(a => (
                <SortableAccountItem key={a.id} id={a.id}>
                  <div
                    onClick={() => { setSelectedAccountId(a.id); setEditingAccountId(null); setShowAddAccount(false) }}
                    className={`rounded-xl border-l-[3px] border border-slate-100 p-3 cursor-pointer transition-all shrink-0 ${selectedAccountId === a.id ? 'bg-slate-700 !border-slate-700' : 'bg-white hover:border-slate-200'}`}
                    style={{ borderLeftColor: selectedAccountId !== a.id ? (typeColors[a.type ?? ''] ?? '#e2e8f0') : undefined }}>
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-xs font-semibold ${selectedAccountId === a.id ? 'text-white' : 'text-slate-800'}`}>{a.name}</span>
                          {a.type && (
                            <span className="text-[9px] px-1 py-0.5 rounded"
                              style={selectedAccountId === a.id
                                ? { backgroundColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)' }
                                : { backgroundColor: (typeColors[a.type] ?? '#94a3b8') + '20', color: typeColors[a.type] ?? '#94a3b8' }
                              }>{a.type}</span>
                          )}
                        </div>
                        <p className={`text-[10px] mt-0.5 ${selectedAccountId === a.id ? 'text-slate-300' : 'text-slate-400'}`}>{a.broker}</p>
                        <p className={`text-[9px] mt-1 ${selectedAccountId === a.id ? 'text-slate-400' : 'text-slate-300'}`}>
                          {links.filter(l => l.account_id === a.id).length}종목 연결됨
                        </p>
                      </div>
                      <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => { setEditingAccountId(a.id); setAccountForm({ name: a.name, broker: a.broker, owner: a.owner ?? '', type_id: a.type_id ?? '' }); setShowAddAccount(false) }}
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
                </SortableAccountItem>
              ))}
            </SortableContext>
          </DndContext>

          {showAddAccount ? (
            <div className="bg-white rounded-xl border border-blue-100 p-3 space-y-2 shrink-0">
              {[
                { key: 'name', label: '계좌명 *', placeholder: '종합위탁' },
                { key: 'broker', label: '금융사 *', placeholder: '카카오페이' },
                { key: 'owner', label: '소유자', placeholder: '' },
              ].map(f => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input value={accountForm[f.key as keyof typeof accountForm]}
                    onChange={e => setAccountForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className={inputCls} />
                </div>
              ))}
              <div><label className={labelCls}>유형</label>
                <select value={accountForm.type_id} onChange={e => setAccountForm(p => ({ ...p, type_id: e.target.value }))} className={inputCls}>
                  <option value="">선택 안함</option>
                  {accountTypeOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
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
                    <input value={accountForm[f.key as keyof typeof accountForm]} onChange={e => setAccountForm(p => ({ ...p, [f.key]: e.target.value }))} className={inputCls} /></div>
                ))}
                <div><label className={labelCls}>유형</label>
                  <select value={accountForm.type} onChange={e => setAccountForm(p => ({ ...p, type: e.target.value }))} className={inputCls}>
                    {accountTypes.map(t => <option key={t}>{t}</option>)}
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

              {/* Checklist */}
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
    </div>
  )
}
