'use client'

import { useState } from 'react'

export default function PortfolioImport() {
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const [sheetName, setSheetName] = useState('포트폴리오')
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 55000)
      const res = await fetch('/api/portfolio/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, sheetName }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? `오류 (${res.status})`)
      } else {
        setResult(json)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('요청 시간이 초과됐습니다. 시트 행 수가 너무 많을 수 있어요.')
      } else {
        setError(err instanceof Error ? err.message : '알 수 없는 오류')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <h2 className="font-semibold text-slate-700">구글시트에서 포트폴리오 Import</h2>
        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
          <p className="font-medium">시트 컬럼 순서 (헤더 행 제외):</p>
          <p>A=소유자, B=금융사, C=계좌유형, D=티커, E=종목명, F=자산군, G=국가, H=스타일, I=섹터, J=보유주수, K=평균매입가(USD), L=현재가, M=총매수금액(KRW)</p>
        </div>
        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">스프레드시트 URL 또는 ID</label>
            <input
              value={spreadsheetId}
              onChange={e => setSpreadsheetId(e.target.value)}
              className={inputCls}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">시트 이름</label>
            <input
              value={sheetName}
              onChange={e => setSheetName(e.target.value)}
              className={inputCls}
              placeholder="포트폴리오"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Import 중...' : 'Import 시작'}
          </button>
        </form>
        {error && (
          <div className="rounded-lg p-4 text-sm bg-red-50 text-red-700">
            <p className="font-semibold">오류</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        )}
        {result && (
          <div className={`rounded-lg p-4 text-sm ${result.errors.length === 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            <p className="font-semibold">{result.imported}개 종목 import 완료</p>
            {result.errors.map((e, i) => <p key={i} className="text-xs mt-1">{e}</p>)}
          </div>
        )}
      </div>
    </div>
  )
}
