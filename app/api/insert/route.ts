export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidateCache } from '@/lib/cache'
import type { RawExpenseRow } from '@/lib/types'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let rows: RawExpenseRow[], year: number, source: string, source_url: string
  try {
    const body = await req.json()
    rows = body.rows
    year = body.year
    source = body.source ?? 'excel'
    source_url = body.source_url ?? ''
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식입니다.' }, { status: 400 })
  }

  if (!Array.isArray(rows) || rows.length === 0 || !year) {
    return NextResponse.json({ error: '데이터가 없습니다.' }, { status: 400 })
  }
  if (rows.length > 5000) {
    return NextResponse.json({ error: '한번에 최대 5000건까지 저장 가능합니다.' }, { status: 400 })
  }

  // Ensure all rows belong to the declared year to prevent cross-year corruption
  const invalidRows = rows.filter(r => r.year !== year)
  if (invalidRows.length > 0) {
    return NextResponse.json({ error: `연도가 일치하지 않는 행이 ${invalidRows.length}건 있습니다.` }, { status: 400 })
  }

  // Prepare insert payload before deleting — validates data is complete before destructive op
  const toInsert = rows.map(r => ({
    year: r.year,
    month: r.month,
    expense_date: r.expense_date,
    category: r.category,
    detail: r.detail || null,
    method: r.method || null,
    memo: r.memo ?? '',
    amount: r.amount,
    member: r.member ?? null,
    source,
    source_url,
  }))

  const sql = getSql()

  try {
    await sql.begin(async (tx) => {
      await tx`DELETE FROM expenses WHERE year = ${year}`
      await tx`INSERT INTO expenses ${tx(toInsert)}`
    })
  } catch (e: any) {
    return NextResponse.json({ error: `저장 실패: ${e?.message}` }, { status: 500 })
  }

  invalidateCache()
  return NextResponse.json({ inserted: rows.length })
}
