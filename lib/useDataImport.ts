'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { ParsePreviewResponse } from '@/lib/types'
import type { YearSummary } from '@/lib/fetchYears'

interface Options {
  /** 저장 완료 후 이동할 경로. 없으면 router.refresh() */
  redirectAfterSave?: string
}

export function useDataImport(initialYears: YearSummary[], options: Options = {}) {
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

  // Preview + save state (shared)
  const [preview, setPreview] = useState<ParsePreviewResponse | null>(null)
  const [saving, setSaving] = useState(false)

  // Year summary state
  const [years, setYears] = useState<YearSummary[]>(initialYears)

  // Per-year sync loading
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
    const sheetsUrl = targetId.includes('docs.google.com')
      ? targetId
      : `https://docs.google.com/spreadsheets/d/${targetId}`
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
      body: JSON.stringify({
        rows: preview.rows,
        year: preview.year,
        source: preview.source ?? 'excel',
        source_url: preview.source_url ?? '',
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { alert(json.error ?? '저장 실패'); return }
    const inserted: number = json.inserted ?? 0
    setPreview(null)
    alert(`${inserted}건 저장 완료`)
    if (options.redirectAfterSave) {
      window.location.href = options.redirectAfterSave
    } else {
      router.refresh()
    }
  }

  return {
    // Excel
    uploadYear, setUploadYear,
    uploading, uploadError,
    fileInputRef,
    handleFileUpload,
    // Sheets
    sheetId, setSheetId,
    sheetName, setSheetName,
    sheetYear, setSheetYear,
    sheetsLoading, sheetsError,
    handleSheetsImport,
    // Year sync
    years, syncingYear,
    handleYearSync,
    // Preview + save
    preview, setPreview,
    saving,
    handleConfirmSave,
  }
}
