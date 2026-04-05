'use client'

import { useState } from 'react'
import type { Account, Security } from '@/lib/portfolio/types'

interface Props {
  accounts: Account[]
  securities: Security[]
}

type Tab = 'holdings' | 'accounts' | 'securities'

export default function HoldingsManager({ accounts: initAccounts, securities: initSecurities }: Props) {
  const [tab, setTab] = useState<Tab>('holdings')
  const [accounts, setAccounts] = useState(initAccounts)
  const [securities, setSecurities] = useState(initSecurities)
  const [msg, setMsg] = useState('')

  async function post(url: string, body: object) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? '오류')
    return json
  }

  async function addAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      const acc = await post('/api/portfolio/accounts', {
        name: fd.get('name'), broker: fd.get('broker'),
        owner: fd.get('owner'), type: fd.get('type'), currency: 'KRW',
      })
      setAccounts(prev => [...prev, acc])
      setMsg('계좌 추가 완료')
      e.currentTarget.reset()
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : '오류')
    }
  }

  async function addSecurity(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      const sec = await post('/api/portfolio/securities', {
        ticker: fd.get('ticker'), name: fd.get('name'),
        asset_class: fd.get('asset_class'), country: fd.get('country'),
        style: fd.get('style'), sector: fd.get('sector'),
        currency: fd.get('currency') || 'USD',
      })
      setSecurities(prev => {
        const idx = prev.findIndex(s => s.id === sec.id)
        return idx >= 0 ? prev.map((s, i) => i === idx ? sec : s) : [...prev, sec]
      })
      setMsg('종목 추가/업데이트 완료')
      e.currentTarget.reset()
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : '오류')
    }
  }

  async function addHolding(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await post('/api/portfolio/holdings', {
        account_id: fd.get('account_id'),
        security_id: fd.get('security_id'),
        quantity: parseFloat(fd.get('quantity') as string),
        avg_price: parseFloat(fd.get('avg_price') as string) || null,
        total_invested: parseFloat(fd.get('total_invested') as string) || null,
        snapshot_date: fd.get('snapshot_date'),
      })
      setMsg('포지션 저장 완료')
      e.currentTarget.reset()
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : '오류')
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
  const btnCls = 'bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors'
  const labelCls = 'block text-xs text-slate-500 mb-1'

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div className="flex gap-2">
        {(['holdings', 'accounts', 'securities'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {t === 'holdings' ? '포지션' : t === 'accounts' ? '계좌' : '종목'}
          </button>
        ))}
      </div>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
          {msg}
        </div>
      )}

      {tab === 'accounts' && (
        <form onSubmit={addAccount} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h2 className="font-semibold text-slate-700">계좌 추가</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>계좌명 *</label><input name="name" required className={inputCls} placeholder="카카오페이 종합위탁" /></div>
            <div><label className={labelCls}>금융사 *</label><input name="broker" required className={inputCls} placeholder="카카오페이" /></div>
            <div><label className={labelCls}>소유자</label><input name="owner" className={inputCls} placeholder="본인" /></div>
            <div><label className={labelCls}>유형</label>
              <select name="type" className={inputCls}>
                <option value="종합위탁">종합위탁</option>
                <option value="연금저축">연금저축</option>
                <option value="ISA">ISA</option>
                <option value="IRP">IRP</option>
              </select>
            </div>
          </div>
          <button type="submit" className={btnCls}>추가</button>
          {accounts.length > 0 && (
            <div className="mt-4 space-y-1">
              {accounts.map(a => (
                <div key={a.id} className="text-sm text-slate-600">{a.broker} · {a.name} ({a.type})</div>
              ))}
            </div>
          )}
        </form>
      )}

      {tab === 'securities' && (
        <div className="space-y-4">
          <form onSubmit={addSecurity} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="font-semibold text-slate-700">종목 추가/수정</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>티커 *</label><input name="ticker" required className={inputCls} placeholder="SCHD" /></div>
              <div><label className={labelCls}>종목명 *</label><input name="name" required className={inputCls} placeholder="슈왑 배당 ETF" /></div>
              <div><label className={labelCls}>자산군</label>
                <select name="asset_class" className={inputCls}>
                  <option value="주식">주식</option>
                  <option value="채권">채권</option>
                  <option value="대체자산">대체자산</option>
                </select>
              </div>
              <div><label className={labelCls}>국가</label>
                <select name="country" className={inputCls}>
                  <option value="미국">미국</option>
                  <option value="국내">국내</option>
                  <option value="글로벌">글로벌</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div><label className={labelCls}>스타일</label>
                <select name="style" className={inputCls}>
                  <option value="성장">성장</option>
                  <option value="인컴">인컴</option>
                  <option value="안전">안전</option>
                </select>
              </div>
              <div><label className={labelCls}>섹터</label><input name="sector" className={inputCls} placeholder="테크" /></div>
              <div><label className={labelCls}>통화</label>
                <select name="currency" className={inputCls}>
                  <option value="USD">USD</option>
                  <option value="KRW">KRW</option>
                </select>
              </div>
            </div>
            <button type="submit" className={btnCls}>추가/업데이트</button>
          </form>

          {/* 기존 종목 목록 — currency 인라인 편집 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-slate-600">
              등록된 종목 ({securities.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
                    <th className="text-left px-4 py-2">티커</th>
                    <th className="text-left px-4 py-2">종목명</th>
                    <th className="text-left px-4 py-2">국가</th>
                    <th className="text-left px-4 py-2">통화</th>
                    <th className="text-left px-4 py-2">섹터</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[...securities].sort((a, b) => a.ticker.localeCompare(b.ticker)).map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono font-semibold text-slate-800">{s.ticker}</td>
                      <td className="px-4 py-2 text-slate-600 text-xs">{s.name}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{s.country}</td>
                      <td className="px-4 py-2">
                        <select
                          value={s.currency}
                          onChange={async (e) => {
                            const newCurrency = e.target.value
                            try {
                              await post('/api/portfolio/securities', {
                                ticker: s.ticker, name: s.name,
                                asset_class: s.asset_class, country: s.country,
                                style: s.style, sector: s.sector, currency: newCurrency,
                              })
                              setSecurities(prev => prev.map(x => x.id === s.id ? { ...x, currency: newCurrency } : x))
                              setMsg(`${s.ticker} → ${newCurrency} 저장 완료`)
                            } catch (err: unknown) {
                              setMsg(err instanceof Error ? err.message : '오류')
                            }
                          }}
                          className="border border-slate-200 rounded px-2 py-1 text-xs"
                        >
                          <option value="USD">USD</option>
                          <option value="KRW">KRW</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{s.sector}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'holdings' && (
        <form onSubmit={addHolding} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h2 className="font-semibold text-slate-700">포지션 입력 (스냅샷)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>계좌 *</label>
              <select name="account_id" required className={inputCls}>
                <option value="">선택</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.broker} · {a.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>종목 *</label>
              <select name="security_id" required className={inputCls}>
                <option value="">선택</option>
                {securities.map(s => <option key={s.id} value={s.id}>{s.ticker} · {s.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>보유수량 *</label><input name="quantity" type="number" step="any" required className={inputCls} placeholder="49.725" /></div>
            <div><label className={labelCls}>평균매입가 (원화)</label><input name="avg_price" type="number" step="any" className={inputCls} placeholder="37440" /></div>
            <div><label className={labelCls}>투자원금 (원화)</label><input name="total_invested" type="number" step="any" className={inputCls} placeholder="2081666" /></div>
            <div><label className={labelCls}>기준일</label><input name="snapshot_date" type="date" className={inputCls} defaultValue={new Date().toISOString().slice(0, 10)} /></div>
          </div>
          <button type="submit" className={btnCls}>저장</button>
        </form>
      )}
    </div>
  )
}
