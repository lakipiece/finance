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
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">파싱 결과 미리보기</h2>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-slate-500">연도: <strong className="text-slate-700">{preview.year}</strong></span>
            <span className="text-slate-500">총 행수: <strong className="text-slate-700">{preview.totalCount}건</strong></span>
            <span className="text-slate-500">중복: <strong className="text-amber-600">{preview.duplicateCount}건 제외</strong></span>
            <span className="text-slate-500">저장 예정: <strong className="text-green-600">{preview.totalCount - preview.duplicateCount}건</strong></span>
          </div>
        </div>

        {/* Sample rows table */}
        <div className="overflow-auto flex-1 p-6">
          <p className="text-xs text-slate-400 mb-3">처음 10행 미리보기</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">날짜</th>
                <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">분류</th>
                <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">내역</th>
                <th className="text-left py-2 px-2 text-xs text-slate-400 font-medium">결제</th>
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
                  <td className="py-1.5 px-2 text-right font-medium text-slate-800">{formatWonFull(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer buttons */}
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || preview.totalCount - preview.duplicateCount === 0}
            className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {loading ? '저장 중...' : `저장 (${preview.totalCount - preview.duplicateCount}건)`}
          </button>
        </div>
      </div>
    </div>
  )
}
