'use client'

import type { ParsePreviewResponse } from '@/lib/types'
import { formatWonFull } from '@/lib/utils'

interface Props {
  preview: ParsePreviewResponse
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

export default function PreviewModal({ preview, onConfirm, onCancel, loading }: Props) {
  const hasExisting = preview.existingCount > 0

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800">파싱 결과 미리보기</h2>
          <div className="flex gap-4 mt-2 text-xs flex-wrap">
            <span className="text-slate-500">연도: <strong className="text-slate-700">{preview.year}</strong></span>
            <span className="text-slate-500">파싱된 데이터: <strong className="text-slate-700">{preview.totalCount}건</strong></span>
          </div>
        </div>

        {/* Sample rows table */}
        <div className="overflow-auto flex-1 p-6">
          {preview.totalCount === 0 ? (
            <div>
              <p className="text-xs text-amber-600 font-medium mb-3">파싱된 행이 없습니다. 시트 원본 데이터 (처음 3행):</p>
              {preview.rawSample && preview.rawSample.length > 0 ? (
                <div className="bg-slate-50 rounded-lg p-3 overflow-x-auto">
                  {preview.rawSample.map((row, i) => (
                    <div key={i} className="text-xs font-mono text-slate-600 mb-1">
                      <span className="text-slate-400 mr-2">행{i}:</span>
                      {row.map((cell, j) => (
                        <span key={j} className="mr-3">[{j}]={cell || '(빈값)'}</span>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">시트에 데이터가 없습니다.</p>
              )}
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-3">처음 10행 미리보기</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">날짜</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">분류</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">내역</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">결제</th>
                    <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">비고</th>
                    <th className="text-right py-2 px-2 text-xs text-slate-400 font-medium">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="py-1.5 px-2 text-slate-400 text-xs">{row.expense_date}</td>
                      <td className="py-1.5 px-2 text-slate-600">{row.category}</td>
                      <td className="py-1.5 px-2 text-slate-700 max-w-[160px] truncate">{row.detail || '-'}</td>
                      <td className="py-1.5 px-2 text-slate-400">{row.method || '-'}</td>
                      <td className="py-1.5 px-2 text-slate-400 text-xs max-w-[120px] truncate" title={row.memo || undefined}>{row.memo || '-'}</td>
                      <td className="py-1.5 px-2 text-right font-medium text-slate-800">{formatWonFull(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Overwrite warning */}
        {hasExisting && preview.totalCount > 0 && (
          <div className="mx-6 mb-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs font-semibold text-amber-700">
              {preview.year}년 기존 데이터 {preview.existingCount.toLocaleString()}건이 있습니다.
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              저장하면 기존 데이터가 모두 삭제되고 새 데이터 {preview.totalCount.toLocaleString()}건으로 교체됩니다.
            </p>
          </div>
        )}

        {/* Footer buttons */}
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || preview.totalCount === 0}
            className={`px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors ${
              hasExisting ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-800 hover:bg-slate-700'
            }`}
          >
            {loading ? '저장 중...' : hasExisting
              ? `덮어쓰기 (${preview.totalCount.toLocaleString()}건)`
              : `저장 (${preview.totalCount.toLocaleString()}건)`
            }
          </button>
        </div>
      </div>
    </div>
  )
}
