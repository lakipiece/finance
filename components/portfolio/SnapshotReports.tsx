'use client'

import { useRef, useState } from 'react'
import { btn, card, text } from '@/lib/styles'
import type { ReportMeta } from '@/lib/portfolio/reports'

interface Props {
  snapshotId: string
  initialReports: ReportMeta[]
}

function fmtDate(v: string) {
  return new Date(v).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function fmtSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// 스냅샷에 첨부한 HTML 보고서 — 업로드·열기(새 탭)·삭제
export default function SnapshotReports({ snapshotId, initialReports }: Props) {
  const [reports, setReports] = useState(initialReports)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const base = `/api/portfolio/snapshots/${snapshotId}/reports`

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 change가 발생하게
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(base, { method: 'POST', body: form })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error ?? '업로드에 실패했습니다.'); return }
      setReports(prev => [body as ReportMeta, ...prev])
    } catch {
      setError('업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(r: ReportMeta) {
    if (!confirm(`'${r.title}' 보고서를 삭제할까요?`)) return
    setError(null)
    const res = await fetch(`${base}/${r.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? '삭제에 실패했습니다.')
      return
    }
    setReports(prev => prev.filter(x => x.id !== r.id))
  }

  return (
    <section className={`${card.base} p-5 mt-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className={text.sectionTitle}>보고서</h2>
        <button type="button" className={btn.secondary} disabled={uploading}
          onClick={() => inputRef.current?.click()}>
          {uploading ? '올리는 중…' : '보고서 올리기'}
        </button>
        <input ref={inputRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={handleFile} />
      </div>

      {error ? <p className="text-body text-danger mt-3">{error}</p> : null}

      {reports.length === 0 ? (
        <p className="text-meta text-ink-4 mt-3">
          Claude로 만든 HTML 보고서를 올리면 이 스냅샷에서 바로 열어볼 수 있습니다.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {reports.map(r => (
            <li key={r.id} className="flex items-center gap-3 py-2 group">
              <a href={`${base}/${r.id}`} target="_blank" rel="noopener noreferrer"
                className="flex-1 min-w-0 hover:opacity-70 transition-opacity">
                <span className="block text-body font-medium text-ink truncate">{r.title}</span>
                <span className="block text-micro tracking-normal text-ink-4 tabular-nums">
                  {fmtDate(r.created_at)} · {fmtSize(r.size)} · {r.filename}
                </span>
              </a>
              <button type="button" className={btn.danger} title="삭제" onClick={() => handleDelete(r)}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
