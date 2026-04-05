'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Snapshot } from '@/lib/portfolio/types'

interface Props { snapshots: Snapshot[] }

export default function SnapshotList({ snapshots }: Props) {
  const [creating, setCreating] = useState(false)
  const router = useRouter()

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
    if (!res.ok) {
      setCreating(false)
      return
    }
    const snap = await res.json()
    setCreating(false)
    router.push(`/portfolio/snapshots/${snap.id}`)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-800">스냅샷</h2>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50"
        >
          {creating ? '생성 중...' : '+ 스냅샷 만들기'}
        </button>
      </div>

      {snapshots.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-12">
          아직 스냅샷이 없습니다. 첫 번째 스냅샷을 만들어보세요.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {snapshots.map((snap, i) => (
            <div
              key={snap.id}
              onClick={() => router.push(`/portfolio/snapshots/${snap.id}`)}
              className="bg-white rounded-2xl border border-slate-100 p-4 aspect-square flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-slate-200 transition-all"
            >
              <div>
                {i === 0 && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">최신</span>
                )}
              </div>
              <div>
                <p className="text-xl font-bold text-slate-800 leading-tight">{snap.date.slice(0, 7)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{snap.date.slice(8, 10)}일</p>
                {snap.memo && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{snap.memo}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
