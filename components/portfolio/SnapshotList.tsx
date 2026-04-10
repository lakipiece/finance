'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Snapshot } from '@/lib/portfolio/types'

interface Props { snapshots: Snapshot[] }

export default function SnapshotList({ snapshots: initSnapshots }: Props) {
  const [snapshots, setSnapshots] = useState(initSnapshots)
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  // 같은 날짜가 여러 개면 -2, -3 suffix 부여 (첫 번째는 suffix 없음)
  const labelMap = (() => {
    const dateCount: Record<string, number> = {}
    const dateIdx: Record<string, number> = {}
    const result: Record<string, string> = {}
    for (const s of snapshots) {
      dateCount[s.date] = (dateCount[s.date] ?? 0) + 1
    }
    for (const s of snapshots) {
      const count = dateCount[s.date]
      if (count === 1) {
        result[s.id] = s.date
      } else {
        dateIdx[s.date] = (dateIdx[s.date] ?? 0) + 1
        result[s.id] = dateIdx[s.date] === 1 ? s.date : `${s.date} -${dateIdx[s.date]}`
      }
    }
    return result
  })()

  async function handleCreate() {
    setCreating(true)
    const latest = snapshots[0]
    const res = await fetch('/api/portfolio/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toISOString().slice(0, 10),
        clone_from: latest?.id ?? null,
      }),
    })
    if (!res.ok) { setCreating(false); return }
    const snap = await res.json()
    setCreating(false)
    router.push(`/portfolio/snapshots/${snap.id}`)
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('스냅샷을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/portfolio/snapshots/${id}`, { method: 'DELETE' })
    if (res.ok) setSnapshots(prev => prev.filter(s => s.id !== id))
  }

  function handleEdit(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    router.push(`/portfolio/snapshots/${id}`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700">스냅샷</h2>
        <button onClick={handleCreate} disabled={creating}
          className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
          {creating ? '생성 중...' : '+ 스냅샷 만들기'}
        </button>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-12">아직 스냅샷이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
          {snapshots.map((snap, i) => {
            const label = labelMap[snap.id]
            const [datePart, suffix] = label.includes(' -') ? [label.split(' -')[0], `-${label.split(' -')[1]}`] : [label, null]
            return (
              <div key={snap.id} onClick={() => router.push(`/portfolio/snapshots/${snap.id}`)}
                className="bg-white rounded-xl border border-slate-100 px-3 py-2.5 cursor-pointer hover:shadow-sm hover:border-slate-200 transition-all group relative">
                {/* 최신 뱃지 */}
                {i === 0 && (
                  <span className="text-[9px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium">최신</span>
                )}
                {/* 날짜 */}
                <div className="mt-1">
                  <p className="text-sm font-semibold text-slate-700 leading-tight">{datePart.slice(0, 7)}</p>
                  <p className="text-[10px] text-slate-400">
                    {datePart.slice(8, 10)}일{suffix && <span className="text-slate-300 ml-0.5">{suffix}</span>}
                  </p>
                </div>
                {snap.memo && <p className="text-[9px] text-slate-300 mt-1 truncate">{snap.memo}</p>}
                {/* 편집/삭제 아이콘 — hover 시 표시 */}
                <div className="absolute bottom-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => handleEdit(snap.id, e)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={e => handleDelete(snap.id, e)}
                    className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
