'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { btn, field } from '@/lib/styles'
import { OPTION_COLORS } from '@/lib/palettes'
import { CATEGORIES } from '@/lib/utils'

interface Member { code: string; display_name: string; color: string }
interface PaymentMethod { id: number; name: string; order_idx: number }
interface DetailOption { id: number; name: string; category: string }

interface Props {
  initialMembers: Member[]
  initialMethods: PaymentMethod[]
  initialDetails: DetailOption[]
}

// ── ColorPicker (OptionsManager와 동일한 패턴) ───────────────────────────────

function isValidHex(s: string) { return /^#[0-9a-fA-F]{6}$/.test(s) }

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const [hexInput, setHexInput] = useState(color)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [copied, setCopied] = useState<string | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const nativeRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setHexInput(color) }, [color])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 300) })
    }
    setOpen(v => !v)
  }

  function handlePresetClick(c: string) {
    onChange(c); setHexInput(c)
    navigator.clipboard.writeText(c).catch(() => {})
    setCopied(c)
    setTimeout(() => setCopied(prev => prev === c ? null : prev), 1200)
  }

  return (
    <div>
      <div ref={triggerRef} onClick={handleOpen}
        className="w-3.5 h-3.5 rounded-full border border-slate-200 cursor-pointer shrink-0"
        style={{ backgroundColor: color }} />
      {open && (
        <div ref={dropdownRef} className="fixed z-[9999] bg-white border border-slate-200 rounded-xl p-2.5 shadow-xl"
          style={{ top: pos.top, left: pos.left }}>
          <div className="grid grid-cols-8 gap-1.5 mb-2.5" style={{ width: 272 }}>
            {OPTION_COLORS.map(c => (
              <button key={c} onClick={() => handlePresetClick(c)} title={c}
                className="w-7 h-7 rounded-md border-2 transition-all hover:scale-110 relative"
                style={{ backgroundColor: c, borderColor: color === c ? '#1e293b' : 'transparent' }}>
                {copied === c && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
            <div className="w-6 h-6 rounded-md border border-slate-200 cursor-pointer shrink-0 overflow-hidden relative"
              style={{ backgroundColor: color }} onClick={() => nativeRef.current?.click()}>
              <input ref={nativeRef} type="color" value={color}
                onChange={e => { onChange(e.target.value); setHexInput(e.target.value) }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            </div>
            <input value={hexInput} onChange={e => { setHexInput(e.target.value); if (isValidHex(e.target.value)) onChange(e.target.value) }}
              placeholder="#3b82f6"
              className="w-[80px] border border-slate-200 rounded-md px-1.5 py-0.5 text-[10px] text-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-blue-300"
              maxLength={7} />
            <span className="text-[9px] text-slate-300">클릭→복사</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 공통 카드 ────────────────────────────────────────────────────────────────

function OptionCard({ title, count, children, footer }: {
  title: string; count: number; children: React.ReactNode; footer: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-xs font-semibold text-slate-700">{title}</h4>
        <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-full">{count}개</span>
      </div>
      <div className="space-y-0.5 mb-3 overflow-y-auto flex-1" style={{ maxHeight: 240 }}>
        {children}
      </div>
      <div className="pt-2.5 border-t border-slate-50 mt-auto">
        {footer}
      </div>
    </div>
  )
}

function OptionRow({ label, color, onDelete, extra, onLabelChange }: {
  label: string; color?: string
  onDelete: () => void
  extra?: React.ReactNode
  onLabelChange?: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() { setDraft(label); setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }
  function commitEdit() {
    setEditing(false)
    if (draft.trim() && draft.trim() !== label && onLabelChange) onLabelChange(draft.trim())
    else setDraft(label)
  }

  return (
    <div className="flex items-center gap-1.5 group py-0.5">
      {color !== undefined && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      {editing ? (
        <input ref={inputRef} value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditing(false); setDraft(label) } }}
          className="flex-1 border border-blue-300 rounded px-1 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
          autoFocus />
      ) : (
        <span onClick={onLabelChange ? startEdit : undefined}
          title={onLabelChange ? '클릭하여 편집' : undefined}
          className={`text-xs font-medium text-slate-600 flex-1 truncate ${onLabelChange ? 'cursor-text hover:text-blue-600 transition-colors' : ''}`}>
          {label}
        </span>
      )}
      {extra}
      <button onClick={onDelete}
        className="p-0.5 text-slate-300 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function OptionsClient({ initialMembers, initialMethods, initialDetails }: Props) {
  const { palette } = useTheme()
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [methods, setMethods] = useState<PaymentMethod[]>(initialMethods)
  const [details, setDetails] = useState<DetailOption[]>(initialDetails)

  /* ── 사용자 ── */
  const [newMemberCode, setNewMemberCode] = useState('')
  const [newMemberColor, setNewMemberColor] = useState(OPTION_COLORS[0])
  const [memberColors, setMemberColors] = useState<Record<string, string>>(
    Object.fromEntries(initialMembers.map(m => [m.code, m.color]))
  )

  async function addMember() {
    if (!newMemberCode.trim()) return
    const code = newMemberCode.trim().toUpperCase()
    const res = await fetch('/api/options/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, display_name: code, color: newMemberColor }),
    })
    if (res.ok) {
      const row = await res.json()
      setMembers(prev => [...prev.filter(m => m.code !== row.code), row].sort((a, b) => a.code.localeCompare(b.code)))
      setMemberColors(prev => ({ ...prev, [row.code]: row.color }))
      setNewMemberCode('')
    }
  }

  async function updateMemberColor(code: string, color: string) {
    setMemberColors(prev => ({ ...prev, [code]: color }))
    setMembers(prev => prev.map(m => m.code === code ? { ...m, color } : m))
    await fetch(`/api/options/members/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: members.find(m => m.code === code)?.display_name ?? code, color }),
    })
  }

  async function updateMemberName(code: string, display_name: string) {
    setMembers(prev => prev.map(m => m.code === code ? { ...m, display_name } : m))
    await fetch(`/api/options/members/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name, color: memberColors[code] ?? '#64748b' }),
    })
  }

  async function deleteMember(code: string) {
    if (!confirm(`사용자 "${code}"를 삭제하시겠습니까?`)) return
    await fetch(`/api/options/members/${code}`, { method: 'DELETE' })
    setMembers(prev => prev.filter(m => m.code !== code))
  }

  /* ── 결제수단 ── */
  const [newMethod, setNewMethod] = useState('')
  const [adding, setAdding] = useState(false)

  async function addMethod() {
    if (!newMethod.trim()) return
    setAdding(true)
    const res = await fetch('/api/options/methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newMethod.trim() }),
    })
    if (res.ok) {
      const row = await res.json()
      setMethods(prev => [...prev.filter(m => m.id !== row.id), row])
      setNewMethod('')
    }
    setAdding(false)
  }

  async function updateMethodName(id: number, name: string) {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, name } : m))
    await fetch(`/api/options/methods/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }

  async function deleteMethod(id: number) {
    if (!confirm('결제수단을 삭제하시겠습니까?')) return
    await fetch(`/api/options/methods/${id}`, { method: 'DELETE' })
    setMethods(prev => prev.filter(m => m.id !== id))
  }

  /* ── 세부유형 ── */
  const [newDetailName, setNewDetailName] = useState('')
  const [newDetailCat, setNewDetailCat] = useState('')
  const [detailCatFilter, setDetailCatFilter] = useState('')
  const [addingDetail, setAddingDetail] = useState(false)

  async function addDetail() {
    if (!newDetailName.trim()) return
    setAddingDetail(true)
    const res = await fetch('/api/options/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDetailName.trim(), category: newDetailCat }),
    })
    if (res.ok) {
      const row = await res.json()
      setDetails(prev => [...prev.filter(d => d.id !== row.id), row])
      setNewDetailName('')
    }
    setAddingDetail(false)
  }

  async function updateDetailName(id: number, name: string) {
    const d = details.find(x => x.id === id)
    if (!d) return
    setDetails(prev => prev.map(x => x.id === id ? { ...x, name } : x))
    await fetch(`/api/options/details/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category: d.category }),
    })
  }

  async function deleteDetail(id: number) {
    if (!confirm('세부유형을 삭제하시겠습니까?')) return
    await fetch(`/api/options/details/${id}`, { method: 'DELETE' })
    setDetails(prev => prev.filter(d => d.id !== id))
  }

  const visibleDetails = detailCatFilter
    ? details.filter(d => d.category === detailCatFilter || (detailCatFilter === '__none' && d.category === ''))
    : details

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>옵션 관리</h1>
          <p className="text-xs text-slate-400 mt-0.5">사용자, 결제수단, 세부유형 설정</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* ── 사용자 카드 ── */}
        <OptionCard title="사용자" count={members.length}
          footer={
            <div className="flex items-center gap-1.5">
              <ColorPicker color={newMemberColor} onChange={setNewMemberColor} />
              <input value={newMemberCode} onChange={e => setNewMemberCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && addMember()}
                placeholder="코드 (예: M)" maxLength={10}
                className={`${field.input} min-w-0`} />
              <button onClick={addMember} disabled={!newMemberCode.trim()}
                className={`${btn.primary} shrink-0`}
                style={{ backgroundColor: palette.colors[0] }}>추가</button>
            </div>
          }>
          {members.map(m => (
            <div key={m.code} className="flex items-center gap-1.5 group py-0.5">
              <ColorPicker color={memberColors[m.code] ?? m.color} onChange={c => updateMemberColor(m.code, c)} />
              <span className="text-[10px] font-mono font-semibold text-slate-400 w-8 shrink-0">{m.code}</span>
              <span className="text-xs font-medium text-slate-600 flex-1 truncate">{m.display_name}</span>
              <button onClick={() => deleteMember(m.code)}
                className="p-0.5 text-slate-300 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {members.length === 0 && <p className="text-xs text-slate-300 py-2">항목 없음</p>}
        </OptionCard>

        {/* ── 결제수단 카드 ── */}
        <OptionCard title="결제수단" count={methods.length}
          footer={
            <div className="flex items-center gap-1.5">
              <input value={newMethod} onChange={e => setNewMethod(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMethod()}
                placeholder="새 결제수단" maxLength={20}
                className={`${field.input} min-w-0`} />
              <button onClick={addMethod} disabled={adding || !newMethod.trim()}
                className={`${btn.primary} shrink-0`}
                style={{ backgroundColor: palette.colors[0] }}>추가</button>
            </div>
          }>
          {methods.map(m => (
            <OptionRow key={m.id} label={m.name}
              onLabelChange={name => updateMethodName(m.id, name)}
              onDelete={() => deleteMethod(m.id)} />
          ))}
          {methods.length === 0 && <p className="text-xs text-slate-300 py-2">항목 없음</p>}
        </OptionCard>

        {/* ── 세부유형 카드 ── */}
        <OptionCard title="세부유형" count={visibleDetails.length}
          footer={
            <div className="space-y-1.5">
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => setDetailCatFilter('')}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${!detailCatFilter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  전체
                </button>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setDetailCatFilter(prev => prev === c ? '' : c)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${detailCatFilter === c ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {c}
                  </button>
                ))}
                <button onClick={() => setDetailCatFilter(prev => prev === '__none' ? '' : '__none')}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${detailCatFilter === '__none' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  미분류
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <input value={newDetailName} onChange={e => setNewDetailName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addDetail()}
                  placeholder="새 세부유형" maxLength={30}
                  className={`${field.input} min-w-0`} />
                <select value={newDetailCat} onChange={e => setNewDetailCat(e.target.value)}
                  className="text-xs border border-slate-200 rounded-md px-1.5 py-1.5 bg-white focus:outline-none shrink-0">
                  <option value="">미분류</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={addDetail} disabled={addingDetail || !newDetailName.trim()}
                  className={`${btn.primary} shrink-0`}
                  style={{ backgroundColor: palette.colors[0] }}>추가</button>
              </div>
            </div>
          }>
          {visibleDetails.map(d => (
            <OptionRow key={d.id} label={d.name}
              onLabelChange={name => updateDetailName(d.id, name)}
              onDelete={() => deleteDetail(d.id)}
              extra={d.category
                ? <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-400 shrink-0">{d.category}</span>
                : undefined}
            />
          ))}
          {visibleDetails.length === 0 && <p className="text-xs text-slate-300 py-2">항목 없음</p>}
        </OptionCard>

      </div>
    </div>
  )
}
