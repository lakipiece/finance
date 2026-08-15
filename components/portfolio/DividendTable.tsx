'use client'

import { useState, useMemo, useEffect } from 'react'
import type { Dividend, Security, Account } from '@/lib/portfolio/types'
import { formatWonRound } from '@/lib/utils'
import { toKrw, taxKrw, fmtDate } from '@/lib/portfolio/dividendUtils'
import { createPortal } from 'react-dom'
import { btn, tbl, modal } from '@/lib/styles'

type DividendRow = Dividend & {
  security: Pick<Security, 'ticker' | 'name' | 'currency'>
  account: Pick<Account, 'name' | 'broker' | 'owner' | 'dividend_tax_rate'>
}

type SortMode = 'date' | 'amount'
const PAGE_SIZES = [20, 50, 100] as const

interface MemberOpt { code: string; color: string }

interface Props {
  dividends: DividendRow[]
  selectedMonth?: string | null
  selectedSecurity?: string | null
  onClearSecurity?: () => void
  onEdit: (d: DividendRow) => void
  onDelete: (id: string) => void
  openAddModal: () => void
  palette: { colors: string[] }
}


/** 종목 배당 상세 레이어 — 리밸런싱의 종목 레이어와 같은 언어로 보여준다 */
function SecurityDividendDetail({ ticker, rows, onClose }: {
  ticker: string
  rows: DividendRow[]
  onClose: () => void
}) {
  const sec = rows[0].security
  const gross = rows.reduce((s, d) => s + toKrw(d), 0)
  const tax = rows.reduce((s, d) => s + taxKrw(d), 0)
  const net = gross - tax
  const latest = rows.reduce<string | null>((a, d) => (!a || d.paid_at > a ? d.paid_at : a), null)

  // 계좌별 / 연도별 분해
  const byAccount = new Map<string, number>()
  const byYear = new Map<string, number>()
  for (const d of rows) {
    byAccount.set(d.account.name, (byAccount.get(d.account.name) ?? 0) + toKrw(d) - taxKrw(d))
    const y = String(d.paid_at).slice(0, 4)
    byYear.set(y, (byYear.get(y) ?? 0) + toKrw(d) - taxKrw(d))
  }
  const metrics = [
    { label: '세후 합계', value: formatWonRound(net) },
    { label: '세전 합계', value: formatWonRound(gross) },
    { label: '원천징수', value: formatWonRound(tax) },
    { label: '지급 건수', value: `${rows.length}건` },
    { label: '최근 지급', value: latest ? fmtDate(latest) : '—' },
    { label: '통화', value: sec.currency },
  ]

  return createPortal(
    <div className={modal.overlayTop} onClick={onClose}>
      <div className={modal.containerLg} onClick={e => e.stopPropagation()}>
        <div className={modal.header}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-micro font-bold px-2 py-0.5 rounded-full font-mono bg-surface-low text-ink-2">{ticker}</span>
              <span className="text-micro tracking-normal text-ink-5">배당 이력</span>
            </div>
            <p className="text-title text-ink truncate">{sec.name}</p>
          </div>
          <button onClick={onClose} className={modal.close}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={modal.body}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {metrics.map(m => (
              <div key={m.label} className="rounded-card bg-surface-low px-[13px] py-[11px] min-w-0">
                <p className="text-micro text-ink-5 uppercase">{m.label}</p>
                <p className="text-heading text-ink tabular-nums mt-1 truncate">{m.value}</p>
              </div>
            ))}
          </div>
          {[
            { title: '계좌별 (세후)', entries: [...byAccount.entries()].sort((a, b) => b[1] - a[1]) },
            { title: '연도별 (세후)', entries: [...byYear.entries()].sort((a, b) => b[0].localeCompare(a[0])) },
          ].map(sec2 => (
            <div key={sec2.title}>
              <p className="text-micro text-ink-5 uppercase mb-1.5">{sec2.title}</p>
              <div className="rounded-card bg-surface-low px-[13px] py-1">
                {sec2.entries.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-2 py-[5px] border-b border-surface-container last:border-0">
                    <span className="text-body text-ink-2 truncate">{k}</span>
                    <span className="text-body font-medium text-ink tabular-nums shrink-0">{formatWonRound(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function DividendTable({ dividends, selectedMonth, selectedSecurity, onClearSecurity, onEdit, onDelete, openAddModal, palette }: Props) {
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('date')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)
  const [memberOpts, setMemberOpts] = useState<MemberOpt[]>([])
  const [detailTicker, setDetailTicker] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/options/members').then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length) setMemberOpts(data)
    }).catch(() => {})
  }, [])

  function ownerColor(code: string | null | undefined): string {
    if (!code) return '#8794a8'
    return memberOpts.find(m => m.code === code)?.color ?? '#8794a8'
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = dividends
    if (selectedMonth) list = list.filter(d => fmtDate(d.paid_at).startsWith(selectedMonth))
    if (selectedSecurity) list = list.filter(d => d.security.ticker === selectedSecurity)
    if (q) list = list.filter(d =>
      d.security.ticker.toLowerCase().includes(q) ||
      d.security.name.toLowerCase().includes(q) ||
      d.account.name.toLowerCase().includes(q) ||
      d.account.broker.toLowerCase().includes(q) ||
      (d.account.owner ?? '').toLowerCase().includes(q) ||
      (d.memo ?? '').toLowerCase().includes(q)
    )
    return [...list].sort((a, b) =>
      sortMode === 'amount'
        ? toKrw(b) - toKrw(a) || fmtDate(b.paid_at).localeCompare(fmtDate(a.paid_at))
        : fmtDate(b.paid_at).localeCompare(fmtDate(a.paid_at)) || toKrw(b) - toKrw(a)
    )
  }, [dividends, selectedMonth, selectedSecurity, search, sortMode])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div className="bg-surface-card rounded-card shadow-card p-[13px]">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-heading font-bold text-ink shrink-0">배당·분배금 내역</h3>
        <div className="flex items-center gap-2">
          {selectedMonth && (
            <span className="text-meta px-2 py-0.5 rounded-full bg-loss/10 text-loss">
              {selectedMonth} 필터링중
            </span>
          )}
          {selectedSecurity && (
            <button onClick={onClearSecurity}
              className="text-meta px-2 py-0.5 rounded-full bg-income/10 text-income hover:bg-income/10 transition-colors">
              {selectedSecurity} ✕
            </button>
          )}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="검색..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-36 pl-9 rounded-field bg-surface-low py-[9px] text-subhead text-ink placeholder:text-ink-5 focus:outline-none focus:bg-surface-card focus:shadow-focus transition-colors border-0"
            />
          </div>
          <button
            onClick={openAddModal}
            className={btn.primary}
            style={{ backgroundColor: palette.colors[0] }}>
            + 배당 추가
          </button>
        </div>
      </div>

      {/* 모바일 카드 뷰 */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-ink-4 text-body py-8">내역이 없습니다</p>
        )}
        {slice.map((d) => {
          const gross = toKrw(d)
          const tax = taxKrw(d)
          const net = gross - tax
          const color = ownerColor(d.account.owner)
          return (
            <div key={d.id} className="bg-surface-card rounded-card shadow-card p-[13px]">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <button type="button" onClick={() => setDetailTicker(d.security.ticker)}
                    className="text-left min-w-0 hover:underline underline-offset-2">
                    <span className="block text-micro tracking-normal font-mono text-ink-4">{d.security.ticker}</span>
                    <span className="text-body font-bold text-ink truncate block">{d.security.name}</span>
                  </button>
                </div>
                <span className="font-bold text-ink text-subhead shrink-0 tabular-nums whitespace-nowrap">
                  {formatWonRound(net)}
                </span>
              </div>
              <div className="flex items-center justify-between text-body text-ink-4">
                <span className="tabular-nums">{fmtDate(d.paid_at)}</span>
                <span className="text-ink-3">{d.account.broker} · {d.account.name}</span>
              </div>
              {d.account.owner && (
                <div className="mt-1">
                  <span className="text-micro tracking-normal font-bold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: `${color}22`, color }}>{d.account.owner}</span>
                </div>
              )}
              <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-surface-low text-micro tracking-normal text-ink-4 tabular-nums">
                <span>배당금 {formatWonRound(gross)}</span>
                {tax > 0 && <span>추정 세금 {formatWonRound(tax)}</span>}
              </div>
              <div className="flex items-center gap-2 justify-end mt-2">
                <button onClick={() => onEdit(d)} className={btn.icon} title="수정">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => onDelete(d.id)} className={btn.danger} title="삭제">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 데스크탑 테이블 뷰 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-subhead">
          <thead>
            <tr className="border-b border-surface-low">
              <th className={tbl.th}>#</th>
              <th className={tbl.th}>날짜</th>
              <th className={tbl.th}>종목</th>
              <th className={tbl.th}>계좌</th>
              <th className={tbl.th}>사용자</th>
              <th className={tbl.thRight}>배당금</th>
              <th className={tbl.thRight}>추정 세금</th>
              <th className={tbl.thRight}>세후 배당금</th>
              <th className={tbl.th}>메모</th>
              <th className="py-[5px] px-2 text-micro uppercase text-ink-5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="py-10 text-center text-ink-4 text-body font-medium">내역이 없습니다</td></tr>
            )}
            {slice.map((d, i) => {
              const gross = toKrw(d)
              const tax = taxKrw(d)
              const net = gross - tax
              const color = ownerColor(d.account.owner)
              return (
                <tr key={d.id} className={`group ${i % 2 === 1 ? tbl.rowOdd : tbl.rowEven}`}>
                  <td className="py-[5px] px-2 text-ink-5 text-body font-medium">{(safePage - 1) * pageSize + i + 1}</td>
                  <td className="py-[5px] px-2 text-ink-4 text-body font-medium whitespace-nowrap">{fmtDate(d.paid_at)}</td>
                  <td className={tbl.td}>
                    <button type="button" onClick={() => setDetailTicker(d.security.ticker)}
                      className="text-left min-w-0 hover:underline underline-offset-2">
                      <span className="block text-micro tracking-normal font-mono text-ink-4">{d.security.ticker}</span>
                      <span className="text-body font-bold text-ink max-w-[130px] truncate block" title={d.security.name}>{d.security.name}</span>
                    </button>
                  </td>
                  <td className={tbl.td}>
                    <span className="inline-block px-2 py-0.5 rounded-full text-body font-medium bg-surface-low text-ink-2">
                      {d.account.broker}
                    </span>
                    <p className="text-micro tracking-normal text-ink-4 mt-0.5">{d.account.name}</p>
                  </td>
                  <td className="py-[5px] px-2">
                    {d.account.owner
                      ? <span className="text-micro tracking-normal font-bold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: `${color}22`, color }}>
                          {d.account.owner}
                        </span>
                      : <span className="text-ink-5 text-body">-</span>}
                  </td>
                  <td className={`${tbl.tdRight} font-medium text-ink whitespace-nowrap`}>{formatWonRound(gross)}</td>
                  <td className={`${tbl.tdRight} text-ink-4 whitespace-nowrap`}>
                    {tax > 0 ? formatWonRound(tax) : <span className="text-ink-5">—</span>}
                  </td>
                  <td className={`${tbl.tdRight} font-medium text-ink whitespace-nowrap`}>{formatWonRound(net)}</td>
                  <td className="py-[5px] px-2 text-ink-4 text-body font-medium max-w-[160px]">
                    {d.memo
                      ? <span className="block truncate" title={d.memo}>{d.memo}</span>
                      : <span className="text-ink-5">—</span>}
                  </td>
                  <td className="py-[5px] px-2">
                    <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onEdit(d)}
                        className="p-1 rounded text-ink-5 hover:text-loss hover:bg-loss/10 transition-colors" title="수정">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => onDelete(d.id)}
                        className="p-1 rounded text-ink-5 hover:text-gain hover:bg-gain/10 transition-colors" title="삭제">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between pt-3 border-t border-surface-low flex-wrap gap-3">
        <div className="flex items-center gap-2 text-body text-ink-4">
          <span>총 {filtered.length.toLocaleString()}건</span>
          <span className="text-ink-5">|</span>
          {(['date', 'amount'] as const).map(mode => (
            <button key={mode} onClick={() => { setSortMode(mode); setPage(1) }}
              className={`px-2 py-0.5 rounded text-body transition-colors ${sortMode !== mode ? 'bg-surface-low text-ink-3 hover:bg-surface-high' : 'font-medium'}`}
              style={sortMode === mode ? { background: '#1A237E', color: '#fff' } : undefined}>
              {mode === 'date' ? '날짜순' : '금액순'}
            </button>
          ))}
          <span className="text-ink-5">|</span>
          <span>페이지당</span>
          {PAGE_SIZES.map(size => (
            <button key={size} onClick={() => { setPageSize(size as 20 | 50 | 100); setPage(1) }}
              className={`px-2 py-0.5 rounded text-body transition-colors ${pageSize !== size ? 'bg-surface-low text-ink-3 hover:bg-surface-high' : 'font-medium'}`}
              style={pageSize === size ? { background: '#1A237E', color: '#fff' } : undefined}>
              {size}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {(['처음', '이전', null, '다음', '끝'] as const).map((label, idx) => {
            const disabled = idx < 2 ? safePage === 1 : safePage === totalPages
            const onClick = [
              () => setPage(1),
              () => setPage(p => Math.max(1, p - 1)),
              null,
              () => setPage(p => Math.min(totalPages, p + 1)),
              () => setPage(totalPages),
            ][idx]
            if (label === null) return (
              <span key="cur" className="px-3 py-1 text-body text-ink-2 font-medium">{safePage} / {totalPages}</span>
            )
            return (
              <button key={label} onClick={onClick!} disabled={disabled}
                className="px-2 py-1 rounded text-body text-ink-3 hover:bg-surface-low disabled:opacity-30 disabled:cursor-not-allowed">
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
