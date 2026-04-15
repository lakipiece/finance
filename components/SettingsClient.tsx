'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import PreviewModal from './PreviewModal'
import type { ParsePreviewResponse } from '@/lib/types'
import type { YearSummary } from '@/lib/fetchYears'
import { useFilter } from '@/lib/FilterContext'
import ThemePicker from './ThemePicker'

interface Props {
  initialYears: YearSummary[]
}

export default function SettingsClient({ initialYears }: Props) {
  const router = useRouter()
  const { excludeLoan, setExcludeLoan } = useFilter()

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

  // Sync loading state per year
  const [syncingYear, setSyncingYear] = useState<number | null>(null)

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

  async function handleSheetsImport(overrideId?: string, overrideYear?: number) {
    const targetId = overrideId ?? sheetId
    const targetYear = overrideYear ?? sheetYear
    setSheetsError('')

    const isGoogleSheetsUrl = targetId.includes('docs.google.com/spreadsheets')
    const isRawId = /^[a-zA-Z0-9_-]{20,}$/.test(targetId.trim())
    if (!isGoogleSheetsUrl && !isRawId) {
      setSheetsError('Google Sheets URL 또는 스프레드시트 ID를 입력해주세요.')
      return
    }

    if (overrideId) {
      setSyncingYear(targetYear)
    } else {
      setSheetsLoading(true)
    }

    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId: targetId, sheetName, year: targetYear }),
    })
    const json = await res.json()

    if (overrideId) {
      setSyncingYear(null)
    } else {
      setSheetsLoading(false)
    }

    if (!res.ok) {
      if (overrideId) { alert(json.error ?? '동기화 실패'); return }
      setSheetsError(json.error ?? '가져오기 실패')
      return
    }
    const sheetsUrl = targetId.includes('docs.google.com') ? targetId : `https://docs.google.com/spreadsheets/d/${targetId}`
    setPreview({ ...json, source: 'googlesheet', source_url: sheetsUrl })
  }

  async function handleYearSync(y: YearSummary) {
    if (!y.source_url) return
    await handleSheetsImport(y.source_url, y.year)
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
    router.refresh()
  }

  async function handleLogout() {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <div className="space-y-6">
      {/* 공통 설정 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex items-center gap-8 flex-wrap">
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-700">테마</p>
            <ThemePicker />
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-700">대출상환 제외</p>
            <button
              onClick={() => setExcludeLoan(!excludeLoan)}
              className={`relative w-11 h-6 rounded-full transition-colors ${excludeLoan ? 'bg-slate-800' : 'bg-slate-200'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${excludeLoan ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors ml-auto"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 가계부 데이터 관리 */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-3">가계부 데이터 관리</h3>

        {/* 저장된 데이터 */}
        {years.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
            <p className="text-xs font-medium text-slate-600 mb-3">저장된 데이터</p>
            <div className="flex gap-3 flex-wrap">
              {years.map((y) => {
                const isSheets = y.source === 'googlesheet'
                const isSyncing = syncingYear === y.year
                return (
                  <div
                    key={y.year}
                    className={`bg-slate-50 rounded-xl px-5 py-3 text-center min-w-24 transition-all ${
                      isSheets && y.source_url ? 'cursor-pointer hover:bg-slate-100 hover:-translate-y-0.5' : ''
                    } ${isSyncing ? 'animate-pulse' : ''}`}
                    onClick={isSheets && y.source_url && !isSyncing ? () => handleYearSync(y) : undefined}
                  >
                    <div className="text-xl font-bold text-slate-800">{y.year}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{y.count.toLocaleString()}건</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSheets ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {isSheets ? 'Sheets' : 'Excel'}
                      </span>
                    </div>
                    {isSyncing && (
                      <p className="text-[10px] text-slate-400 mt-1">동기화 중...</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Google Sheets */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-xs font-medium text-slate-600 mb-3">Google Sheets 연동</p>
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs text-slate-400 mb-1">스프레드시트 URL 또는 ID</label>
                <input
                  type="text"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="Google Sheets URL 또는 ID"
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">시트 이름</label>
                <input
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">연도</label>
                <input
                  type="number"
                  value={sheetYear}
                  onChange={(e) => setSheetYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
              <button
                onClick={() => handleSheetsImport()}
                disabled={sheetsLoading || !sheetId}
                className="w-full py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                {sheetsLoading ? '가져오는 중...' : '데이터 가져오기'}
              </button>
              {sheetsError && <p className="text-xs text-red-500">{sheetsError}</p>}
            </div>
          </div>

          {/* Excel Upload */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-xs font-medium text-slate-600 mb-3">엑셀 업로드</p>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">연도</label>
              <input
                type="number"
                value={uploadYear}
                onChange={(e) => setUploadYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-slate-300 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) handleFileUpload(file)
              }}
            >
              <p className="text-xs text-slate-400">
                {uploading ? '파싱 중...' : '파일을 드래그하거나 클릭해서 선택'}
              </p>
              <p className="text-[10px] text-slate-300 mt-1">.xlsx 형식</p>
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
        </div>
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
