'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-client'
import PreviewModal from './PreviewModal'
import type { ParsePreviewResponse } from '@/lib/types'
import type { YearSummary } from '@/lib/fetchYears'

interface Props {
  initialYears: YearSummary[]
}

export default function AdminClient({ initialYears }: Props) {
  const router = useRouter()

  // Excel upload state
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear())
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Google Sheets state
  const [sheetId, setSheetId] = useState('')
  const [sheetName, setSheetName] = useState('지출내역')
  const [sheetYear, setSheetYear] = useState(new Date().getFullYear())
  const [sheetsLoading, setSheetsLoading] = useState(false)
  const [sheetsError, setSheetsError] = useState('')

  // Preview state (shared)
  const [preview, setPreview] = useState<ParsePreviewResponse | null>(null)
  const [saving, setSaving] = useState(false)

  // Year summary state
  const [years, setYears] = useState<YearSummary[]>(initialYears)

  async function handleFileUpload(file: File) {
    setUploadError('')
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('year', String(uploadYear))

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const json = await res.json()
    setUploading(false)

    if (!res.ok) { setUploadError(json.error ?? '업로드 실패'); return }
    setPreview({ ...json, source: 'excel' })
  }

  async function handleSheetsImport() {
    setSheetsError('')

    // Validate: must be a Google Sheets URL or a raw spreadsheet ID
    const isGoogleSheetsUrl = sheetId.includes('docs.google.com/spreadsheets')
    const isRawId = /^[a-zA-Z0-9_-]{20,}$/.test(sheetId.trim())
    if (!isGoogleSheetsUrl && !isRawId) {
      setSheetsError('Google Sheets URL 또는 스프레드시트 ID를 입력해주세요.')
      return
    }

    setSheetsLoading(true)

    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId: sheetId, sheetName, year: sheetYear }),
    })
    const json = await res.json()
    setSheetsLoading(false)

    if (!res.ok) { setSheetsError(json.error ?? '가져오기 실패'); return }
    const sheetsUrl = sheetId.includes('docs.google.com') ? sheetId : `https://docs.google.com/spreadsheets/d/${sheetId}`
    setPreview({ ...json, source: 'googlesheet', source_url: sheetsUrl })
  }

  async function handleConfirmSave() {
    if (!preview) return
    setSaving(true)

    const res = await fetch('/api/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: preview.rows, year: preview.year, source: preview.source ?? 'excel', source_url: preview.source_url ?? '' }),
    })
    const json = await res.json()
    setSaving(false)

    if (!res.ok) { alert(json.error ?? '저장 실패'); return }

    const inserted: number = json.inserted ?? 0
    setPreview(null)
    alert(`${inserted}건 저장 완료`)
    window.location.href = '/admin'
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">데이터 관리</h1>
          <p className="text-sm text-slate-400 mt-0.5">가계부 데이터 업로드 및 관리</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          로그아웃
        </button>
      </div>


<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Section A: Excel Upload */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">📂 엑셀 업로드</h2>
          <p className="text-xs text-slate-400 mb-4">xlsx 파일 업로드 후 미리보기에서 확인</p>

          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-1">연도</label>
            <input
              type="number"
              value={uploadYear}
              onChange={(e) => setUploadYear(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-slate-300 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) handleFileUpload(file)
            }}
          >
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm text-slate-500">
              {uploading ? '파싱 중...' : '파일을 드래그하거나 클릭해서 선택'}
            </p>
            <p className="text-xs text-slate-400 mt-1">.xlsx 형식, 최대 10MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
            }}
          />
          {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}
        </div>

        {/* Section B: Google Sheets */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">🔗 Google Sheets 연동</h2>
          <p className="text-xs text-slate-400 mb-4">서비스 계정으로 시트 데이터를 가져옵니다</p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">스프레드시트 ID</label>
              <input
                type="text"
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="URL에서 /d/ 뒤의 ID"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">시트 이름</label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">연도</label>
              <input
                type="number"
                value={sheetYear}
                onChange={(e) => setSheetYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              onClick={handleSheetsImport}
              disabled={sheetsLoading || !sheetId}
              className="w-full py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {sheetsLoading ? '가져오는 중...' : '데이터 가져오기'}
            </button>
            {sheetsError && <p className="text-xs text-red-500">{sheetsError}</p>}
          </div>
        </div>
      </div>

      {/* Section C: Stored data summary */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">📊 저장된 데이터</h2>
        {years.length === 0 ? (
          <p className="text-sm text-slate-400">아직 저장된 데이터가 없습니다.</p>
        ) : (
          <div className="flex gap-4 flex-wrap">
            {years.map((y) => {
              const isSheets = y.source === 'googlesheet'
              return (
                <div key={y.year} className="relative group bg-slate-50 rounded-xl px-6 py-4 text-center min-w-24">
                  <div className="text-2xl font-bold text-slate-800">{y.year}</div>
                  <div className="text-xs text-slate-400 mt-1">{y.count.toLocaleString()}건</div>
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${isSheets ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {isSheets ? 'Google Sheets' : 'Excel'}
                    </span>
                    {isSheets && y.source_url && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(y.source_url!); alert('URL이 클립보드에 복사되었습니다.') }}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        title={y.source_url}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {isSheets && y.source_url && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap max-w-xs truncate">
                        {y.source_url}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {preview && (
        <PreviewModal
          preview={preview}
          onConfirm={handleConfirmSave}
          onCancel={() => setPreview(null)}
          loading={saving}
        />
      )}
    </div>
  )
}
