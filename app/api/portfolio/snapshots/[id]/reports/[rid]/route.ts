export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { requireSession } from '@/lib/auth-guard'
import { REPORT_VIEW_HEADERS, isUuid } from '@/lib/portfolio/reports'

type Params = { params: Promise<{ id: string; rid: string }> }

// 보기 — 업로드 원문을 격리 헤더와 함께 그대로 응답 (새 탭에서 열린다)
export async function GET(_: Request, { params }: Params) {
  const { id, rid } = await params
  const denied = await requireSession()
  if (denied) return denied
  if (!isUuid(id) || !isUuid(rid)) {
    return new NextResponse('보고서를 찾을 수 없습니다.', { status: 404 })
  }
  const sql = getSql()
  const [row] = await sql<{ html: string }[]>`
    SELECT html FROM snapshot_reports WHERE id = ${rid} AND snapshot_id = ${id}
  `
  if (!row) return new NextResponse('보고서를 찾을 수 없습니다.', { status: 404 })
  return new NextResponse(row.html, { headers: REPORT_VIEW_HEADERS })
}

export async function DELETE(_: Request, { params }: Params) {
  const { id, rid } = await params
  const denied = await requireSession()
  if (denied) return denied
  if (!isUuid(id) || !isUuid(rid)) {
    return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })
  }
  const sql = getSql()
  const rows = await sql`
    DELETE FROM snapshot_reports
    WHERE id = ${rid} AND snapshot_id = ${id}
    RETURNING id
  `
  if (rows.length === 0) {
    return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
