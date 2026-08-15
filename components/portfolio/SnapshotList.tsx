'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { btn } from '@/lib/styles'
import DateInput from '@/components/ui/DateInput'
import PageHeader from '@/components/ui/PageHeader'
import { snapshotMetrics } from '@/lib/portfolio/metrics'
import type { AccountCashflowEvent, AccountSnapshotEntry } from '@/lib/portfolio/metrics'

type SnapshotItem = {
  id: string
  date: string
  memo: string | null
  total_market_value: number | null
  total_invested: number | null
  sector_breakdown: Record<string, number> | null
  account_breakdown?: Record<string, AccountSnapshotEntry>
}

export type SnapshotViewMode = 'last' | 'first' | 'all'

export const SNAPSHOT_VIEW_LABELS: Record<SnapshotViewMode, string> = {
  last: '월별 최종',
  first: '월별 최초',
  all: '전체',
}

interface Props {
  snapshots: SnapshotItem[]
  sectorColors?: Record<string, string>
  cashflowEvents?: AccountCashflowEvent[]
  /** 'YYYY-MM' → 해당 월 배당 합계 (KRW) */
  dividendsByMonth?: Record<string, number>
}

function fmtKrw(v: number) {
  return `${Math.round(v).toLocaleString('ko-KR')}원`
}

export default function SnapshotList({ snapshots: initSnapshots, sectorColors = {}, cashflowEvents = [], dividendsByMonth = {} }: Props) {
  const [snapshots, setSnapshots] = useState(initSnapshots)
  const [refreshing, setRefreshing] = useState(false)
  const [cloneTarget, setCloneTarget] = useState<SnapshotItem | null>(null)
  const [cloneDate, setCloneDate] = useState('')
  const [cloning, setCloning] = useState(false)
  const [viewMode, setViewMode] = useState<SnapshotViewMode>('last')
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())
  const router = useRouter()

  // 같은 날짜 suffix
  const labelMap = useMemo(() => {
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
  }, [snapshots])

  // 월별 그루핑 (snapshots는 date DESC 정렬)
  const months = useMemo(() => {
    const map = new Map<string, SnapshotItem[]>()
    for (const s of snapshots) {
      const ym = s.date.slice(0, 7)
      if (!map.has(ym)) map.set(ym, [])
      map.get(ym)!.push(s)
    }
    return [...map.entries()]  // [ym, 해당 월 스냅샷들(최신순)]
  }, [snapshots])

  // 표시 목록: 대표 카드 + 펼친 월의 나머지
  const visibleItems = useMemo(() => {
    if (viewMode === 'all') {
      return snapshots.map(s => ({ snap: s, hiddenSiblings: 0, ym: s.date.slice(0, 7) }))
    }
    const out: { snap: SnapshotItem; hiddenSiblings: number; ym: string }[] = []
    for (const [ym, items] of months) {
      // 최신순이므로 월별 최종=첫번째, 월별 최초=마지막
      const rep = viewMode === 'last' ? items[0] : items[items.length - 1]
      const others = items.filter(s => s.id !== rep.id)
      out.push({ snap: rep, hiddenSiblings: expandedMonths.has(ym) ? 0 : others.length, ym })
      if (expandedMonths.has(ym)) {
        for (const s of others) out.push({ snap: s, hiddenSiblings: 0, ym })
      }
    }
    return out
  }, [viewMode, months, snapshots, expandedMonths])

  function toggleMonth(ym: string) {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(ym)) next.delete(ym)
      else next.add(ym)
      return next
    })
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

  function handleExport(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const a = document.createElement('a')
    a.href = `/api/portfolio/snapshots/${id}/export`
    a.click()
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

  const hasLedger = cashflowEvents.length > 0
  const latestId = snapshots[0]?.id

  return (
    <div className="space-y-6">
      <PageHeader title="스냅샷" description="포트폴리오 시점별 기록">
        <button onClick={handleRefreshValues} disabled={refreshing} className={btn.secondary}>
          {refreshing ? '계산 중…' : '값 갱신'}
        </button>
        <button onClick={() => router.push(`/portfolio/snapshots/charts?view=${viewMode}`)} className={btn.primary}>
          차트보기
        </button>
      </PageHeader>

      {/* 보기 필터 — 차트보기에도 동일 모드가 전달된다 */}
      <div className="flex items-center gap-1.5">
        {(Object.keys(SNAPSHOT_VIEW_LABELS) as SnapshotViewMode[]).map(m => {
          const active = viewMode === m
          return (
            <button key={m} onClick={() => { setViewMode(m); setExpandedMonths(new Set()) }}
              className={btn.pill(active)}>
              {SNAPSHOT_VIEW_LABELS[m]}
            </button>
          )
        })}
        <span className="text-micro tracking-normal text-ink-5 ml-1">
          {viewMode === 'all' ? `${snapshots.length}개` : `${months.length}개월 · 총 ${snapshots.length}개`}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {visibleItems.map(({ snap, hiddenSiblings, ym }) => {
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

          // 계좌별 하이브리드: 원장 계좌는 누적입금, 미기록 계좌는 평균매수금액 폴백
          const m = hasLedger && mv != null
            ? snapshotMetrics(snap.account_breakdown ?? null, cashflowEvents, snap.date, { value: mv, cost: inv ?? 0 })
            : null
          const profit = m?.ledgerApplied ? m.profit : null
          const profitRate = m?.ledgerApplied ? m.rate : null

          const monthDividend = dividendsByMonth[ym] ?? 0

          return (
            <div key={snap.id}
              onClick={() => router.push(`/portfolio/snapshots/${snap.id}`)}
              className={`rounded-card p-[13px] cursor-pointer transition-transform hover:-translate-y-0.5 group relative flex flex-col ${
                snap.id === latestId
                  ? 'bg-surface-card shadow-dialog'
                  : 'bg-surface-card shadow-card'
              }`}>

              {/* 상단: 날짜(좌) + 평가액(우) */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-heading text-ink leading-tight tabular-nums">
                      {datePart.slice(0, 7)}
                    </p>
                    {suffix ? <span className="text-body font-normal text-ink-4">{suffix}</span> : null}
                    {snap.id === latestId ? (
                      <span className="text-micro tracking-normal px-1.5 py-0.5 rounded-full bg-action text-white shrink-0">최신</span>
                    ) : null}
                    {hiddenSiblings > 0 ? (
                      <button
                        onClick={e => { e.stopPropagation(); toggleMonth(ym) }}
                        className="text-micro tracking-normal px-1.5 py-0.5 rounded-full bg-surface-low text-ink-3 hover:bg-surface-high transition-colors"
                        title="이 달의 다른 스냅샷 펼치기">
                        +{hiddenSiblings}
                      </button>
                    ) : null}
                  </div>
                  <p className="text-micro tracking-normal text-ink-5 mt-0.5 tabular-nums">{datePart}</p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                  {mv != null ? (
                    <p className="text-heading text-ink leading-tight tabular-nums">{fmtKrw(mv)}</p>
                  ) : (
                    <p className="text-subhead text-ink-5">—</p>
                  )}
                  {inv != null ? (
                    <p className="text-micro tracking-normal text-ink-4 tabular-nums" title="평균매수금액">{fmtKrw(inv)}</p>
                  ) : null}
                  {pnl != null ? (
                    <p className={`text-body font-medium tabular-nums ${pnl >= 0 ? 'text-gain' : 'text-loss'}`}
                      title="평가손익 (평가액 − 평균매수금액)">
                      {pnl >= 0 ? '+' : ''}{fmtKrw(pnl)}
                      {pnlPct != null ? (
                        <span className="text-micro tracking-normal ml-0.5 opacity-80">
                          ({pnl >= 0 ? '+' : ''}{(pnlPct * 100).toFixed(1)}%)
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* 수익금액 · 당월 배당 (원장 기준) */}
              {profit != null || monthDividend > 0 ? (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-low text-meta">
                  {profit != null ? (
                    <span className={`font-medium tabular-nums ${profit >= 0 ? 'text-gain' : 'text-loss'}`}
                      title="수익금액 = 평가액 + 누적출금 − 누적입금">
                      수익 {profit >= 0 ? '+' : ''}{fmtKrw(profit)}
                      {profitRate != null ? (
                        <span className="text-micro tracking-normal ml-0.5 opacity-80">({profitRate >= 0 ? '+' : ''}{(profitRate * 100).toFixed(1)}%)</span>
                      ) : null}
                    </span>
                  ) : <span />}
                  {monthDividend > 0 ? (
                    <span className="text-ink-4 tabular-nums" title="이 달에 받은 배당·분배금">
                      월배당 {fmtKrw(monthDividend)}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {/* 섹터 비중 — 전체 스크롤 */}
              {sectors.length > 0 ? (
                <div className="mt-2 overflow-y-auto flex-1" style={{ maxHeight: '286px' }}>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {sectors.map(([k, v]) => {
                      const color = sectorColors[k] ?? '#a8b3c4'
                      return (
                        <div key={k} className="flex items-center gap-1 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-micro tracking-normal text-ink-2 truncate flex-1 min-w-0">{k}</span>
                          <span className="text-micro tracking-normal text-ink-4 tabular-nums shrink-0">{v.toFixed(1)}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {snap.memo ? <p className="text-micro tracking-normal text-ink-5 mt-2 truncate">{snap.memo}</p> : null}

              {/* CSV 내보내기(좌) + 편집/복제/삭제(우) — hover 시만 표시 */}
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-surface-low opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => handleExport(snap.id, e)}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-btn hover:bg-surface-low text-ink-5 hover:text-ink-2 transition-colors" title="CSV 내보내기">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="text-micro tracking-normal font-medium">CSV</span>
                </button>
                <div className="flex gap-0.5">
                <button onClick={e => { e.stopPropagation(); router.push(`/portfolio/snapshots/${snap.id}`) }}
                  className="p-1.5 rounded-btn hover:bg-surface-low text-ink-5 hover:text-ink-2 transition-colors" title="편집">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={e => openClone(snap, e)}
                  className="p-1.5 rounded-btn hover:bg-surface-low text-ink-5 hover:text-ink-2 transition-colors" title="복제">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button onClick={e => handleDelete(snap.id, e)}
                  className="p-1.5 rounded-btn hover:bg-danger/10 text-ink-5 hover:text-danger transition-colors" title="삭제">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                </div>
              </div>
            </div>
          )
        })}

      </div>

      {/* 복제 확인 모달 */}
      {cloneTarget ? (
        <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-dialog p-[18px] shadow-dialog max-w-sm w-full"
            onClick={e => e.stopPropagation()}>
            <p className="text-heading text-ink mb-1">스냅샷 복제</p>
            <p className="text-body text-ink-4 mb-4">
              <span className="font-medium text-ink-2">{cloneTarget.date}</span> 스냅샷의 모든 보유 내역을 복사합니다.
            </p>
            <div className="mb-4">
              <label className="text-micro tracking-normal text-ink-4 mb-2 block">새 스냅샷 날짜</label>
              <DateInput value={cloneDate} onChange={setCloneDate} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleCloneConfirm} disabled={cloning || !cloneDate}
                className="flex-1 bg-action text-white px-4 py-2 rounded-btn text-body font-bold hover:opacity-90 disabled:opacity-60 transition-opacity">
                {cloning ? '복제 중...' : '복제하기'}
              </button>
              <button onClick={() => setCloneTarget(null)}
                className="flex-1 bg-surface-high text-ink-2 px-4 py-2 rounded-btn text-body font-medium hover:opacity-90 transition-opacity">
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
