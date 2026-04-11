'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  rectSortingStrategy, arrayMove,
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

const COUNTRY_BADGE: Record<string, string> = {
  '국내':  'bg-emerald-50 text-emerald-700',
  '미국':  'bg-blue-50 text-blue-700',
  '글로벌':'bg-amber-50 text-amber-700',
  '기타':  'bg-slate-100 text-slate-500',
}
function countryBadge(country: string | null) {
  return COUNTRY_BADGE[country ?? ''] ?? 'bg-slate-100 text-slate-500'
}

function SortableAccountCard({
  id, account, linkedCount, typeColors, onCardClick, onEdit, onDelete,
}: {
  id: string; account: Account; linkedCount: number; typeColors: Record<string, string>
  onCardClick: () => void; onEdit: () => void; onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const typeColor = typeColors[account.type ?? ''] ?? '#e2e8f0'

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <div onClick={onCardClick}
        className="bg-white rounded-2xl border border-slate-100 p-3 cursor-pointer hover:shadow-md transition-all group"
        style={{ borderLeft: `3px solid ${typeColor}` }}>
        {/* 상단: 핸들(좌) + 뱃지(우) */}
        <div className="flex items-center justify-between mb-1.5">
          <button {...attributes} {...listeners} onClick={e => e.stopPropagation()} tabIndex={-1}
            className="cursor-grab active:cursor-grabbing text-slate-200 hover:text-slate-400 touch-none shrink-0">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 6a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm8-16a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z"/>
            </svg>
          </button>
          {account.type && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: typeColor + '20', color: typeColor }}>
              {account.type}
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-slate-800 leading-tight">{account.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{account.broker}</p>
        {account.owner && <p className="text-[11px] text-slate-300 mt-0.5">{account.owner}</p>}
        {/* 하단: 종목수(좌) + 편집/삭제 hover(우) */}
        <div className="flex items-center justify-between mt-3">
          <p className="text-[11px] text-slate-400">
            <span className="font-semibold text-slate-600">{linkedCount}</span>종목
          </p>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <button onClick={onEdit} className="p-1 rounded-lg hover:bg-slate-100 text-slate-300 hover:text-slate-600">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={onDelete} className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AccountsManager({ accounts: initAccounts, securities, accountSecurities: initLinks, typeColors = {}, accountTypeOptions = [] }: Props) {
  const [accounts, setAccounts] = useState(initAccounts)
  const [links, setLinks] = useState<AccountSecurity[]>(initLinks)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const [modalLinkAccountId, setModalLinkAccountId] = useState<string | null>(null)
  const [showDirtyAlert, setShowDirtyAlert] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!modalLinkAccountId) return
    const current = new Set(links.filter(l => l.account_id === modalLinkAccountId).map(l => l.security_id))
    setPendingIds(current)
    setLinkSearch('')
  }, [modalLinkAccountId])

  const isDirty = useMemo(() => {
    if (!modalLinkAccountId) return false
    const saved = new Set(links.filter(l => l.account_id === modalLinkAccountId).map(l => l.security_id))
    if (saved.size !== pendingIds.size) return true
    for (const id of pendingIds) if (!saved.has(id)) return true
    return false
  }, [modalLinkAccountId, pendingIds, links])

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

  function handleModalClose() {
    if (isDirty) { setShowDirtyAlert(true) } else { setModalLinkAccountId(null) }
  }

  function discardAndClose() {
    if (modalLinkAccountId) {
      const saved = new Set(links.filter(l => l.account_id === modalLinkAccountId).map(l => l.security_id))
      setPendingIds(saved)
    }
    setShowDirtyAlert(false)
    setModalLinkAccountId(null)
  }

  async function saveLinks() {
    if (!modalLinkAccountId) return
    setSavingLinks(true)
    try {
      await apiFetch('/api/portfolio/account-securities', 'PUT', {
        account_id: modalLinkAccountId,
        security_ids: [...pendingIds],
      })
      setLinks(prev => {
        const withoutAccount = prev.filter(l => l.account_id !== modalLinkAccountId)
        return [...withoutAccount, ...[...pendingIds].map(sid => ({ account_id: modalLinkAccountId!, security_id: sid }))]
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
        notify('계좌 추가 완료'); setShowAddModal(false)
      }
    } catch (e: unknown) { notify(e instanceof Error ? e.message : '오류', false) }
  }

  async function deleteAccount(id: string) {
    if (!confirm('계좌를 삭제하시겠습니까?')) return
    try {
      await apiFetch(`/api/portfolio/accounts?id=${id}`, 'DELETE')
      setAccounts(prev => prev.filter(a => a.id !== id))
      setLinks(prev => prev.filter(l => l.account_id !== id))
      if (modalLinkAccountId === id) setModalLinkAccountId(null)
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
  const modalAccount = accounts.find(a => a.id === modalLinkAccountId)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${msg.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-slate-700">계좌 관리</h2>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={accounts.map(a => a.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {accounts.map(a => (
              <SortableAccountCard
                key={a.id} id={a.id} account={a}
                linkedCount={links.filter(l => l.account_id === a.id).length}
                typeColors={typeColors}
                onCardClick={() => setModalLinkAccountId(a.id)}
                onEdit={() => { setEditingAccountId(a.id); setAccountForm({ name: a.name, broker: a.broker, owner: a.owner ?? '', type_id: a.type_id ?? '' }) }}
                onDelete={() => deleteAccount(a.id)}
              />
            ))}
            {/* 추가 카드 */}
            <button
              onClick={() => { setShowAddModal(true); setAccountForm({ name: '', broker: '', owner: '', type_id: '' }) }}
              className="bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors min-h-[120px]">
              <svg className="w-4 h-4 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs">추가</span>
            </button>
          </div>
        </SortableContext>
      </DndContext>

      {/* Link Modal */}
      {modalLinkAccountId && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
          onClick={handleModalClose}>
          <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl"
            style={{ maxHeight: '82vh' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="font-semibold text-slate-800">{modalAccount?.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{modalAccount?.broker}{modalAccount?.type ? ` · ${modalAccount.type}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {isDirty && <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">미저장</span>}
                <button onClick={saveLinks} disabled={!isDirty || savingLinks}
                  className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-40">
                  {savingLinks ? '저장 중...' : '저장하기'}
                </button>
                <button onClick={handleModalClose}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-5 py-3 border-b border-slate-100 shrink-0">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                  placeholder="티커 또는 종목명 검색"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">{pendingIds.size}종목 선택됨 · {filteredLinkSecurities.length}개 표시</p>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {filteredLinkSecurities.map(s => {
                const checked = pendingIds.has(s.id)
                const badge = countryBadge(s.country)
                return (
                  <label key={s.id}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50">
                    <input type="checkbox" checked={checked}
                      onChange={e => setPendingIds(prev => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(s.id) : next.delete(s.id)
                        return next
                      })}
                      className="w-3.5 h-3.5 rounded accent-slate-700 cursor-pointer shrink-0" />
                    <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0">{s.ticker}</span>
                    <span className="text-xs text-slate-700 flex-1 min-w-0 truncate">{s.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${badge}`}>{s.country}</span>
                    <span className="text-[9px] text-slate-400 shrink-0">{s.currency}</span>
                  </label>
                )
              })}
              {filteredLinkSecurities.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">검색 결과가 없습니다</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dirty Alert */}
      {showDirtyAlert && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <p className="text-sm font-semibold text-slate-800">저장하지 않은 변경사항</p>
            <p className="text-xs text-slate-500 mt-1.5">연결 종목을 수정했지만 저장하지 않았습니다.</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowDirtyAlert(false)}
                className="flex-1 bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-800">
                계속 편집
              </button>
              <button onClick={discardAndClose}
                className="flex-1 text-slate-500 px-4 py-2 rounded-lg text-xs hover:bg-slate-100 border border-slate-200">
                저장안함
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Account Modal */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-700 mb-4">계좌 추가</p>
            <div className="space-y-3">
              {[{key:'name',label:'계좌명 *',placeholder:'종합위탁'},{key:'broker',label:'금융사 *',placeholder:'카카오페이'},{key:'owner',label:'소유자',placeholder:''}].map(f => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input value={accountForm[f.key as keyof typeof accountForm]}
                    onChange={e => setAccountForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className={inputCls} />
                </div>
              ))}
              <div>
                <label className={labelCls}>유형</label>
                <select value={accountForm.type_id} onChange={e => setAccountForm(p => ({ ...p, type_id: e.target.value }))} className={inputCls}>
                  <option value="">선택 안함</option>
                  {accountTypeOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveAccount} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-800">추가</button>
                <button onClick={() => setShowAddModal(false)} className="text-slate-500 px-4 py-2 rounded-lg text-xs hover:bg-slate-100">취소</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Account Modal */}
      {editingAccountId && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setEditingAccountId(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-700 mb-4">계좌 수정</p>
            <div className="space-y-3">
              {[{key:'name',label:'계좌명 *'},{key:'broker',label:'금융사 *'},{key:'owner',label:'소유자'}].map(f => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input value={accountForm[f.key as keyof typeof accountForm]}
                    onChange={e => setAccountForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className={inputCls} />
                </div>
              ))}
              <div>
                <label className={labelCls}>유형</label>
                <select value={accountForm.type_id} onChange={e => setAccountForm(p => ({ ...p, type_id: e.target.value }))} className={inputCls}>
                  <option value="">선택 안함</option>
                  {accountTypeOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveAccount} className="bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-800">수정</button>
                <button onClick={() => setEditingAccountId(null)} className="text-slate-500 px-4 py-2 rounded-lg text-xs hover:bg-slate-100">취소</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
