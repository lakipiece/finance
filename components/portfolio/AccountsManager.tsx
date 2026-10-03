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
import { btn, field, badge, modal, color as tone } from '@/lib/styles'
import PageHeader from '@/components/ui/PageHeader'
import MemoTip from '@/components/ui/MemoTip'
import CashflowPanel from './CashflowPanel'
import Select from '@/components/ui/Select'
import { tintBadgeStyle } from '@/lib/palettes'

interface AccountSecurity { account_id: string; security_id: string }
type OptionItem = { id: string; label: string; value: string; color_hex: string | null }

interface Props {
  accounts: Account[]
  securities: Security[]
  accountSecurities: AccountSecurity[]
  typeColors?: Record<string, string>
  accountTypeOptions?: OptionItem[]
  sectorColors?: Record<string, string>
  countryColors?: Record<string, string>
  currencyColors?: Record<string, string>
  /** 계좌별 실시간 평가액 (입출금 탭의 실질수익 계산용) */
  accountValues?: Record<string, number>
}

type ModalTab = 'securities' | 'cashflows'


function SortableAccountCard({
  id, account, linkedCount, typeColors, onCardClick, onEdit, onArchive, onDelete,
}: {
  id: string; account: Account; linkedCount: number; typeColors: Record<string, string>
  onCardClick: () => void; onEdit: () => void; onArchive: () => void; onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const typeColor = typeColors[account.type ?? ''] ?? tone.surfaceContainer

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <div className="flex bg-surface-card rounded-card overflow-hidden group hover:shadow-card hover:-translate-y-0.5 transition-all min-h-[110px]">
        {/* 왼쪽 색상 바 = 드래그 핸들 (배지와 같은 색) */}
        <div {...attributes} {...listeners}
          onClick={e => e.stopPropagation()}
          className="w-1.5 shrink-0 cursor-grab active:cursor-grabbing rounded-l-2xl"
          style={{ backgroundColor: typeColor }} />
        {/* 카드 내용 */}
        <div onClick={onCardClick} className="flex-1 p-3 cursor-pointer flex flex-col min-w-0">
          {/* 이름 + 뱃지 */}
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <p className="text-subhead font-bold text-ink leading-tight flex-1 min-w-0"><MemoTip memo={account.memo}>{account.name}</MemoTip></p>
            {account.type ? <span className="text-micro tracking-normal px-1.5 py-0.5 rounded-full font-medium shrink-0"
                style={tintBadgeStyle(typeColor)}>
                {account.type}
              </span> : null}
          </div>
          <p className="text-body text-ink-4">{account.broker}</p>
          {account.owner ? <p className="text-body text-ink-5 mt-0.5">{account.owner}</p> : null}
          {/* 하단: 종목수(좌) + 편집/삭제 hover(우) */}
          <div className="flex items-center justify-between mt-auto pt-2">
            <p className="text-body text-ink-4">
              <span className="font-medium text-ink-2">{linkedCount}</span>종목
            </p>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              <button onClick={onEdit} className={btn.icon}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button onClick={onArchive} className={btn.icon} title="보관 — 목록에서 숨김 (이력은 유지)">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </button>
              <button onClick={onDelete} className={btn.danger}>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AccountsManager({ accounts: initAccounts, securities, accountSecurities: initLinks, typeColors = {}, accountTypeOptions = [], sectorColors = {}, countryColors = {}, currencyColors = {}, accountValues = {} }: Props) {
  const [accounts, setAccounts] = useState(initAccounts)
  const [links, setLinks] = useState<AccountSecurity[]>(initLinks)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [liveTypeOptions, setLiveTypeOptions] = useState<OptionItem[]>(accountTypeOptions)

  const [modalLinkAccountId, setModalLinkAccountId] = useState<string | null>(null)
  const [modalTab, setModalTab] = useState<ModalTab>('securities')
  const [showDirtyAlert, setShowDirtyAlert] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [accountForm, setAccountForm] = useState({
    name: '', broker: '', owner: '', type_id: '',
    dividend_eligible: true,
    dividend_tax_rate: '' as string,
    memo: '',
  })

  // 모달 열릴 때 최신 계좌유형 옵션 로드
  useEffect(() => {
    if (!showAddModal && !editingAccountId) return
    fetch('/api/portfolio/options')
      .then(r => r.json())
      .then((data: Record<string, OptionItem[]>) => {
        if (data.account_type) setLiveTypeOptions(data.account_type)
      })
      .catch(() => {})
  }, [showAddModal, editingAccountId])

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
    if (!modalLinkAccountId) return
    const current = new Set(links.filter(l => l.account_id === modalLinkAccountId).map(l => l.security_id))
    setPendingIds(current)
    setLinkSearch('')
    setModalTab('securities')
  // 모달을 열 때만 초기화한다 — links가 바뀔 때마다 편집 중인 선택을 덮어쓰면 안 됨
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const payload = {
        ...accountForm,
        memo: accountForm.memo.trim() || null,
        dividend_tax_rate: accountForm.dividend_tax_rate.trim() === ''
          ? null
          : Number(accountForm.dividend_tax_rate),
      }
      if (editingAccountId) {
        const updated = await apiFetch('/api/portfolio/accounts', 'PATCH', { id: editingAccountId, ...payload })
        setAccounts(prev => prev.map(a => a.id === editingAccountId ? updated : a))
        notify('계좌 수정 완료'); setEditingAccountId(null)
      } else {
        const created = await apiFetch('/api/portfolio/accounts', 'POST', payload)
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

  async function setAccountArchived(id: string, archived: boolean) {
    try {
      const updated = await apiFetch('/api/portfolio/accounts', 'PATCH', {
        id, archived_at: archived ? new Date().toISOString() : null,
      })
      setAccounts(prev => prev.map(a => a.id === id ? updated : a))
      notify(archived ? '계좌 보관 — 목록에서 숨겼습니다' : '계좌 복원 완료')
    } catch (e: unknown) { notify(e instanceof Error ? e.message : '오류', false) }
  }

  const activeAccounts = useMemo(() => accounts.filter(a => !a.archived_at), [accounts])
  const archivedAccounts = useMemo(() => accounts.filter(a => a.archived_at), [accounts])
  const [showArchived, setShowArchived] = useState(false)

  const filteredLinkSecurities = useMemo(() => {
    // 보관된 종목은 새로 연결할 대상이 아니다 — 이미 연결된 것만 해제할 수 있게 남긴다
    let list = securities.filter(s => !s.archived_at || pendingIds.has(s.id))
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

  const modalAccount = accounts.find(a => a.id === modalLinkAccountId)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {msg ? <div className={`mb-4 px-4 py-2 rounded-btn text-subhead ${msg.ok ? 'bg-income/10 text-income' : 'bg-gain/10 text-gain'}`}>
          {msg.text}
        </div> : null}

      <PageHeader title="계좌 관리" description="연결 계좌 및 종목 배분 관리" />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeAccounts.map(a => a.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {activeAccounts.map(a => (
              <SortableAccountCard
                key={a.id} id={a.id} account={a}
                linkedCount={links.filter(l => l.account_id === a.id).length}
                typeColors={typeColors}
                onCardClick={() => setModalLinkAccountId(a.id)}
                onEdit={() => { setEditingAccountId(a.id); setAccountForm({
                  name: a.name, broker: a.broker, owner: a.owner ?? '', type_id: a.type_id ?? '',
                  dividend_eligible: a.dividend_eligible ?? true,
                  dividend_tax_rate: a.dividend_tax_rate != null ? String(a.dividend_tax_rate) : '',
                  memo: a.memo ?? '',
                }) }}
                onArchive={() => setAccountArchived(a.id, true)}
                onDelete={() => deleteAccount(a.id)}
              />
            ))}
            {/* 추가 카드 */}
            <button
              onClick={() => { setShowAddModal(true); setAccountForm({
                name: '', broker: '', owner: '', type_id: '',
                dividend_eligible: true, dividend_tax_rate: '', memo: '',
              }) }}
              className="bg-surface-low hover:bg-surface-container rounded-card flex flex-col items-center justify-center text-ink-4 hover:text-ink-2 transition-colors min-h-[110px]">
              <svg className="w-4 h-4 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-body">추가</span>
            </button>
          </div>
        </SortableContext>
      </DndContext>

      {/* 보관된 계좌 — 이력은 스냅샷·배당·입출금에 그대로 남는다 */}
      {archivedAccounts.length > 0 ? (
        <div>
          <button type="button" onClick={() => setShowArchived(v => !v)}
            className="text-meta font-medium text-ink-4 hover:text-ink-2 transition-colors">
            보관된 계좌 {archivedAccounts.length}개 {showArchived ? '숨기기' : '보기'}
          </button>
          {showArchived ? (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {archivedAccounts.map(a => (
                <div key={a.id} className="bg-surface-low rounded-card p-3 flex flex-col gap-1 min-w-0">
                  <p className="text-subhead font-medium text-ink-3 truncate"><MemoTip memo={a.memo}>{a.name}</MemoTip></p>
                  <p className="text-body text-ink-4 truncate">{a.broker}</p>
                  <button type="button" onClick={() => setAccountArchived(a.id, false)}
                    className="self-start mt-1 text-meta font-medium text-action hover:underline underline-offset-2">
                    복원
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Link Modal */}
      {modalLinkAccountId ? createPortal(
        <div className={modal.overlayTop}>
          <div className="bg-surface-card rounded-dialog w-full max-w-3xl flex flex-col shadow-dialog overflow-hidden h-[min(calc(100dvh-2rem),720px)]"
            onClick={e => e.stopPropagation()}>
            <div className={modal.header}>
              <div>
                <h3 className="font-medium text-ink"><MemoTip memo={modalAccount?.memo}>{modalAccount?.name}</MemoTip></h3>
                <p className="text-body text-ink-4 mt-0.5">{modalAccount?.broker}{modalAccount?.type ? ` · ${modalAccount.type}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {modalTab === 'securities' ? (
                  <>
                    {isDirty ? <span className="text-micro tracking-normal text-warning bg-warning/10 px-2 py-0.5 rounded-full">미저장</span> : null}
                    <button onClick={saveLinks} disabled={!isDirty || savingLinks}
                      className={btn.primary}>
                      {savingLinks ? '저장 중...' : '저장하기'}
                    </button>
                  </>
                ) : null}
                <button onClick={handleModalClose} className={modal.close}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 탭 */}
            <div className="flex gap-1 px-[18px] pt-3 shrink-0">
              {([
                { key: 'securities' as const, label: '종목 연결', badge: `${pendingIds.size}` },
                { key: 'cashflows' as const, label: '입출금', badge: null },
              ]).map(t => {
                const active = modalTab === t.key
                return (
                  <button key={t.key} onClick={() => setModalTab(t.key)}
                    className={`px-3 py-1.5 rounded-btn text-body transition-colors ${
                      active ? 'bg-action text-white font-bold' : 'bg-surface-low text-ink-3 font-medium hover:bg-surface-high'
                    }`}>
                    {t.label}
                    {t.badge ? <span className={`ml-1.5 ${active ? 'opacity-70' : 'text-ink-4'}`}>{t.badge}</span> : null}
                  </button>
                )
              })}
            </div>

            {modalTab === 'cashflows' ? (
              <CashflowPanel
                accountId={modalLinkAccountId}
                marketValue={accountValues[modalLinkAccountId]}
              />
            ) : (
            <>
            <div className="px-[18px] py-3 border-b border-surface-low shrink-0">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                  placeholder="티커 또는 종목명 검색"
                  className="w-full pl-9 pr-3 py-1.5 text-body rounded-btn focus:outline-none bg-surface-low border-0 focus:bg-surface-card focus:shadow-focus placeholder:text-ink-5 transition-colors" />
              </div>
              <p className="text-micro tracking-normal text-ink-4 mt-1.5">{pendingIds.size}종목 선택됨 · {filteredLinkSecurities.length}개 표시</p>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {filteredLinkSecurities.map(s => {
                const checked = pendingIds.has(s.id)
                const sectorColor = s.sector ? sectorColors[s.sector] : undefined
                const countryColor = s.country ? countryColors[s.country] : undefined
                const currencyColor = s.currency ? currencyColors[s.currency] : undefined
                return (
                  <label key={s.id}
                    className="flex items-center gap-3 px-[18px] py-2.5 hover:bg-surface-low cursor-pointer transition-colors border-b border-surface-low">
                    <input type="checkbox" checked={checked}
                      onChange={e => setPendingIds(prev => {
                        const next = new Set(prev)
                        e.target.checked ? next.add(s.id) : next.delete(s.id)
                        return next
                      })}
                      className="w-3.5 h-3.5 cursor-pointer shrink-0 accent-action bg-surface-low rounded-field border-0 focus:outline-none focus:bg-surface-card focus:shadow-focus placeholder:text-ink-5 transition-colors" />
                    <span
                      className={`${badge.ticker} shrink-0`}
                      style={sectorColor
                        ? tintBadgeStyle(sectorColor)
                        : { backgroundColor: tone.surfaceContainer, color: tone.ink3 }}
                    >{s.ticker}</span>
                    <span className="text-body text-ink flex-1 min-w-0 truncate">{s.name}</span>
                    {s.country ? <span
                        className={`${badge.sm} shrink-0`}
                        style={countryColor
                          ? { backgroundColor: countryColor + '18', color: countryColor }
                          : { backgroundColor: tone.surfaceContainer, color: tone.ink4 }}
                      >{s.country}</span> : null}
                    <span
                      className="text-micro tracking-normal shrink-0 font-medium"
                      style={currencyColor ? { color: currencyColor } : { color: tone.ink5 }}
                    >{s.currency}</span>
                  </label>
                )
              })}
              {filteredLinkSecurities.length === 0 ? <p className="text-body text-ink-4 text-center py-8">검색 결과가 없습니다</p> : null}
            </div>
            </>
            )}
          </div>
        </div>,
        document.body
      ) : null}

      {/* Dirty Alert */}
      {showDirtyAlert ? createPortal(
        <div className="modal-scrim fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-dialog p-[18px] shadow-dialog max-w-sm w-full">
            <p className="text-subhead font-medium text-ink">저장하지 않은 변경사항</p>
            <p className="text-body text-ink-3 mt-1.5">연결 종목을 수정했지만 저장하지 않았습니다.</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowDirtyAlert(false)}
                className={`flex-1 ${btn.primary}`}>
                계속 편집
              </button>
              <button onClick={discardAndClose}
                className={`flex-1 ${btn.secondary}`}>
                저장안함
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {/* Add Account Modal */}
      {showAddModal ? createPortal(
        <div className={modal.overlayTop}>
          <div className="bg-surface-card rounded-card p-[13px] w-full max-w-sm shadow-dialog"
            onClick={e => e.stopPropagation()}>
            <p className="text-subhead font-medium text-ink mb-4">계좌 추가</p>
            <div className="space-y-3">
              {[{key:'name',label:'계좌명 *',placeholder:'종합위탁'},{key:'broker',label:'금융사 *',placeholder:'카카오페이'},{key:'owner',label:'소유자',placeholder:''}].map(f => (
                <div key={f.key}>
                  <label className={field.label}>{f.label}</label>
                  <input value={String(accountForm[f.key as keyof typeof accountForm])}
                    onChange={e => setAccountForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className={field.input} />
                </div>
              ))}
              <div>
                <label className={field.label}>유형</label>
                <Select value={accountForm.type_id} onChange={v => setAccountForm(p => ({ ...p, type_id: v }))}
                  options={[{ value: '', label: '선택 안함' }, ...liveTypeOptions.map(o => ({ value: o.id, label: o.label }))]} />
              </div>
              <div>
                <label className="flex items-center gap-2 text-body text-ink-2 cursor-pointer">
                  <input type="checkbox"
                    checked={accountForm.dividend_eligible}
                    onChange={e => setAccountForm(p => ({ ...p, dividend_eligible: e.target.checked }))}
                    className="bg-surface-low rounded-field border-0 focus:outline-none focus:bg-surface-card focus:shadow-focus placeholder:text-ink-5 transition-colors"
                  />
                  배당 대상 계좌
                </label>
              </div>
              <div>
                <label className={field.label}>배당 세율 (%)</label>
                <input type="text" inputMode="decimal"
                  value={accountForm.dividend_tax_rate}
                  onChange={e => setAccountForm(p => ({ ...p, dividend_tax_rate: e.target.value }))}
                  placeholder="15.40"
                  className={field.input} />
              </div>
              <div>
                <label className={field.label}>메모</label>
                <textarea value={accountForm.memo} rows={3}
                  onChange={e => setAccountForm(p => ({ ...p, memo: e.target.value }))}
                  placeholder="계좌명에 마우스를 올리면 보여요"
                  className={`${field.input} resize-none`} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveAccount} className={btn.primary}>추가</button>
                <button onClick={() => setShowAddModal(false)} className={btn.secondary}>취소</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {/* Edit Account Modal */}
      {editingAccountId ? createPortal(
        <div className={modal.overlayTop}>
          <div className="bg-surface-card rounded-card p-[13px] w-full max-w-sm shadow-dialog"
            onClick={e => e.stopPropagation()}>
            <p className="text-subhead font-medium text-ink mb-4">계좌 수정</p>
            <div className="space-y-3">
              {[{key:'name',label:'계좌명 *'},{key:'broker',label:'금융사 *'},{key:'owner',label:'소유자'}].map(f => (
                <div key={f.key}>
                  <label className={field.label}>{f.label}</label>
                  <input value={String(accountForm[f.key as keyof typeof accountForm])}
                    onChange={e => setAccountForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className={field.input} />
                </div>
              ))}
              <div>
                <label className={field.label}>유형</label>
                <Select value={accountForm.type_id} onChange={v => setAccountForm(p => ({ ...p, type_id: v }))}
                  options={[{ value: '', label: '선택 안함' }, ...liveTypeOptions.map(o => ({ value: o.id, label: o.label }))]} />
              </div>
              <div>
                <label className="flex items-center gap-2 text-body text-ink-2 cursor-pointer">
                  <input type="checkbox"
                    checked={accountForm.dividend_eligible}
                    onChange={e => setAccountForm(p => ({ ...p, dividend_eligible: e.target.checked }))}
                    className="bg-surface-low rounded-field border-0 focus:outline-none focus:bg-surface-card focus:shadow-focus placeholder:text-ink-5 transition-colors"
                  />
                  배당 대상 계좌
                </label>
              </div>
              <div>
                <label className={field.label}>배당 세율 (%)</label>
                <input type="text" inputMode="decimal"
                  value={accountForm.dividend_tax_rate}
                  onChange={e => setAccountForm(p => ({ ...p, dividend_tax_rate: e.target.value }))}
                  placeholder="15.40"
                  className={field.input} />
              </div>
              <div>
                <label className={field.label}>메모</label>
                <textarea value={accountForm.memo} rows={3}
                  onChange={e => setAccountForm(p => ({ ...p, memo: e.target.value }))}
                  placeholder="계좌명에 마우스를 올리면 보여요"
                  className={`${field.input} resize-none`} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={saveAccount} className={btn.primary}>수정</button>
                <button onClick={() => setEditingAccountId(null)} className={btn.secondary}>취소</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  )
}
