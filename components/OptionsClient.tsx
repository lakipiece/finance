'use client'

import { useState } from 'react'
import { CATEGORIES } from '@/lib/utils'

interface Member { code: string; display_name: string; color: string }
interface PaymentMethod { id: number; name: string; order_idx: number }
interface DetailOption { id: number; name: string; category: string }

interface Props {
  initialMembers: Member[]
  initialMethods: PaymentMethod[]
  initialDetails: DetailOption[]
}

const PRESET_COLORS = [
  '#1565C0', '#AD1457', '#2E7D32', '#E65100', '#6A1B9A',
  '#00695C', '#4527A0', '#1565C0', '#37474F', '#BF360C',
]

function ColorDot({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-5 h-5 rounded-full transition-all ${selected ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : 'hover:scale-110'}`}
      style={{ backgroundColor: color }} />
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">{title}</h2>
      {children}
    </div>
  )
}

export default function OptionsClient({ initialMembers, initialMethods, initialDetails }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [methods, setMethods] = useState<PaymentMethod[]>(initialMethods)
  const [details, setDetails] = useState<DetailOption[]>(initialDetails)

  /* ── Members ── */
  const [newMemberCode, setNewMemberCode] = useState('')
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberColor, setNewMemberColor] = useState(PRESET_COLORS[0])
  const [editMember, setEditMember] = useState<Member | null>(null)

  async function saveMember() {
    if (!newMemberCode.trim()) return
    const res = await fetch('/api/options/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newMemberCode.trim().toUpperCase(), display_name: newMemberName.trim() || newMemberCode.trim().toUpperCase(), color: newMemberColor }),
    })
    if (res.ok) {
      const row = await res.json()
      setMembers(prev => [...prev.filter(m => m.code !== row.code), row].sort((a, b) => a.code.localeCompare(b.code)))
      setNewMemberCode(''); setNewMemberName('')
    }
  }

  async function updateMember(m: Member) {
    const res = await fetch(`/api/options/members/${m.code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: m.display_name, color: m.color }),
    })
    if (res.ok) {
      const row = await res.json()
      setMembers(prev => prev.map(x => x.code === row.code ? row : x))
      setEditMember(null)
    }
  }

  async function deleteMember(code: string) {
    if (!confirm(`사용자 "${code}"를 삭제하시겠습니까?`)) return
    await fetch(`/api/options/members/${code}`, { method: 'DELETE' })
    setMembers(prev => prev.filter(m => m.code !== code))
  }

  /* ── Methods ── */
  const [newMethod, setNewMethod] = useState('')
  const [editMethod, setEditMethod] = useState<PaymentMethod | null>(null)

  async function addMethod() {
    if (!newMethod.trim()) return
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
  }

  async function updateMethod(m: PaymentMethod) {
    const res = await fetch(`/api/options/methods/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: m.name }),
    })
    if (res.ok) {
      const row = await res.json()
      setMethods(prev => prev.map(x => x.id === row.id ? row : x))
      setEditMethod(null)
    }
  }

  async function deleteMethod(id: number) {
    if (!confirm('결제수단을 삭제하시겠습니까?')) return
    await fetch(`/api/options/methods/${id}`, { method: 'DELETE' })
    setMethods(prev => prev.filter(m => m.id !== id))
  }

  /* ── Details ── */
  const [newDetailName, setNewDetailName] = useState('')
  const [newDetailCat, setNewDetailCat] = useState('')
  const [editDetail, setEditDetail] = useState<DetailOption | null>(null)
  const [detailCatFilter, setDetailCatFilter] = useState('')

  async function addDetail() {
    if (!newDetailName.trim()) return
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
  }

  async function updateDetail(d: DetailOption) {
    const res = await fetch(`/api/options/details/${d.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d.name, category: d.category }),
    })
    if (res.ok) {
      const row = await res.json()
      setDetails(prev => prev.map(x => x.id === row.id ? row : x))
      setEditDetail(null)
    }
  }

  async function deleteDetail(id: number) {
    if (!confirm('세부유형을 삭제하시겠습니까?')) return
    await fetch(`/api/options/details/${id}`, { method: 'DELETE' })
    setDetails(prev => prev.filter(d => d.id !== id))
  }

  const filteredDetails = detailCatFilter
    ? details.filter(d => d.category === detailCatFilter)
    : details

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>가계부 옵션</h1>
        <p className="text-xs text-slate-400 mt-0.5">사용자, 결제수단, 세부유형 관리</p>
      </div>

      {/* ── 사용자 ── */}
      <SectionCard title="사용자">
        <div className="space-y-2 mb-4">
          {members.map(m => (
            <div key={m.code} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              {editMember?.code === m.code ? (
                <>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: editMember.color }}>{editMember.code}</div>
                  <input value={editMember.display_name}
                    onChange={e => setEditMember({ ...editMember, display_name: e.target.value })}
                    className="flex-1 text-xs border-b border-slate-200 focus:outline-none focus:border-blue-400 bg-transparent" />
                  <div className="flex gap-1">
                    {PRESET_COLORS.map(c => <ColorDot key={c} color={c} selected={editMember.color === c} onClick={() => setEditMember({ ...editMember, color: c })} />)}
                  </div>
                  <button onClick={() => updateMember(editMember)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">저장</button>
                  <button onClick={() => setEditMember(null)} className="text-xs text-slate-400 hover:text-slate-600">취소</button>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: m.color }}>{m.code}</div>
                  <span className="flex-1 text-sm text-slate-700">{m.display_name}</span>
                  <span className="text-xs text-slate-400 font-mono">{m.code}</span>
                  <button onClick={() => setEditMember({ ...m })} className="text-xs text-slate-400 hover:text-slate-600">수정</button>
                  <button onClick={() => deleteMember(m.code)} className="text-xs text-rose-300 hover:text-rose-500">삭제</button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add member */}
        <div className="flex items-end gap-2 flex-wrap pt-2 border-t border-slate-100">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 font-medium uppercase">코드</label>
            <input value={newMemberCode} onChange={e => setNewMemberCode(e.target.value)} maxLength={10}
              placeholder="예: M" className="w-16 text-xs border-b border-slate-200 focus:outline-none focus:border-blue-400 bg-transparent py-1" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-24">
            <label className="text-[10px] text-slate-400 font-medium uppercase">표시명</label>
            <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} maxLength={20}
              placeholder="예: 남편" className="text-xs border-b border-slate-200 focus:outline-none focus:border-blue-400 bg-transparent py-1" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 font-medium uppercase">색상</label>
            <div className="flex gap-1 flex-wrap">
              {PRESET_COLORS.map(c => <ColorDot key={c} color={c} selected={newMemberColor === c} onClick={() => setNewMemberColor(c)} />)}
            </div>
          </div>
          <button onClick={saveMember}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
            style={{ backgroundColor: '#1A237E' }}>추가</button>
        </div>
      </SectionCard>

      {/* ── 결제수단 ── */}
      <SectionCard title="결제수단">
        <div className="space-y-2 mb-4">
          {methods.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
              {editMethod?.id === m.id ? (
                <>
                  <input value={editMethod.name}
                    onChange={e => setEditMethod({ ...editMethod, name: e.target.value })}
                    className="flex-1 text-xs border-b border-slate-200 focus:outline-none focus:border-blue-400 bg-transparent" />
                  <button onClick={() => updateMethod(editMethod)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">저장</button>
                  <button onClick={() => setEditMethod(null)} className="text-xs text-slate-400 hover:text-slate-600">취소</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-slate-700">{m.name}</span>
                  <button onClick={() => setEditMethod({ ...m })} className="text-xs text-slate-400 hover:text-slate-600">수정</button>
                  <button onClick={() => deleteMethod(m.id)} className="text-xs text-rose-300 hover:text-rose-500">삭제</button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2 pt-2 border-t border-slate-100">
          <input value={newMethod} onChange={e => setNewMethod(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMethod()}
            placeholder="새 결제수단 이름" maxLength={20}
            className="flex-1 text-xs border-b border-slate-200 focus:outline-none focus:border-blue-400 bg-transparent py-1" />
          <button onClick={addMethod}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: '#1A237E' }}>추가</button>
        </div>
      </SectionCard>

      {/* ── 세부유형 ── */}
      <SectionCard title="세부유형">
        {/* Category filter */}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button onClick={() => setDetailCatFilter('')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${!detailCatFilter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            전체
          </button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setDetailCatFilter(prev => prev === c ? '' : c)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${detailCatFilter === c ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {c}
            </button>
          ))}
          <button onClick={() => setDetailCatFilter('none')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${detailCatFilter === 'none' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            미분류
          </button>
        </div>

        <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
          {(detailCatFilter === 'none'
            ? details.filter(d => d.category === '')
            : filteredDetails
          ).map(d => (
            <div key={d.id} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
              {editDetail?.id === d.id ? (
                <>
                  <input value={editDetail.name}
                    onChange={e => setEditDetail({ ...editDetail, name: e.target.value })}
                    className="flex-1 text-xs border-b border-slate-200 focus:outline-none focus:border-blue-400 bg-transparent" />
                  <select value={editDetail.category}
                    onChange={e => setEditDetail({ ...editDetail, category: e.target.value })}
                    className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white">
                    <option value="">미분류</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={() => updateDetail(editDetail)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">저장</button>
                  <button onClick={() => setEditDetail(null)} className="text-xs text-slate-400 hover:text-slate-600">취소</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-slate-700">{d.name}</span>
                  {d.category && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{d.category}</span>}
                  <button onClick={() => setEditDetail({ ...d })} className="text-xs text-slate-400 hover:text-slate-600">수정</button>
                  <button onClick={() => deleteDetail(d.id)} className="text-xs text-rose-300 hover:text-rose-500">삭제</button>
                </>
              )}
            </div>
          ))}
          {filteredDetails.length === 0 && (
            <p className="text-xs text-slate-400 py-4 text-center">세부유형이 없습니다</p>
          )}
        </div>

        <div className="flex items-end gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <div className="flex flex-col gap-1 flex-1 min-w-32">
            <label className="text-[10px] text-slate-400 font-medium uppercase">이름</label>
            <input value={newDetailName} onChange={e => setNewDetailName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDetail()}
              placeholder="예: 식비" maxLength={30}
              className="text-xs border-b border-slate-200 focus:outline-none focus:border-blue-400 bg-transparent py-1" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-slate-400 font-medium uppercase">카테고리</label>
            <select value={newDetailCat} onChange={e => setNewDetailCat(e.target.value)}
              className="text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none">
              <option value="">미분류</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={addDetail}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: '#1A237E' }}>추가</button>
        </div>
      </SectionCard>
    </div>
  )
}
