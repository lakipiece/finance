import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getSql } from '@/lib/db'
import { parseExcelBuffer } from '@/lib/parseExcelBuffer'
import type { ParsePreviewResponse, RawExpenseRow } from '@/lib/types'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const yearStr = formData.get('year') as string | null

  if (!file || !yearStr) {
    return NextResponse.json({ error: '파일과 연도를 모두 입력해주세요.' }, { status: 400 })
  }

  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: '.xlsx 파일만 업로드 가능합니다.' }, { status: 400 })
  }

  const yearNum = parseInt(yearStr)
  if (isNaN(yearNum)) return NextResponse.json({ error: '연도가 올바르지 않습니다.' }, { status: 400 })

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다.' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let rows: RawExpenseRow[]
  try {
    rows = parseExcelBuffer(buffer, yearNum)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 422 })
  }

  const sql = getSql()
  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM expenses WHERE year = ${yearNum}`
  const existingCount = count ?? 0

  const response: ParsePreviewResponse = {
    rows,
    totalCount: rows.length,
    existingCount,
    sampleRows: rows.slice(0, 10),
    year: yearNum,
  }

  return NextResponse.json(response)
}
