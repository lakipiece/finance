import { describe, expect, it } from 'vitest'
import {
  extractReportTitle, validateReportUpload, REPORT_VIEW_HEADERS, MAX_REPORT_BYTES, isUuid,
} from '@/lib/portfolio/reports'

describe('extractReportTitle', () => {
  it('<title>을 추출하고 엔티티·공백을 정리한다', () => {
    expect(extractReportTitle('<html><head><title>\n 가계 점검 &amp; v3 \n</title></head></html>', 'a.html'))
      .toBe('가계 점검 & v3')
  })
  it('title이 없거나 비어 있으면 확장자를 뗀 파일명', () => {
    expect(extractReportTitle('<html><body>x</body></html>', 'portfolio-review.html')).toBe('portfolio-review')
    expect(extractReportTitle('<title>  </title>', 'r.HTM')).toBe('r')
  })
  it('200자로 자른다', () => {
    expect(extractReportTitle(`<title>${'가'.repeat(300)}</title>`, 'a.html')).toHaveLength(200)
  })
})

describe('validateReportUpload', () => {
  const ok = { name: 'r.html', size: 1000, text: '<!doctype html><html></html>' }
  it('정상 파일은 null', () => {
    expect(validateReportUpload(ok)).toBeNull()
    expect(validateReportUpload({ ...ok, name: 'R.HTM', text: '<html lang="ko">' })).toBeNull()
  })
  it('확장자', () => {
    expect(validateReportUpload({ ...ok, name: 'r.txt' })).toBe('.html 파일만 업로드할 수 있습니다.')
  })
  it('빈 파일·크기 초과', () => {
    expect(validateReportUpload({ ...ok, size: 0 })).toBe('빈 파일입니다.')
    expect(validateReportUpload({ ...ok, size: MAX_REPORT_BYTES + 1 })).toBe('파일 크기는 5MB 이하여야 합니다.')
  })
  it('HTML 문서가 아니면 거부', () => {
    expect(validateReportUpload({ ...ok, text: 'hello' })).toBe('HTML 문서가 아닙니다.')
  })
})

describe('REPORT_VIEW_HEADERS', () => {
  it('앱 출처와 격리하고 캐시하지 않는다', () => {
    expect(REPORT_VIEW_HEADERS['Content-Security-Policy']).toMatch(/^sandbox /)
    expect(REPORT_VIEW_HEADERS['Content-Security-Policy']).not.toMatch(/allow-same-origin/)
    expect(REPORT_VIEW_HEADERS['Cache-Control']).toBe('private, no-store')
    expect(REPORT_VIEW_HEADERS['X-Content-Type-Options']).toBe('nosniff')
  })
})

describe('isUuid', () => {
  it('uuid 형식만 통과', () => {
    expect(isUuid('e3b2a58e-23a3-4d83-b637-12d749acdb50')).toBe(true)
    expect(isUuid('abc')).toBe(false)
    expect(isUuid("1' OR '1'='1")).toBe(false)
  })
})
