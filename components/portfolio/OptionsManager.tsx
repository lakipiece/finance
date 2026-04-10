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

type OptionItem = { id: string; type: string; label: string; value: string; color_hex: string | null; sort_order: number }
type OptionMap = Record<string, OptionItem[]>

const PRESET_COLORS = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#6366f1','#64748b','#a3e635','#94a3b8',
]

const TYPE_LABELS: Record<string, string> = {
  account_type: '계좌유형',
  country: '국가',
  currency: '통화',
  asset_class: '자산군',
  sector: '섹터',
}

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <div
        className="w-5 h-5 rounded-full border border-slate-200 cursor-pointer shrink-0"
        style={{ backgroundColor: color }}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="absolute left-0 top-7 z-10 flex flex-wrap gap-1 bg-white border border-slate-200 rounded-xl p-2 shadow-lg w-40">
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => { onChange(c); setOpen(false) }}
              className="w-5 h-5 rounded-full border-2 transition-all"
              style={{
                backgroundColor: c,
                borderColor: color === c ? '#1e293b' : 'transparent',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SortableOptionRow({
  opt,
  onColorChange,
  onLabelChange,
  onDelete,
}: {
  opt: OptionItem
  onColorChange: (id: string, color: string) => void
  onLabelChange: (id: string, label: string) => void
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: opt.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(opt.label)
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(opt.label)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    setEditing(false)
    if (draft.trim() && draft.trim() !== opt.label) {
      onLabelChange(opt.id, draft.trim())
    } else {
      setDraft(opt.label)
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 group">
      {/* drag handle */}
      <button {...attributes} {...listeners}
        className="text-slate-300 hover:text-slate-400 cursor-grab active:cursor-grabbing p-0.5 shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>

      <ColorPicker color={opt.color_hex ?? '#94a3b8'} onChange={c => onColorChange(opt.id, c)} />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditing(false); setDraft(opt.label) } }}
          className="flex-1 border border-blue-300 rounded px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
          autoFocus
        />
      ) : (
        <span
          onClick={startEdit}
          title="클릭하여 편집"
          className="text-xs font-medium text-slate-700 flex-1 cursor-text hover:text-blue-600 transition-colors"
        >
          {opt.label}
        </span>
      )}

      <button onClick={() => onDelete(opt.id)}
        className="p-1 text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function OptionsManager({ initialOptions }: { initialOptions: OptionMap }) {
  const [options, setOptions] = useState<OptionMap>(initialOptions)
  const [activeType, setActiveType] = useState('account_type')
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('#3b82f6')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const types = Object.keys(TYPE_LABELS)
  const currentOptions = options[activeType] ?? []

  async function handleAdd() {
    if (!newLabel.trim()) return
    setAdding(true)
    const res = await fetch('/api/portfolio/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: activeType, label: newLabel.trim(), value: newLabel.trim(), color_hex: newColor }),
    })
    if (res.ok) {
      const item = await res.json()
      setOptions(prev => ({ ...prev, [activeType]: [...(prev[activeType] ?? []), item] }))
      setNewLabel('')
      setMsg('추가됨')
    } else {
      const d = await res.json()
      setMsg(d.error ?? '오류')
    }
    setAdding(false)
    setTimeout(() => setMsg(''), 2000)
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    const res = await fetch(`/api/portfolio/options/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setOptions(prev => ({
        ...prev,
        [activeType]: (prev[activeType] ?? []).filter(o => o.id !== id),
      }))
    }
  }

  async function handleColorChange(id: string, color_hex: string) {
    setOptions(prev => ({
      ...prev,
      [activeType]: (prev[activeType] ?? []).map(o => o.id === id ? { ...o, color_hex } : o),
    }))
    await fetch(`/api/portfolio/options/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color_hex }),
    })
  }

  async function handleLabelChange(id: string, label: string) {
    setOptions(prev => ({
      ...prev,
      [activeType]: (prev[activeType] ?? []).map(o => o.id === id ? { ...o, label } : o),
    }))
    await fetch(`/api/portfolio/options/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = currentOptions.findIndex(o => o.id === active.id)
    const newIndex = currentOptions.findIndex(o => o.id === over.id)
    const reordered = arrayMove(currentOptions, oldIndex, newIndex)

    setOptions(prev => ({ ...prev, [activeType]: reordered }))

    // save all sort_orders
    await Promise.all(
      reordered.map((o, i) =>
        fetch(`/api/portfolio/options/${o.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: i }),
        })
      )
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">옵션 관리</h3>

      {/* 타입 탭 */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setActiveType(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeType === t ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* 옵션 목록 (drag-and-drop) */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={currentOptions.map(o => o.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 mb-4">
            {currentOptions.map(opt => (
              <SortableOptionRow
                key={opt.id}
                opt={opt}
                onColorChange={handleColorChange}
                onLabelChange={handleLabelChange}
                onDelete={handleDelete}
              />
            ))}
            {currentOptions.length === 0 && (
              <p className="text-xs text-slate-400 py-2">옵션이 없습니다</p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* 추가 폼 */}
      <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
        <ColorPicker color={newColor} onChange={setNewColor} />
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
          placeholder="새 옵션 이름" onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
        <button onClick={handleAdd} disabled={adding}
          className="bg-slate-700 text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
          추가
        </button>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </div>
  )
}
