'use client'

import type { ExpenseItem } from '@/lib/types'
import { formatWonFull, CAT_BADGE } from '@/lib/utils'

interface Props {
  expenses: ExpenseItem[]
}

export default function ExpenseTable({ expenses }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">#</th>
            <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">날짜</th>
            <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">분류</th>
            <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">내역</th>
            <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">결제수단</th>
            <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">금액</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e, i) => (
            <tr
              key={i}
              className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}
            >
              <td className="py-2.5 px-3 text-slate-300 text-xs">{i + 1}</td>
              <td className="py-2.5 px-3 text-slate-400 text-xs whitespace-nowrap">{e.date}</td>
              <td className="py-2.5 px-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>
                  {e.category}
                </span>
              </td>
              <td className="py-2.5 px-3 text-slate-700">{e.detail}</td>
              <td className="py-2.5 px-3 text-slate-400">{e.method}</td>
              <td className="py-2.5 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                {formatWonFull(e.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
