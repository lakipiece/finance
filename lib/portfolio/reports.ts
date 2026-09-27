// 스냅샷 보고서(업로드 HTML) 공용 로직 — 서버 라우트와 클라이언트가 함께 쓰므로 server-only 금지

export const MAX_REPORT_BYTES = 5 * 1024 * 1024

export type ReportMeta = {
  id: string
  title: string
  filename: string
  size: number
  created_at: string
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
}

/** HTML <title>을 제목으로. 없거나 비어 있으면 확장자를 뗀 파일명 */
export function extractReportTitle(html: string, filename: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const raw = (m?.[1] ?? '')
    .replace(/&(amp|lt|gt|quot|#39);/g, e => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim()
  const title = raw || filename.replace(/\.html?$/i, '')
  return title.slice(0, 200)
}

/** 업로드 검증 — 통과하면 null, 아니면 사용자에게 보여줄 사유 */
export function validateReportUpload(f: { name: string; size: number; text: string }): string | null {
  if (!/\.html?$/i.test(f.name)) return '.html 파일만 업로드할 수 있습니다.'
  if (f.size <= 0) return '빈 파일입니다.'
  if (f.size > MAX_REPORT_BYTES) return '파일 크기는 5MB 이하여야 합니다.'
  if (!/<!doctype html|<html[\s>]/i.test(f.text)) return 'HTML 문서가 아닙니다.'
  return null
}

// 업로드된 HTML은 스크립트를 포함한다. 앱과 같은 출처로 열리면 로그인 세션으로
// API를 호출할 수 있으므로 sandbox(allow-same-origin 없음)로 고유 출처에 격리한다.
// 스크립트(차트 툴팁 등)와 새 창 링크는 허용한다.
export const REPORT_VIEW_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, no-store',
}

/** 경로 파라미터가 uuid 형식인지 — 아니면 postgres가 22P02를 던지므로 미리 404 */
export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}
