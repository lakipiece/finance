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
    <div className="modal-scrim fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-card rounded-dialog shadow-dialog w-full max-w-2xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-surface-low">
          <h2 className="text-heading font-bold text-ink">파싱 결과 미리보기</h2>
          <div className="flex gap-4 mt-2 text-body flex-wrap">
            <span className="text-ink-3">연도: <strong className="text-ink">{preview.year}</strong></span>
            <span className="text-ink-3">파싱된 데이터: <strong className="text-ink">{preview.totalCount}건</strong></span>
          </div>
        </div>

        {/* Sample rows table */}
        <div className="overflow-auto flex-1 p-6">
          {preview.totalCount === 0 ? (
            <div>
              <p className="text-body text-warning font-medium mb-3">파싱된 행이 없습니다. 시트 원본 데이터 (처음 3행):</p>
              {preview.rawSample && preview.rawSample.length > 0 ? (
                <div className="bg-surface-low rounded-btn p-3 overflow-x-auto">
                  {preview.rawSample.map((row, i) => (
                    <div key={i} className="text-body font-mono text-ink-2 mb-1">
                      <span className="text-ink-4 mr-2">행{i}:</span>
                      {row.map((cell, j) => (
                        <span key={j} className="mr-3">[{j}]={cell || '(빈값)'}</span>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body text-ink-4">시트에 데이터가 없습니다.</p>
              )}
            </div>
          ) : (
            <>
              <p className="text-body text-ink-4 mb-3">처음 10행 미리보기</p>
              <table className="w-full text-body">
                <thead>
                  <tr className="border-b border-surface-low">
                    <th className="text-left py-[5px] px-2 text-body text-ink-4 font-medium">날짜</th>
                    <th className="text-left py-[5px] px-2 text-body text-ink-4 font-medium">분류</th>
                    <th className="text-left py-[5px] px-2 text-body text-ink-4 font-medium">내역</th>
                    <th className="text-left py-[5px] px-2 text-body text-ink-4 font-medium">결제</th>
                    <th className="text-left py-[5px] px-2 text-body text-ink-4 font-medium">비고</th>
                    <th className="text-right py-[5px] px-2 text-body text-ink-4 font-medium">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row, i) => (
                    <tr key={i} className="border-b border-surface-low">
                      <td className="py-[5px] px-2 text-ink-4 text-body">{row.expense_date}</td>
                      <td className="py-[5px] px-2 text-ink-2">{row.category}</td>
                      <td className="py-[5px] px-2 text-ink max-w-[160px] truncate">{row.detail || '-'}</td>
                      <td className="py-[5px] px-2 text-ink-4">{row.method || '-'}</td>
                      <td className="py-[5px] px-2 text-ink-4 text-body max-w-[120px] truncate" title={row.memo || undefined}>{row.memo || '-'}</td>
                      <td className="py-[5px] px-2 text-right font-medium text-ink">{formatWonFull(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Overwrite warning */}
        {hasExisting && preview.totalCount > 0 && (
          <div className="mx-6 mb-2 px-4 py-3 bg-warning/10 border rounded-field">
            <p className="text-body font-medium text-warning">
              {preview.year}년 기존 데이터 {preview.existingCount.toLocaleString()}건이 있습니다.
            </p>
            <p className="text-body text-warning mt-0.5">
              저장하면 기존 데이터가 모두 삭제되고 새 데이터 {preview.totalCount.toLocaleString()}건으로 교체됩니다.
            </p>
          </div>
        )}

        {/* Footer buttons */}
        <div className="p-6 border-t border-surface-low flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-field text-body text-ink-2 hover:bg-surface-low transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || preview.totalCount === 0}
            className={`px-4 py-2 rounded-field text-white text-body font-medium transition-colors ${
              hasExisting ? 'bg-amber-500 hover:bg-amber-600' : 'bg-action hover:bg-action'
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
