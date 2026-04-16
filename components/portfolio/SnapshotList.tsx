'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/lib/ThemeContext'

type SnapshotItem = {
  id: string
  date: string
  memo: string | null
  total_market_value: number | null
  total_invested: number | null
  sector_breakdown: Record<string, number> | null
}

interface Props {
  snapshots: SnapshotItem[]
  sectorColors?: Record<string, string>
}

function fmtKrw(v: number) {
  return `${Math.round(v).toLocaleString('ko-KR')}원`
}

export default function SnapshotList({ snapshots: initSnapshots, sectorColors = {} }: Props) {
  const { palette } = useTheme()
  const [snapshots, setSnapshots] = useState(initSnapshots)
  const [creating, setCreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [cloneTarget, setCloneTarget] = useState<SnapshotItem | null>(null)
  const [cloneDate, setCloneDate] = useState('')
  const [cloning, setCloning] = useState(false)
  const router = useRouter()

  // 같은 날짜 suffix
  const labelMap = (() => {
    const dateCount: Record<string, number> = {}
    const dateIdx: Record<string, number> = {}
    const result: Record<string, string> = {}
    for (const s of snapshots) dateCount[s.date] = (dateCount[s.date] ?? 0) + 1
    for (const s of snapshots) {
      const count = dateCount[s.date]
      if (count === 1) { result[s.id] = s.date }
      else {
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
      body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), clone_from: latest?.id ?? null }),
    })
    if (!res.ok) { setCreating(false); return }
    const snap = await res.json()
    setCreating(false)
    router.push(`/portfolio/snapshots/${snap.id}`)
  }

  async function handleRefreshValues() {
    setRefreshing(true)
    await fetch('/api/portfolio/snapshots/refresh-values', { method: 'POST' })
    setRefreshing(false)
    router.refresh()
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('스냅샷을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/portfolio/snapshots/${id}`, { method: 'DELETE' })
    if (res.ok) setSnapshots(prev => prev.filter(s => s.id !== id))
  }

  function openClone(snap: SnapshotItem, e: React.MouseEvent) {
    e.stopPropagation()
    setCloneTarget(snap)
    setCloneDate(new Date().toISOString().slice(0, 10))
  }

  async function handleCloneConfirm() {
    if (!cloneTarget || !cloneDate) return
    setCloning(true)
    const res = await fetch('/api/portfolio/snapshots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: cloneDate, clone_from: cloneTarget.id }),
    })
    setCloning(false)
    if (res.ok) {
      const snap = await res.json()
      setCloneTarget(null)
      router.push(`/portfolio/snapshots/${snap.id}`)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-700">스냅샷</h2>
        <div className="flex gap-2">
          <button onClick={handleRefreshValues} disabled={refreshing}
            className="border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50 disabled:opacity-50">
            {refreshing ? '업데이트 중...' : '평가액 업데이트'}
          </button>
          <button onClick={() => router.push('/portfolio/snapshots/charts')}
            className="border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-50">
            차트보기
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {snapshots.map((snap, i) => {
          const label = labelMap[snap.id]
          const [datePart, suffix] = label.includes(' -')
            ? [label.split(' -')[0], `-${label.split(' -')[1]}`]
            : [label, null]
          const mv = snap.total_market_value
          const inv = snap.total_invested
          const pnl = mv != null && inv != null ? mv - inv : null
          const pnlPct = pnl != null && inv != null && inv > 0 ? pnl / inv : null
          const sectors = snap.sector_breakdown
            ? Object.entries(snap.sector_breakdown).sort((a, b) => b[1] - a[1])
            : []

          return (
            <div key={snap.id}
              onClick={() => router.push(`/portfolio/snapshots/${snap.id}`)}
              className="bg-white rounded-2xl border border-slate-100 px-6 py-5 cursor-pointer hover:shadow-sm hover:border-slate-200 transition-all group relative flex flex-col">

              {/* 상단: 날짜(좌) + 평가액(우) */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-base font-bold text-slate-800 leading-tight">
                      {datePart.slice(0, 7)}
                    </p>
                    {suffix && <span className="text-xs font-normal text-slate-400">{suffix}</span>}
                    {i === 0 && (
                      <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full font-medium">최신</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{datePart}</p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                  {mv != null ? (
                    <p className="text-lg font-bold text-slate-400 leading-tight tabular-nums">{fmtKrw(mv)}</p>
                  ) : (
                    <p className="text-sm text-slate-300">—</p>
                  )}
                  {inv != null && (
                    <p className="text-[10px] text-slate-400 tabular-nums">{fmtKrw(inv)}</p>
                  )}
                  {pnl != null && (
                    <p className={`text-xs font-semibold tabular-nums ${pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {pnl >= 0 ? '+' : ''}{fmtKrw(pnl)}
                      {pnlPct != null && (
                        <span className="text-[10px] ml-0.5 opacity-80">
                          ({pnl >= 0 ? '+' : ''}{(pnlPct * 100).toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* 섹터 비중 — 전체 스크롤 */}
              {sectors.length > 0 && (
                <div className="mt-4 overflow-y-auto space-y-2 flex-1" style={{ maxHeight: '286px' }}>
                  {sectors.map(([k, v]) => {
                    const color = sectorColors[k] ?? '#94a3b8'
                    return (
                      <div key={k} className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 w-16 shrink-0 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-[10px] text-slate-600 truncate">{k}</span>
                        </div>
                        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden mx-2">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(v, 0), 100)}%`, backgroundColor: color }} />
                        </div>
                        <span className="text-[10px] text-slate-400 w-8 text-right tabular-nums shrink-0">{v.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {snap.memo && <p className="text-[10px] text-slate-300 mt-2 truncate">{snap.memo}</p>}

              {/* 편집/복제/삭제 — hover 시만 표시 */}
              <div className="flex justify-end gap-0.5 mt-4 pt-2 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); router.push(`/portfolio/snapshots/${snap.id}`) }}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-300 hover:text-slate-500 transition-colors" title="편집">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={e => openClone(snap, e)}
                  className="p-1.5 rounded hover:bg-blue-50 text-slate-300 hover:text-blue-400 transition-colors" title="복제">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button onClick={e => handleDelete(snap.id, e)}
                  className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors" title="삭제">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}

        {/* + 스냅샷 만들기 카드 */}
        <button
          onClick={handleCreate}
          disabled={creating}
          className="rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1.5 min-h-[220px] hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40 transition-all cursor-pointer group">
          <svg className="w-7 h-7 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="text-xs text-slate-300 group-hover:text-slate-500 transition-colors">
            {creating ? '생성 중...' : '추가'}
          </span>
        </button>
      </div>

      {/* 복제 확인 모달 */}
      {cloneTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setCloneTarget(null)}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full"
            onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-slate-800 mb-1">스냅샷 복제</p>
            <p className="text-xs text-slate-400 mb-4">
              <span className="font-medium text-slate-600">{cloneTarget.date}</span> 스냅샷의 모든 보유 내역을 복사합니다.
            </p>
            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-1 block">새 스냅샷 날짜</label>
              <input type="date" value={cloneDate}
                onChange={e => setCloneDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCloneConfirm} disabled={cloning || !cloneDate}
                className="flex-1 text-white px-4 py-2 rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: palette.colors[0] }}>
                {cloning ? '복제 중...' : '복제하기'}
              </button>
              <button onClick={() => setCloneTarget(null)}
                className="flex-1 text-slate-500 px-4 py-2 rounded-lg text-xs border border-slate-200 hover:bg-slate-50">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
