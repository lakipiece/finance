'use client'

// 목록 카드 — 카테고리 분해·기록·요약 (app/input/page.tsx에서 분리)
import { INCOME_CATEGORY_COLORS, EXPENSE_ACCENT, INCOME_ACCENT, memberBadgeStyle } from '@/lib/palettes'
import { useContext } from 'react'
import { INCOME_COLORS, formatWonFull, formatDate } from '@/lib/utils'
import CategoryBadge from '@/components/ui/CategoryBadge'
import { field, color as tone } from '@/lib/styles'
import { useTheme } from '@/lib/ThemeContext'
import { FormCtx } from './shared'
import { ExpenseIcon, IncomeIcon } from './fields'
import { AnyRecord, IncomeRecord } from './modals'

export function CategoryBreakdown({ category, items, color, activeItem, onItemClick }: {
  category: string
  items: { name: string; amount: number; pct: number }[]
  color?: string
  activeItem: string | null
  onItemClick: (name: string) => void
}) {
  const maxPct = items[0]?.pct ?? 1
  return (
    <div className="mb-6 px-4 py-3 bg-surface-low rounded-field">
      {/* 필터 칩이 붙어도 높이가 변하지 않도록 자리를 미리 잡아 둔다 —
          안 그러면 필터를 걸 때마다 아래 내용이 몇 px씩 밀린다 */}
      <div className="flex items-center gap-2 mb-3 min-h-[22px]">
        <p className="text-meta font-medium text-ink-3">{category} 항목별 집계</p>
        {activeItem ? <button onClick={() => onItemClick(activeItem)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-micro tracking-normal font-medium bg-surface-card text-ink-3 hover:text-ink transition-colors">
            {activeItem}
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button> : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-1.5">
        {items.map((item, idx) => {
          const isActive = activeItem === item.name
          return (
            <button key={item.name} onClick={() => onItemClick(item.name)}
              className={`flex items-center gap-2 min-w-0 w-full text-left rounded-btn px-1.5 py-1 transition-colors ${
                isActive ? 'bg-surface-card shadow-card' : 'hover:bg-surface-card/60'
              }`}>
              <span className="text-micro tracking-normal text-ink-5 w-3.5 shrink-0 text-right">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className={`text-meta truncate ${isActive ? 'font-medium' : 'text-ink-2'}`}
                    style={isActive ? { color } : undefined}>{item.name}</span>
                  <span className="text-micro tracking-normal text-ink-4 shrink-0">{Math.round(item.pct * 100)}%</span>
                </div>
                <div className="h-0.5 bg-surface-high rounded-full">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${(item.pct / maxPct) * 100}%`, backgroundColor: color ?? tone.ink5, opacity: isActive ? 1 : 0.45 }} />
                </div>
              </div>
              <span className={`text-meta font-medium shrink-0 tabular-nums ${isActive ? '' : 'text-ink'}`}
                style={isActive ? { color } : undefined}>
                {item.amount.toLocaleString('ko-KR')}원
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}


/* ── Record Card ── */
export function RecordCard({ record, onClick }: { record: AnyRecord; onClick: () => void }) {
  const { memberOpts } = useContext(FormCtx)
  const { catColors } = useTheme()
  const isExpense = record.type === 'expense'
  const label = isExpense ? (record.detail || record.category) : (record as IncomeRecord).description
  const incomeColor = !isExpense ? (INCOME_COLORS[record.category] ?? INCOME_CATEGORY_COLORS['기타']) : undefined
  const memberColor = record.member ? (memberOpts.find(m => m.code === record.member)?.color ?? tone.ink3) : undefined

  return (
    <button onClick={onClick}
      className="text-left w-full bg-surface-card rounded-card p-3 shadow-card transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 수입/지출 아이콘 */}
          <span className={`flex items-center justify-center w-5 h-5 rounded-full ${
            isExpense ? 'bg-surface-low text-ink-4' : 'text-white'
          }`} style={!isExpense ? { backgroundColor: tone.income } : undefined}>
            {isExpense ? <ExpenseIcon /> : <IncomeIcon />}
          </span>
          <CategoryBadge category={record.category} size="sm"
            color={isExpense ? (catColors[record.category] ?? tone.ink5) : incomeColor} />
        </div>
        <span className={`text-subhead font-bold shrink-0 ${isExpense ? 'text-ink' : ''}`}
          style={!isExpense ? { color: tone.income } : undefined}>
          {formatWonFull(record.amount)}
        </span>
      </div>
      <p className="text-body text-ink font-medium truncate mb-1">{label}</p>
      {record.memo ? <p className="text-micro tracking-normal text-ink-4 truncate mb-1">{record.memo}</p> : null}
      <div className="flex items-center justify-between">
        <span className="text-micro tracking-normal text-ink-4 tabular-nums">{formatDate(record.date)}</span>
        <div className="flex items-center gap-1.5">
          {isExpense && record.method ? <span className="text-micro tracking-normal text-ink-4">{record.method}</span> : null}
          {record.member && memberColor ? <span className="text-micro tracking-normal font-bold px-1.5 py-0.5 rounded"
              style={memberBadgeStyle(memberColor)}>{record.member}</span> : null}
        </div>
      </div>
    </button>
  )
}

/* ── Summary Card ── */
export const EXPENSE_COLOR = EXPENSE_ACCENT
export const INCOME_COLOR = INCOME_ACCENT

export function SummaryCard({ expenseCount, expenseTotal, incomeCount, incomeTotal, onAddExpense, onAddIncome }: {
  expenseCount: number; expenseTotal: number; incomeCount: number; incomeTotal: number
  onAddExpense: () => void; onAddIncome: () => void
}) {
  return (
    // 건수·금액 자릿수에 따라 줄 수가 달라져 카드가 늘었다 줄었다 했다.
    // 내용과 무관하게 높이를 고정한다.
    <div className="rounded-field overflow-hidden flex h-[108px]"
      style={{ background: `linear-gradient(to right, ${EXPENSE_COLOR}, ${INCOME_COLOR})` }}>
      {/* 지출 절반 */}
      <button onClick={onAddExpense}
        className="flex-1 min-w-0 p-3 text-left transition-opacity hover:opacity-90 group flex flex-col justify-between"
        style={{ background: 'transparent' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-body font-bold bg-white/20 text-white">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7l-7 7-7-7" />
            </svg>
            지출
          </span>
          <svg className="w-3.5 h-3.5 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-body text-white/60 mb-0.5 text-right">{expenseCount}건</p>
        <p className="text-subhead font-bold text-white tabular-nums leading-tight text-right whitespace-nowrap overflow-hidden text-ellipsis">
          {expenseTotal.toLocaleString('ko-KR')}원
        </p>
      </button>
      {/* 중앙 구분선 */}
      <div className="w-px bg-white/20 my-3" />
      {/* 수입 절반 */}
      <button onClick={onAddIncome}
        className="flex-1 min-w-0 p-3 text-left transition-opacity hover:opacity-90 group flex flex-col justify-between"
        style={{ background: 'transparent' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-body font-bold bg-white/20 text-white">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
            </svg>
            수입
          </span>
          <svg className="w-3.5 h-3.5 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-body text-white/60 mb-0.5 text-right">{incomeCount}건</p>
        <p className="text-subhead font-bold text-white tabular-nums leading-tight text-right whitespace-nowrap overflow-hidden text-ellipsis">
          {incomeTotal.toLocaleString('ko-KR')}원
        </p>
      </button>
    </div>
  )
}

/* ── Main Page ── */
