'use client'

import { useState, useRef, useEffect } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTheme } from '@/lib/ThemeContext'
import { btn, field } from '@/lib/styles'
import { OPTION_COLORS } from '@/lib/palettes'
import { CATEGORIES, CAT_COLORS } from '@/lib/utils'

interface Member { code: string; display_name: string; color: string }
interface PaymentMethod { id: number; name: string; order_idx: number; color: string }
interface DetailOption { id: number; name: string; category: string; color: string }

interface Props {
  initialMembers: Member[]
  initialMethods: PaymentMethod[]
  initialDetails: DetailOption[]
  initialCatColors: Record<string, string>
}

// ── ColorPicker ───────────────────────────────────────────────────────────────

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

// ── OptionCard ────────────────────────────────────────────────────────────────

function OptionCard({ title, count, accentColor, onAccentColorChange, children, footer }: {
  title: string; count: number; accentColor?: string; onAccentColorChange?: (c: string) => void
  children: React.ReactNode; footer: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          {accentColor !== undefined && (
            onAccentColorChange
              ? <ColorPicker color={accentColor} onChange={onAccentColorChange} />
              : <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
          )}
          <h4 className="text-xs font-semibold text-slate-700">{title}</h4>
        </div>
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

// ── DragHandle ────────────────────────────────────────────────────────────────

function DragHandle(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props}
      className="text-slate-300 hover:text-slate-400 cursor-grab active:cursor-grabbing p-0.5 shrink-0 touch-none">
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
      </svg>
    </button>
  )
}

// ── OptionRow (with optional before slot for drag handle) ─────────────────────

function OptionRow({ label, color, onDelete, extra, onLabelChange, onColorChange, before }: {
  label: string; color?: string
  onDelete: () => void
  extra?: React.ReactNode
  onLabelChange?: (v: string) => void
  onColorChange?: (c: string) => void
  before?: React.ReactNode
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
      {before}
      {color !== undefined && (
        onColorChange
          ? <ColorPicker color={color} onChange={onColorChange} />
          : <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      )}
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

// ── SortableOptionRow ─────────────────────────────────────────────────────────

interface RowProps {
  label: string; color?: string
  onDelete: () => void
  extra?: React.ReactNode
  onLabelChange?: (v: string) => void
  onColorChange?: (c: string) => void
}

function SortableOptionRow({ sortId, ...rowProps }: { sortId: number } & RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style}>
      <OptionRow {...rowProps} before={<DragHandle {...attributes} {...listeners} />} />
    </div>
  )
}

// ── MemberRow ─────────────────────────────────────────────────────────────────

function MemberRow({ member, onUpdate, onDelete }: {
  member: Member
  onUpdate: (display_name: string, color: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(member.display_name)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() { setDraft(member.display_name); setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }
  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== member.display_name) onUpdate(trimmed, member.color)
    else setDraft(member.display_name)
  }

  return (
    <div className="flex items-center gap-1.5 group py-0.5">
      <ColorPicker color={member.color} onChange={c => onUpdate(member.display_name, c)} />
      <span className="text-[10px] font-mono font-semibold text-slate-400 w-8 shrink-0">{member.code}</span>
      {editing ? (
        <input ref={inputRef} value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(member.display_name) } }}
          className="flex-1 border border-blue-300 rounded px-1 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
          autoFocus />
      ) : (
        <span onClick={startEdit} title="클릭하여 편집"
          className="text-xs font-medium text-slate-600 flex-1 truncate cursor-text hover:text-blue-600 transition-colors">
          {member.display_name}
        </span>
      )}
      <button onClick={onDelete}
        className="p-0.5 text-slate-300 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── CategoryDetailCard (with DndContext) ──────────────────────────────────────

function CategoryDetailCard({ category, details, accentColor, onCategoryColorChange, onAdd, onUpdate, onDelete, onDragEnd, paletteColor }: {
  category: string
  details: DetailOption[]
  accentColor: string
  onCategoryColorChange: (color: string) => void
  onAdd: (name: string, category: string, color: string) => void
  onUpdate: (id: number, name: string, category: string, color: string) => void
  onDelete: (id: number) => void
  onDragEnd: (event: DragEndEvent) => void
  paletteColor: string
}) {
  const [newName, setNewName] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleAdd() {
    const name = newName.trim()
    if (!name) return
    onAdd(name, category, accentColor)
    setNewName('')
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <OptionCard title={category} count={details.length} accentColor={accentColor} onAccentColorChange={onCategoryColorChange}
        footer={
          <div className="flex items-center gap-1.5">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={`새 ${category} 항목`} maxLength={30}
              className={`${field.input} min-w-0`} />
            <button onClick={handleAdd} disabled={!newName.trim()}
              className={`${btn.primary} shrink-0`}
              style={{ backgroundColor: paletteColor }}>추가</button>
          </div>
        }>
        <SortableContext items={details.map(d => d.id)} strategy={verticalListSortingStrategy}>
          {details.map(d => (
            <SortableOptionRow key={d.id} sortId={d.id} label={d.name} color={d.color}
              onColorChange={c => onUpdate(d.id, d.name, d.category, c)}
              onLabelChange={name => onUpdate(d.id, name, d.category, d.color)}
              onDelete={() => onDelete(d.id)} />
          ))}
          {details.length === 0 && <p className="text-xs text-slate-300 py-2">항목 없음</p>}
        </SortableContext>
      </OptionCard>
    </DndContext>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OptionsClient({ initialMembers, initialMethods, initialDetails, initialCatColors }: Props) {
  const { palette } = useTheme()
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [methods, setMethods] = useState<PaymentMethod[]>(initialMethods)
  const [details, setDetails] = useState<DetailOption[]>(initialDetails)
  const [catColors, setCatColors] = useState<Record<string, string>>(initialCatColors)

  const methodSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /* ── 사용자 ── */
  const [newMemberCode, setNewMemberCode] = useState('')
  const [newMemberColor, setNewMemberColor] = useState(OPTION_COLORS[0])

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
      setNewMemberCode('')
    }
  }

  async function updateMember(code: string, display_name: string, color: string) {
    setMembers(prev => prev.map(m => m.code === code ? { ...m, display_name, color } : m))
    await fetch(`/api/options/members/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name, color }),
    })
  }

  async function deleteMember(code: string) {
    if (!confirm(`사용자 "${code}"를 삭제하시겠습니까?`)) return
    await fetch(`/api/options/members/${code}`, { method: 'DELETE' })
    setMembers(prev => prev.filter(m => m.code !== code))
  }

  /* ── 결제수단 ── */
  const [newMethod, setNewMethod] = useState('')
  const [newMethodColor, setNewMethodColor] = useState(OPTION_COLORS[2])
  const [addingMethod, setAddingMethod] = useState(false)

  async function addMethod() {
    if (!newMethod.trim()) return
    setAddingMethod(true)
    const res = await fetch('/api/options/methods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newMethod.trim(), color: newMethodColor }),
    })
    if (res.ok) {
      const row = await res.json()
      setMethods(prev => [...prev.filter(m => m.id !== row.id), row])
      setNewMethod('')
    }
    setAddingMethod(false)
  }

  async function updateMethod(id: number, name: string, color: string) {
    setMethods(prev => prev.map(m => m.id === id ? { ...m, name, color } : m))
    await fetch(`/api/options/methods/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    })
  }

  async function deleteMethod(id: number) {
    if (!confirm('결제수단을 삭제하시겠습니까?')) return
    await fetch(`/api/options/methods/${id}`, { method: 'DELETE' })
    setMethods(prev => prev.filter(m => m.id !== id))
  }

  async function handleMethodDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = methods.findIndex(m => m.id === active.id)
    const newIndex = methods.findIndex(m => m.id === over.id)
    const reordered = arrayMove(methods, oldIndex, newIndex)
    setMethods(reordered)
    await Promise.all(
      reordered.map((m, i) =>
        fetch(`/api/options/methods/${m.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: m.name, color: m.color, order_idx: i }),
        })
      )
    )
  }

  /* ── 카테고리 색상 ── */
  async function updateCategoryColor(name: string, color: string) {
    setCatColors(prev => ({ ...prev, [name]: color }))
    await fetch(`/api/options/categories/${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    })
  }

  /* ── 세부유형 ── */
  async function addDetail(name: string, category: string, color: string) {
    const res = await fetch('/api/options/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, color }),
    })
    if (res.ok) {
      const row = await res.json()
      setDetails(prev => [...prev.filter(d => d.id !== row.id), row])
    }
  }

  async function updateDetail(id: number, name: string, category: string, color: string) {
    setDetails(prev => prev.map(x => x.id === id ? { ...x, name, category, color } : x))
    await fetch(`/api/options/details/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, color }),
    })
  }

  async function deleteDetail(id: number) {
    if (!confirm('세부유형을 삭제하시겠습니까?')) return
    await fetch(`/api/options/details/${id}`, { method: 'DELETE' })
    setDetails(prev => prev.filter(d => d.id !== id))
  }

  async function handleDetailDragEnd(category: string, event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const catDetails = details.filter(d => d.category === category)
    const oldIndex = catDetails.findIndex(d => d.id === active.id)
    const newIndex = catDetails.findIndex(d => d.id === over.id)
    const reordered = arrayMove(catDetails, oldIndex, newIndex)
    setDetails(prev => [...prev.filter(d => d.category !== category), ...reordered])
    await Promise.all(
      reordered.map((d, i) =>
        fetch(`/api/options/details/${d.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: d.name, category: d.category, color: d.color, order_idx: i }),
        })
      )
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>옵션 관리</h1>
        <p className="text-xs text-slate-400 mt-0.5">사용자, 결제수단, 세부유형 설정</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* ── 사용자 ── */}
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
            <MemberRow key={m.code} member={m}
              onUpdate={(display_name, color) => updateMember(m.code, display_name, color)}
              onDelete={() => deleteMember(m.code)} />
          ))}
          {members.length === 0 && <p className="text-xs text-slate-300 py-2">항목 없음</p>}
        </OptionCard>

        {/* ── 결제수단 (드래그 정렬) ── */}
        <DndContext sensors={methodSensors} collisionDetection={closestCenter} onDragEnd={handleMethodDragEnd}>
          <SortableContext items={methods.map(m => m.id)} strategy={verticalListSortingStrategy}>
            <OptionCard title="결제수단" count={methods.length}
              footer={
                <div className="flex items-center gap-1.5">
                  <ColorPicker color={newMethodColor} onChange={setNewMethodColor} />
                  <input value={newMethod} onChange={e => setNewMethod(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addMethod()}
                    placeholder="새 결제수단" maxLength={20}
                    className={`${field.input} min-w-0`} />
                  <button onClick={addMethod} disabled={addingMethod || !newMethod.trim()}
                    className={`${btn.primary} shrink-0`}
                    style={{ backgroundColor: palette.colors[0] }}>추가</button>
                </div>
              }>
              {methods.map(m => (
                <SortableOptionRow key={m.id} sortId={m.id} label={m.name} color={m.color}
                  onColorChange={c => updateMethod(m.id, m.name, c)}
                  onLabelChange={name => updateMethod(m.id, name, m.color)}
                  onDelete={() => deleteMethod(m.id)} />
              ))}
              {methods.length === 0 && <p className="text-xs text-slate-300 py-2">항목 없음</p>}
            </OptionCard>
          </SortableContext>
        </DndContext>

        {/* ── 카테고리별 세부유형 (드래그 정렬) ── */}
        {CATEGORIES.map(cat => (
          <CategoryDetailCard
            key={cat}
            category={cat}
            details={details.filter(d => d.category === cat)}
            accentColor={catColors[cat] ?? (CAT_COLORS as Record<string, string>)[cat] ?? '#94a3b8'}
            onCategoryColorChange={color => updateCategoryColor(cat, color)}
            onAdd={addDetail}
            onUpdate={updateDetail}
            onDelete={deleteDetail}
            onDragEnd={e => handleDetailDragEnd(cat, e)}
            paletteColor={palette.colors[0]}
          />
        ))}

      </div>
    </div>
  )
}
