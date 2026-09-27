# 스냅샷 보고서 업로드 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 스냅샷에 standalone HTML 보고서를 여러 개 업로드하고, 격리된 새 탭에서 열람·삭제할 수 있게 한다.

**Architecture:** `snapshot_reports` 테이블에 HTML 원문을 저장한다. 검증·제목 추출·보기 헤더는 순수 함수(`lib/portfolio/reports.ts`)로 분리해 vitest로 테스트한다. 보기 응답은 `CSP: sandbox`로 앱 출처와 격리한다. UI는 스냅샷 편집 화면의 보고서 섹션(업로드·목록·삭제)과 스냅샷 목록 카드의 보고서 링크다.

**Tech Stack:** Next.js 14 App Router (route handler `params`는 동기 객체), postgres.js `getSql()`, NextAuth `requireSession()`, Tailwind + `lib/styles.ts`, vitest.

설계: `docs/plans/2026-09-27-snapshot-reports-design.md`

---

### Task 1: 마이그레이션

**Files:**
- Create: `docs/sql/2026-09-27-snapshot-reports.sql`
- Modify: `docs/schema.sql` (snapshots 테이블 정의 뒤에 추가)

```sql
-- 스냅샷에 첨부하는 HTML 보고서 (Claude로 생성한 가계 점검 보고서 등)
-- 원문을 DB에 저장해 기존 Postgres 백업에 함께 포함되게 한다.
CREATE TABLE IF NOT EXISTS snapshot_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  title       text NOT NULL,
  filename    text NOT NULL,
  html        text NOT NULL,
  size        integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_snapshot_reports_snapshot
  ON snapshot_reports (snapshot_id, created_at DESC);
```

Commit: `feat(reports): snapshot_reports 테이블 마이그레이션`

### Task 2: 순수 함수 (TDD)

**Files:**
- Create: `lib/portfolio/reports.ts`
- Test: `tests/reports.test.ts`

**Step 1: 실패하는 테스트**

```ts
import { describe, expect, it } from 'vitest'
import {
  extractReportTitle, validateReportUpload, REPORT_VIEW_HEADERS, MAX_REPORT_BYTES,
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
```

**Step 2:** `npx vitest run tests/reports.test.ts` → FAIL (모듈 없음)

**Step 3: 구현**

```ts
// 스냅샷 보고서(업로드 HTML) 공용 로직 — 서버 라우트와 클라이언트가 함께 쓰므로 server-only 금지

export const MAX_REPORT_BYTES = 5 * 1024 * 1024

export type ReportMeta = {
  id: string
  title: string
  filename: string
  size: number
  created_at: string
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

export function extractReportTitle(html: string, filename: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const raw = (m?.[1] ?? '')
    .replace(/&(amp|lt|gt|quot|#39);/g, e => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim()
  const title = raw || filename.replace(/\.html?$/i, '')
  return title.slice(0, 200)
}

export function validateReportUpload(f: { name: string; size: number; text: string }): string | null {
  if (!/\.html?$/i.test(f.name)) return '.html 파일만 업로드할 수 있습니다.'
  if (f.size <= 0) return '빈 파일입니다.'
  if (f.size > MAX_REPORT_BYTES) return '파일 크기는 5MB 이하여야 합니다.'
  if (!/<!doctype html|<html[\s>]/i.test(f.text)) return 'HTML 문서가 아닙니다.'
  return null
}

// 업로드된 HTML은 스크립트를 포함한다. 앱과 같은 출처로 열리면 로그인 세션으로
// API를 호출할 수 있으므로 sandbox(allow-same-origin 없음)로 고유 출처에 격리한다.
export const REPORT_VIEW_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Content-Security-Policy': 'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'private, no-store',
}
```

**Step 4:** `npx vitest run` → 전체 PASS

Commit: `feat(reports): 보고서 검증·제목 추출·격리 헤더`

### Task 3: 목록·업로드 API

**Files:** Create `app/api/portfolio/snapshots/[id]/reports/route.ts`

```ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { requireSession } from '@/lib/auth-guard'
import { extractReportTitle, validateReportUpload, MAX_REPORT_BYTES } from '@/lib/portfolio/reports'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const denied = await requireSession()
  if (denied) return denied
  const sql = getSql()
  const rows = await sql`
    SELECT id, title, filename, size, created_at
    FROM snapshot_reports WHERE snapshot_id = ${params.id}
    ORDER BY created_at DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireSession()
  if (denied) return denied

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: '파일을 선택해주세요.' }, { status: 400 })
  // 본문을 읽기 전에 크기부터 막는다
  if (file.size > MAX_REPORT_BYTES) return NextResponse.json({ error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 })

  const text = await file.text()
  const error = validateReportUpload({ name: file.name, size: file.size, text })
  if (error) return NextResponse.json({ error }, { status: 400 })

  const sql = getSql()
  const [snap] = await sql`SELECT id FROM snapshots WHERE id = ${params.id}`
  if (!snap) return NextResponse.json({ error: '스냅샷을 찾을 수 없습니다.' }, { status: 404 })

  const [row] = await sql`
    INSERT INTO snapshot_reports (snapshot_id, title, filename, html, size)
    VALUES (${params.id}, ${extractReportTitle(text, file.name)}, ${file.name}, ${text}, ${file.size})
    RETURNING id, title, filename, size, created_at
  `
  return NextResponse.json(row, { status: 201 })
}
```

Commit: `feat(reports): 보고서 목록·업로드 API`

### Task 4: 보기·삭제 API

**Files:** Create `app/api/portfolio/snapshots/[id]/reports/[rid]/route.ts`

```ts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { requireSession } from '@/lib/auth-guard'
import { REPORT_VIEW_HEADERS } from '@/lib/portfolio/reports'

type Params = { params: { id: string; rid: string } }

export async function GET(_: Request, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  const sql = getSql()
  const [row] = await sql<{ html: string }[]>`
    SELECT html FROM snapshot_reports WHERE id = ${params.rid} AND snapshot_id = ${params.id}
  `
  if (!row) return new NextResponse('보고서를 찾을 수 없습니다.', { status: 404 })
  return new NextResponse(row.html, { headers: REPORT_VIEW_HEADERS })
}

export async function DELETE(_: Request, { params }: Params) {
  const denied = await requireSession()
  if (denied) return denied
  const sql = getSql()
  const rows = await sql`
    DELETE FROM snapshot_reports WHERE id = ${params.rid} AND snapshot_id = ${params.id} RETURNING id
  `
  if (rows.length === 0) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

UUID 형식이 아닌 id는 postgres가 22P02를 던진다 → 두 핸들러 모두 id 형식 검사(`/^[0-9a-f-]{36}$/i`) 후 아니면 404.

Commit: `feat(reports): 보고서 보기(격리)·삭제 API`

### Task 5: 편집 화면 보고서 섹션

**Files:**
- Create: `components/portfolio/SnapshotReports.tsx` (client)
- Modify: `app/portfolio/snapshots/[id]/page.tsx` — 초기 목록 조회 + `<SnapshotEditor/>` 아래 렌더

컴포넌트: `card.base` 섹션, 제목 "보고서", `btn.secondary` 업로드 버튼 + 숨긴 `<input type="file" accept=".html,.htm,text/html">`, 목록(제목 링크 새 탭 · 업로드일 · KB) + `btn.danger` 삭제(confirm). 오류는 `text-danger` 한 줄. 업로드 중 버튼 disabled.

Commit: `feat(reports): 스냅샷 편집 화면 보고서 섹션`

### Task 6: 스냅샷 목록 카드 링크

**Files:**
- Modify: `app/portfolio/snapshots/page.tsx` — `SELECT snapshot_id, id, title FROM snapshot_reports ORDER BY created_at DESC` (`.catch(() => [])`) → 스냅샷별 `reports`
- Modify: `components/portfolio/SnapshotList.tsx` — `SnapshotItem.reports?`, 메모 위에 보고서 링크(새 탭, `stopPropagation`)

Commit: `feat(reports): 스냅샷 카드에 보고서 링크`

### Task 7: 검증 · 배포

1. `npx vitest run`, `npx tsc --noEmit`, `npm run build`
2. 서버에 마이그레이션 적용 (추가 전용이라 기존 앱에 영향 없음)
3. master에 병합 → push → 서버 pull·build·up (deploy-finance)
4. 운영에서 확인: 9월 스냅샷에 v3 업로드 → 목록·새 탭 열기 → 응답 헤더(CSP sandbox) 확인 → 격리 확인
