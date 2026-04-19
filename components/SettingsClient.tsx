'use client'

import { useState } from 'react'
import PreviewModal from './PreviewModal'
import type { YearSummary } from '@/lib/fetchYears'
import { useFilter } from '@/lib/FilterContext'
import { useDataImport } from '@/lib/useDataImport'
import { field, badge } from '@/lib/styles'
import { OPTION_COLORS } from '@/lib/palettes'

function RefreshValuesButton() {
  const [refreshing, setRefreshing] = useState(false)
  const [done, setDone] = useState(false)

  async function handle() {
    setRefreshing(true)
    setDone(false)
    await fetch('/api/portfolio/snapshots/refresh-values', { method: 'POST' })
    setRefreshing(false)
    setDone(true)
    setTimeout(() => setDone(false), 3000)
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-slate-600">스냅샷 평가액 업데이트</p>
        <p className="text-[10px] text-slate-400 mt-0.5">현재가 기준으로 모든 스냅샷의 total_market_value를 재계산합니다</p>
      </div>
      <div className="flex items-center gap-2">
        {done && <span className="text-[10px] text-emerald-600">완료</span>}
        <button
          onClick={handle}
          disabled={refreshing}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#1A237E' }}
        >
          {refreshing ? '업데이트 중...' : '평가액 업데이트'}
        </button>
      </div>
    </div>
  )
}

interface Props {
  initialYears: YearSummary[]
}

export default function SettingsClient({ initialYears }: Props) {
  const { excludeLoan, setExcludeLoan } = useFilter()
  const imp = useDataImport(initialYears)

  return (
    <div className="space-y-6">
      {/* 가계부 데이터 관리 */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-3">가계부 데이터 관리</h3>

        {/* 대출상환 제외 토글 */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-600">대출상환 제외</p>
            <button
              onClick={() => setExcludeLoan(!excludeLoan)}
              className={`relative w-10 h-5 rounded-full transition-colors ${excludeLoan ? '' : 'bg-slate-200'}`}
              style={excludeLoan ? { backgroundColor: '#1A237E' } : undefined}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${excludeLoan ? 'translate-x-5' : ''}`} />
            </button>
            <p className="text-[10px] text-slate-400">가계부 대시보드/검색에서 대출상환 카테고리를 집계에서 제외합니다</p>
          </div>
        </div>

        {/* 저장된 데이터 */}
        {imp.years.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
            <p className="text-xs font-medium text-slate-600 mb-3">저장된 데이터</p>
            <div className="flex gap-2 flex-wrap">
              {imp.years.map((y) => {
                const isSheets = y.source === 'googlesheet'
                const isSyncing = imp.syncingYear === y.year
                return (
                  <div
                    key={y.year}
                    className={`bg-slate-50 rounded-xl px-4 py-2.5 text-center min-w-[72px] transition-all ${
                      isSheets && y.source_url ? 'cursor-pointer hover:bg-slate-100 hover:-translate-y-0.5' : ''
                    } ${isSyncing ? 'animate-pulse' : ''}`}
                    onClick={isSheets && y.source_url && !isSyncing ? () => imp.handleYearSync(y) : undefined}
                  >
                    <div className="text-sm font-semibold text-slate-700">{y.year}</div>
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
                  className={`w-16 ${field.inputFit}`}
                />
              </div>
              <button
                onClick={() => imp.handleSheetsImport()}
                disabled={imp.sheetsLoading || !imp.sheetId}
                className="w-full py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90 transition-opacity"
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
                className={`w-16 ${field.inputFit}`}
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

      {/* 포트폴리오 관리 */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-3">포트폴리오 관리</h3>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <RefreshValuesButton />
        </div>
      </div>

      {/* 색상 팔레트 참조표 */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-3">옵션 색상 팔레트</h3>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <p className="text-[10px] text-slate-400 mb-3">옵션 항목에서 사용 가능한 30가지 색상입니다. 항목의 색상 점을 클릭해 변경할 수 있습니다.</p>
          <div className="grid grid-cols-10 gap-1.5">
            {OPTION_COLORS.map((c) => (
              <div key={c} className="flex flex-col items-center gap-0.5">
                <div
                  className="w-5 h-5 rounded-full border border-slate-100 shadow-sm"
                  style={{ backgroundColor: c }}
                  title={c}
                />
                <span className="text-[7px] text-slate-400 font-mono leading-none">{c.slice(1)}</span>
              </div>
            ))}
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
