'use client'

import { useState } from 'react'
import DateInput from '@/components/ui/DateInput'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function HistoricalPriceFetcher() {
  const [startDate, setStartDate] = useState('2026-01-01')
  const [endDate, setEndDate] = useState(todayStr())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ saved: number; failed: string[]; tickers: string[] } | null>(null)
  const [error, setError] = useState('')

  async function handleFetch() {
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const res = await fetch('/api/portfolio/prices/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? `오류 (${res.status})`)
      } else {
        setResult(json)
      }
    } catch (e: any) {
      setError(e?.message ?? '네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 px-5 py-5 space-y-4">
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-0.5">과거 가격 일괄 수집</p>
        <p className="text-[10px] text-slate-400">날짜 범위를 지정해 Yahoo Finance / CoinGecko에서 일별 종가를 가져옵니다. 종목이 많거나 기간이 길면 수 분 소요될 수 있습니다.</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 whitespace-nowrap">시작일</span>
          <DateInput value={startDate} onChange={setStartDate} />
        </div>
        <span className="text-slate-200 text-xs">—</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 whitespace-nowrap">종료일</span>
          <DateInput value={endDate} onChange={setEndDate} />
        </div>
        <button
          onClick={handleFetch}
          disabled={loading || !startDate || !endDate}
          className="text-white px-4 py-1.5 rounded-lg text-xs hover:opacity-90 transition-opacity flex items-center gap-1.5"
          style={{ backgroundColor: '#1A237E' }}
        >
          {loading && (
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          )}
          {loading ? '수집 중...' : '가격 수집'}
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-500">{error}</p>
      )}

      {result && (
        <div className="text-xs text-slate-500 space-y-1">
          <p>
            <span className="text-emerald-600 font-semibold">{result.saved.toLocaleString()}건</span> 저장 완료
            {' · '}종목 {result.tickers.length}개
          </p>
          {result.failed.length > 0 && (
            <details className="mt-1">
              <summary className="text-rose-400 cursor-pointer">실패 {result.failed.length}건</summary>
              <ul className="mt-1 space-y-0.5 pl-2">
                {result.failed.map((f, i) => (
                  <li key={i} className="text-rose-400">{f}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
