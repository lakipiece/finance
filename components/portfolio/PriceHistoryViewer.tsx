'use client'
import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Security } from '@/lib/portfolio/types'

interface PriceRow { ticker: string; date: string; price: number; currency: string }

interface Props {
  securities: Security[]
  history: PriceRow[]
}

export default function PriceHistoryViewer({ securities, history }: Props) {
  const [selectedTicker, setSelectedTicker] = useState(securities[0]?.ticker ?? '')

  const rows = useMemo(
    () => history.filter(h => h.ticker === selectedTicker),
    [history, selectedTicker]
  )
  const isUSD = rows[0]?.currency === 'USD'
  const chartData = useMemo(
    () => rows.map(r => ({ date: r.date, price: r.price })),
    [rows]
  )
  const reversedRows = useMemo(() => [...rows].reverse(), [rows])

  if (securities.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-400">
          등록된 종목이 없습니다
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-700">가격 수집 이력</h2>
        <select
          value={selectedTicker}
          onChange={e => setSelectedTicker(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          {securities.map(s => (
            <option key={s.ticker} value={s.ticker}>{s.ticker} — {s.name}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{rows.length}개 데이터</span>
      </div>

      {/* Chart */}
      {rows.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => isUSD ? `$${v}` : `${(v / 10000).toFixed(0)}만`}
                width={48}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, fontFamily: 'ui-sans-serif, system-ui, sans-serif', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px' }}
                itemStyle={{ color: '#334155' }}
                labelStyle={{ color: '#94a3b8', marginBottom: 2 }}
                formatter={(v: number) => [isUSD ? `$${v.toFixed(2)}` : `${v.toLocaleString()}원`, '가격']}
                labelFormatter={l => `${l}`}
              />
              <Line type="monotone" dataKey="price" stroke="#334155" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-400">
          수집된 가격 이력이 없습니다
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-2.5">날짜</th>
              <th className="text-right px-4 py-2.5">가격</th>
              <th className="text-right px-4 py-2.5">통화</th>
            </tr>
          </thead>
          <tbody>
            {reversedRows.map(r => (
              <tr key={r.date} className="border-t border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-600">{r.date}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-700">
                  {r.currency === 'USD' ? `$${r.price.toFixed(2)}` : r.price.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-slate-400">{r.currency}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">데이터 없음</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
