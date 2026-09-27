export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { requireSession } from '@/lib/auth-guard'
import {
  extractReportTitle, validateReportUpload, isUuid, MAX_REPORT_BYTES,
} from '@/lib/portfolio/reports'

const NOT_FOUND = () => NextResponse.json({ error: '스냅샷을 찾을 수 없습니다.' }, { status: 404 })

// 목록 — 원문(html)은 빼고 메타만
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const denied = await requireSession()
  if (denied) return denied
  if (!isUuid(id)) return NOT_FOUND()
  const sql = getSql()
  const rows = await sql`
    SELECT id, title, filename, size, created_at
    FROM snapshot_reports WHERE snapshot_id = ${id}
    ORDER BY created_at DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const denied = await requireSession()
  if (denied) return denied
  if (!isUuid(id)) return NOT_FOUND()

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '파일을 선택해주세요.' }, { status: 400 })
  }
  // 본문을 읽기 전에 크기부터 막는다
  if (file.size > MAX_REPORT_BYTES) {
    return NextResponse.json({ error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 })
  }

  const text = await file.text()
  const error = validateReportUpload({ name: file.name, size: file.size, text })
  if (error) return NextResponse.json({ error }, { status: 400 })

  const sql = getSql()
  const [snap] = await sql`SELECT id FROM snapshots WHERE id = ${id}`
  if (!snap) return NOT_FOUND()

  const [row] = await sql`
    INSERT INTO snapshot_reports (snapshot_id, title, filename, html, size)
    VALUES (${id}, ${extractReportTitle(text, file.name)}, ${file.name}, ${text}, ${file.size})
    RETURNING id, title, filename, size, created_at
  `
  return NextResponse.json(row, { status: 201 })
}
