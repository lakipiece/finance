'use client'

import { useState, useMemo } from 'react'
import type { Dividend, Security, Account } from '@/lib/portfolio/types'
import { formatWonRound } from '@/lib/utils'
import { toKrw, taxKrw, fmtDate } from '@/lib/portfolio/dividendUtils'
import { btn, tbl } from '@/lib/styles'

type DividendRow = Dividend & {
  security: Pick<Security, 'ticker' | 'name' | 'currency'>
  account: Pick<Account, 'name' | 'broker' | 'owner'>
}

type SortMode = 'date' | 'amount'
const PAGE_SIZES = [20, 50, 100] as const

interface Props {
  dividends: DividendRow[]
  onEdit: (d: DividendRow) => void
  onDelete: (id: string) => void
  openAddModal: () => void
  palette: { colors: string[] }
}

export default function DividendTable({ dividends, onEdit, onDelete, openAddModal, palette }: Props) {
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('date')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = dividends
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
        ? toKrw(b) - toKrw(a)
        : fmtDate(b.paid_at).localeCompare(fmtDate(a.paid_at))
    )
  }, [dividends, search, sortMode])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <>
      {/* 헤더: 타이틀 + 검색 + 추가 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700 shrink-0">배당·분배금 내역</h3>
        <div className="flex items-center gap-2 flex-1 sm:justify-end">
          <div className="relative flex-1 sm:w-64 sm:flex-none">
            <input
              type="text"
              placeholder="내역 / 계좌 / 사용자 / 메모 검색..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-500 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-200 bg-white"
            />
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
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
      <div className="sm:hidden space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-slate-400 text-xs py-8">내역이 없습니다</p>
        )}
        {slice.map((d) => {
          const gross = toKrw(d)
          const tax = taxKrw(d)
          const net = gross - tax
          return (
            <div key={d.id} className="border border-slate-100 rounded-xl px-4 py-3 bg-white">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 shrink-0">
                    {d.security.ticker}
                  </span>
                  <span className="text-xs text-slate-500 truncate">{d.security.name}</span>
                </div>
                <span className="font-semibold text-slate-800 text-sm shrink-0 tabular-nums whitespace-nowrap">
                  {formatWonRound(net)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="tabular-nums">{fmtDate(d.paid_at)}</span>
                <span className="text-slate-500">{d.account.broker} · {d.account.name}</span>
              </div>
              {d.account.owner && (
                <div className="mt-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{d.account.owner}</span>
                </div>
              )}
              <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-50 text-[10px] text-slate-400 tabular-nums">
                <span>수령 {formatWonRound(gross)}</span>
                {tax > 0 && <span>세금 {formatWonRound(tax)}</span>}
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
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className={tbl.th}>#</th>
              <th className={tbl.th}>날짜</th>
              <th className={tbl.th}>종목</th>
              <th className={tbl.th}>계좌</th>
              <th className={tbl.th}>사용자</th>
              <th className={tbl.th}>메모</th>
              <th className={tbl.thRight}>수령액</th>
              <th className={tbl.thRight}>세금</th>
              <th className={tbl.thRight}>세후</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="py-10 text-center text-slate-400 text-xs">내역이 없습니다</td></tr>
            )}
            {slice.map((d, i) => {
              const gross = toKrw(d)
              const tax = taxKrw(d)
              const net = gross - tax
              return (
                <tr key={d.id} className={i % 2 === 1 ? tbl.rowOdd : tbl.rowEven}>
                  <td className="py-2.5 px-3 text-slate-300 text-xs">{(safePage - 1) * pageSize + i + 1}</td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(d.paid_at)}</td>
                  <td className={tbl.td}>
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {d.security.ticker}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5 max-w-[100px] truncate" title={d.security.name}>{d.security.name}</p>
                  </td>
                  <td className={tbl.td}>
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      {d.account.broker}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{d.account.name}</p>
                  </td>
                  <td className="py-2 px-3">
                    {d.account.owner
                      ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{d.account.owner}</span>
                      : <span className="text-slate-300 text-xs">-</span>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs max-w-[160px]">
                    {d.memo
                      ? <span className="block truncate" title={d.memo}>{d.memo}</span>
                      : <span className="text-slate-200">—</span>}
                  </td>
                  <td className={`${tbl.tdRight} font-semibold text-slate-800 whitespace-nowrap`}>{formatWonRound(gross)}</td>
                  <td className={`${tbl.tdRight} text-slate-400 whitespace-nowrap`}>
                    {tax > 0 ? formatWonRound(tax) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className={`${tbl.tdRight} font-semibold text-slate-700 whitespace-nowrap`}>{formatWonRound(net)}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2 justify-end">
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
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>총 {filtered.length.toLocaleString()}건</span>
          <span className="text-slate-200">|</span>
          {(['date', 'amount'] as const).map(mode => (
            <button key={mode} onClick={() => { setSortMode(mode); setPage(1) }}
              className={btn.pill(sortMode === mode)}
              style={sortMode === mode ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] } : undefined}>
              {mode === 'date' ? '날짜순' : '수령액순'}
            </button>
          ))}
          <span className="text-slate-200">|</span>
          <span>페이지당</span>
          {PAGE_SIZES.map(size => (
            <button key={size} onClick={() => { setPageSize(size as 20 | 50 | 100); setPage(1) }}
              className={btn.pill(pageSize === size)}
              style={pageSize === size ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] } : undefined}>
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
              <span key="cur" className="px-3 py-1 text-xs text-slate-600 font-medium">{safePage} / {totalPages}</span>
            )
            return (
              <button key={label} onClick={onClick!} disabled={disabled}
                className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                {label}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
