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
  '#ec4899','#14b8a6','#f97316','#6366f1','#64748b',
  '#a3e635','#94a3b8','#0ea5e9','#d946ef','#e11d48',
]

const TYPE_LABELS: Record<string, string> = {
  account_type: '계좌유형',
  country: '국가',
  currency: '통화',
  asset_class: '자산군',
  sector: '섹터',
}

function isValidHex(s: string) {
  return /^#[0-9a-fA-F]{6}$/.test(s)
}

function ColorPicker({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false)
  const [hexInput, setHexInput] = useState(color)
  const ref = useRef<HTMLDivElement>(null)
  const nativeRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setHexInput(color) }, [color])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleHexChange(v: string) {
    setHexInput(v)
    if (isValidHex(v)) onChange(v)
  }

  return (
    <div className="relative" ref={ref}>
      <div
        className="w-4 h-4 rounded-full border border-slate-200 cursor-pointer shrink-0"
        style={{ backgroundColor: color }}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="absolute left-0 top-6 z-20 bg-white border border-slate-200 rounded-xl p-2.5 shadow-xl w-44">
          {/* 프리셋 — 5열 고정 그리드 */}
          <div className="grid grid-cols-5 gap-1.5 mb-2.5">
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => { onChange(c); setHexInput(c) }}
                className="w-5 h-5 rounded-full border transition-all hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? '#1e293b' : 'transparent',
                  borderWidth: color === c ? '1.5px' : '1px',
                }}
              />
            ))}
          </div>
          {/* HEX 입력 + 네이티브 피커 */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-6 h-6 rounded-lg border border-slate-200 cursor-pointer shrink-0 overflow-hidden relative"
              style={{ backgroundColor: color }}
              onClick={() => nativeRef.current?.click()}
            >
              <input
                ref={nativeRef}
                type="color"
                value={color}
                onChange={e => { onChange(e.target.value); setHexInput(e.target.value) }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
            <input
              value={hexInput}
              onChange={e => handleHexChange(e.target.value)}
              placeholder="#3b82f6"
              className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-300 font-sans focus:outline-none focus:ring-1 focus:ring-blue-300"
              maxLength={7}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function SortableOptionRow({
  opt, onColorChange, onLabelChange, onDelete,
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

  function startEdit() { setDraft(opt.label); setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }
  function commitEdit() {
    setEditing(false)
    if (draft.trim() && draft.trim() !== opt.label) onLabelChange(opt.id, draft.trim())
    else setDraft(opt.label)
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 group py-0.5">
      <button {...attributes} {...listeners}
        className="text-slate-300 hover:text-slate-400 cursor-grab active:cursor-grabbing p-0.5 shrink-0">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>

      <ColorPicker color={opt.color_hex ?? '#94a3b8'} onChange={c => onColorChange(opt.id, c)} />

      {editing ? (
        <input ref={inputRef} value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') { setEditing(false); setDraft(opt.label) } }}
          className="flex-1 border border-blue-300 rounded px-1 py-0.5 text-[11px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
          autoFocus
        />
      ) : (
        <span onClick={startEdit} title="클릭하여 편집"
          className="text-[11px] font-medium text-slate-600 flex-1 cursor-text hover:text-blue-600 transition-colors truncate">
          {opt.label}
        </span>
      )}

      <button onClick={() => onDelete(opt.id)}
        className="p-0.5 text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function OptionTypeCard({
  typeKey, label, items,
  onAdd, onDelete, onColorChange, onLabelChange, onDragEnd,
}: {
  typeKey: string
  label: string
  items: OptionItem[]
  onAdd: (type: string, label: string, color: string) => Promise<void>
  onDelete: (type: string, id: string) => Promise<void>
  onColorChange: (type: string, id: string, color: string) => Promise<void>
  onLabelChange: (type: string, id: string, label: string) => Promise<void>
  onDragEnd: (type: string, event: DragEndEvent) => Promise<void>
}) {
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState('#3b82f6')
  const [adding, setAdding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleAdd() {
    if (!newLabel.trim()) return
    setAdding(true)
    await onAdd(typeKey, newLabel.trim(), newColor)
    setNewLabel('')
    setAdding(false)
  }

  // 항목 1개당 ~24px, 10개 = 240px
  const LIST_MAX_H = 240

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex flex-col">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-xs font-semibold text-slate-700">{label}</h4>
        <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-full">{items.length}개</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter}
        onDragEnd={e => onDragEnd(typeKey, e)}>
        <SortableContext items={items.map(o => o.id)} strategy={verticalListSortingStrategy}>
          <div
            className="space-y-0.5 mb-3 overflow-y-auto"
            style={{ maxHeight: LIST_MAX_H }}
          >
            {items.map(opt => (
              <SortableOptionRow
                key={opt.id} opt={opt}
                onColorChange={(id, c) => onColorChange(typeKey, id, c)}
                onLabelChange={(id, l) => onLabelChange(typeKey, id, l)}
                onDelete={(id) => onDelete(typeKey, id)}
              />
            ))}
            {items.length === 0 && (
              <p className="text-[11px] text-slate-300 py-2">항목 없음</p>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-1.5 pt-2.5 border-t border-slate-50">
        <ColorPicker color={newColor} onChange={setNewColor} />
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
          placeholder="새 항목" onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-300 min-w-0" />
        <button onClick={handleAdd} disabled={adding || !newLabel.trim()}
          className="bg-slate-700 text-white px-2 py-1 rounded-lg text-[11px] font-medium hover:bg-slate-800 disabled:opacity-40 shrink-0">
          추가
        </button>
      </div>
    </div>
  )
}

export default function OptionsManager({ initialOptions }: { initialOptions: OptionMap }) {
  const [options, setOptions] = useState<OptionMap>(initialOptions)
  const types = Object.keys(TYPE_LABELS)

  async function handleAdd(type: string, label: string, color: string) {
    const res = await fetch('/api/portfolio/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, label, value: label, color_hex: color }),
    })
    if (res.ok) {
      const item = await res.json()
      setOptions(prev => ({ ...prev, [type]: [...(prev[type] ?? []), item] }))
    }
  }

  async function handleDelete(type: string, id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    const res = await fetch(`/api/portfolio/options/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setOptions(prev => ({ ...prev, [type]: (prev[type] ?? []).filter(o => o.id !== id) }))
    }
  }

  async function handleColorChange(type: string, id: string, color_hex: string) {
    setOptions(prev => ({
      ...prev,
      [type]: (prev[type] ?? []).map(o => o.id === id ? { ...o, color_hex } : o),
    }))
    await fetch(`/api/portfolio/options/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color_hex }),
    })
  }

  async function handleLabelChange(type: string, id: string, label: string) {
    setOptions(prev => ({
      ...prev,
      [type]: (prev[type] ?? []).map(o => o.id === id ? { ...o, label } : o),
    }))
    await fetch(`/api/portfolio/options/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
  }

  async function handleDragEnd(type: string, event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const current = options[type] ?? []
    const oldIndex = current.findIndex(o => o.id === active.id)
    const newIndex = current.findIndex(o => o.id === over.id)
    const reordered = arrayMove(current, oldIndex, newIndex)
    setOptions(prev => ({ ...prev, [type]: reordered }))
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
    <div>
      <h3 className="text-xs font-semibold text-slate-600 mb-3">옵션 관리</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {types.map(t => (
          <OptionTypeCard
            key={t}
            typeKey={t}
            label={TYPE_LABELS[t]}
            items={options[t] ?? []}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onColorChange={handleColorChange}
            onLabelChange={handleLabelChange}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>
    </div>
  )
}
