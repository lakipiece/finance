'use client'

import { useRef } from 'react'
import { signOut } from 'next-auth/react'
import PreviewModal from './PreviewModal'
import type { YearSummary } from '@/lib/fetchYears'
import { useFilter } from '@/lib/FilterContext'
import { useDataImport } from '@/lib/useDataImport'

interface Props {
  initialYears: YearSummary[]
}

export default function AdminClient({ initialYears }: Props) {
  const { excludeLoan, setExcludeLoan } = useFilter()
  const imp = useDataImport(initialYears, { redirectAfterSave: '/admin' })

  async function handleLogout() {
    await signOut({ callbackUrl: '/login' })
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

      {/* 공통 설정 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
        <div className="flex items-center gap-8 flex-wrap">
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
        </div>
      </div>

      {/* 저장된 데이터 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">저장된 데이터</h2>
        {imp.years.length === 0 ? (
          <p className="text-sm text-slate-400">아직 저장된 데이터가 없습니다.</p>
        ) : (
          <div className="flex gap-4 flex-wrap">
            {imp.years.map((y) => {
              const isSheets = y.source === 'googlesheet'
              const isSyncing = imp.syncingYear === y.year
              return (
                <div
                  key={y.year}
                  className={`bg-slate-50 rounded-xl px-6 py-4 text-center min-w-28 min-h-[100px] transition-all ${
                    isSheets && y.source_url ? 'cursor-pointer hover:bg-slate-100 hover:-translate-y-0.5' : ''
                  } ${isSyncing ? 'animate-pulse' : ''}`}
                  onClick={isSheets && y.source_url && !isSyncing ? () => imp.handleYearSync(y) : undefined}
                >
                  <div className="text-2xl font-bold text-slate-800">{y.year}</div>
                  <div className="text-xs text-slate-400 mt-1">{y.count.toLocaleString()}건</div>
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${isSheets ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {isSheets ? 'Sheets' : 'Excel'}
                    </span>
                  </div>
                  {isSheets && y.source_url && (
                    <p className="text-[10px] text-slate-300 mt-1.5">
                      {isSyncing ? '동기화 중...' : '클릭하여 동기화'}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Google Sheets */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">Google Sheets 연동</h2>
          <p className="text-xs text-slate-400 mb-4">서비스 계정으로 시트 데이터를 가져옵니다</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">스프레드시트 URL 또는 ID</label>
              <input
                type="text"
                value={imp.sheetId}
                onChange={(e) => imp.setSheetId(e.target.value)}
                placeholder="Google Sheets URL 또는 ID"
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">시트 이름</label>
              <input
                type="text"
                value={imp.sheetName}
                onChange={(e) => imp.setSheetName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">연도</label>
              <input
                type="number"
                value={imp.sheetYear}
                onChange={(e) => imp.setSheetYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <button
              onClick={() => imp.handleSheetsImport()}
              disabled={imp.sheetsLoading || !imp.sheetId}
              className="w-full py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {imp.sheetsLoading ? '가져오는 중...' : '데이터 가져오기'}
            </button>
            {imp.sheetsError && <p className="text-xs text-red-500">{imp.sheetsError}</p>}
          </div>
        </div>

        {/* Excel Upload */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">엑셀 업로드</h2>
          <p className="text-xs text-slate-400 mb-4">xlsx 파일 업로드 후 미리보기에서 확인</p>
          <div className="mb-4">
            <label className="block text-xs text-slate-500 mb-1">연도</label>
            <input
              type="number"
              value={imp.uploadYear}
              onChange={(e) => imp.setUploadYear(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-24 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-slate-300 transition-colors"
            onClick={() => imp.fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const file = e.dataTransfer.files[0]
              if (file) imp.handleFileUpload(file)
            }}
          >
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm text-slate-500">
              {imp.uploading ? '파싱 중...' : '파일을 드래그하거나 클릭해서 선택'}
            </p>
            <p className="text-xs text-slate-400 mt-1">.xlsx 형식, 최대 10MB</p>
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
