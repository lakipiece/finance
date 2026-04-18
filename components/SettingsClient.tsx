'use client'

import { signOut } from 'next-auth/react'
import PreviewModal from './PreviewModal'
import type { YearSummary } from '@/lib/fetchYears'
import { useFilter } from '@/lib/FilterContext'
import { useDataImport } from '@/lib/useDataImport'
import ThemePicker from './ThemePicker'
import { field, badge } from '@/lib/styles'

interface Props {
  initialYears: YearSummary[]
}

export default function SettingsClient({ initialYears }: Props) {
  const { excludeLoan, setExcludeLoan } = useFilter()
  const imp = useDataImport(initialYears)

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
              className={`relative w-11 h-6 rounded-full transition-colors ${excludeLoan ? '' : 'bg-slate-200'}`}
              style={excludeLoan ? { backgroundColor: '#1A237E' } : undefined}
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
        {imp.years.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
            <p className="text-xs font-medium text-slate-600 mb-3">저장된 데이터</p>
            <div className="flex gap-3 flex-wrap">
              {imp.years.map((y) => {
                const isSheets = y.source === 'googlesheet'
                const isSyncing = imp.syncingYear === y.year
                return (
                  <div
                    key={y.year}
                    className={`bg-slate-50 rounded-xl px-5 py-3 text-center min-w-24 transition-all ${
                      isSheets && y.source_url ? 'cursor-pointer hover:bg-slate-100 hover:-translate-y-0.5' : ''
                    } ${isSyncing ? 'animate-pulse' : ''}`}
                    onClick={isSheets && y.source_url && !isSyncing ? () => imp.handleYearSync(y) : undefined}
                  >
                    <div className="text-xl font-bold text-slate-800">{y.year}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{y.count.toLocaleString()}건</div>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <span className={isSheets ? badge.success : badge.info}>
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
                <label className={field.label}>스프레드시트 URL 또는 ID</label>
                <input
                  type="text"
                  value={imp.sheetId}
                  onChange={(e) => imp.setSheetId(e.target.value)}
                  placeholder="Google Sheets URL 또는 ID"
                  className={field.input}
                />
              </div>
              <div>
                <label className={field.label}>시트 이름</label>
                <input
                  type="text"
                  value={imp.sheetName}
                  onChange={(e) => imp.setSheetName(e.target.value)}
                  className={field.input}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">연도</label>
                <input
                  type="number"
                  value={imp.sheetYear}
                  onChange={(e) => imp.setSheetYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
              </div>
              <button
                onClick={() => imp.handleSheetsImport()}
                disabled={imp.sheetsLoading || !imp.sheetId}
                className="w-full py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: '#1A237E' }}
              >
                {imp.sheetsLoading ? '가져오는 중...' : '데이터 가져오기'}
              </button>
              {imp.sheetsError && <p className="text-xs text-red-500">{imp.sheetsError}</p>}
            </div>
          </div>

          {/* Excel Upload */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <p className="text-xs font-medium text-slate-600 mb-3">엑셀 업로드</p>
            <div className="mb-3">
              <label className={field.label}>연도</label>
              <input
                type="number"
                value={imp.uploadYear}
                onChange={(e) => imp.setUploadYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
            </div>
            <div
              className={field.dropzone}
              onClick={() => imp.fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) imp.handleFileUpload(file)
              }}
            >
              <p className="text-xs text-slate-400">
                {imp.uploading ? '파싱 중...' : '파일을 드래그하거나 클릭해서 선택'}
              </p>
              <p className="text-[10px] text-slate-300 mt-1">.xlsx 형식</p>
            </div>
            <input
              ref={imp.fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) imp.handleFileUpload(file)
              }}
            />
            {imp.uploadError && <p className="text-xs text-red-500 mt-2">{imp.uploadError}</p>}
          </div>
        </div>
      </div>

      {imp.preview && (
        <PreviewModal
          preview={imp.preview}
          onConfirm={imp.handleConfirmSave}
          onCancel={() => imp.setPreview(null)}
          loading={imp.saving}
        />
      )}
    </div>
  )
}
