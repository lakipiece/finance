export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const { income_date, category, description, amount, member } = await req.json()
    if (!income_date || !category || !amount || amount <= 0) {
      return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 })
    }
    const d = new Date(income_date)
    if (isNaN(d.getTime())) return NextResponse.json({ error: '잘못된 날짜' }, { status: 400 })
    const sql = getSql()
    await sql`
      UPDATE incomes SET
        income_date = ${income_date},
        year = ${d.getFullYear()},
        month = ${d.getMonth() + 1},
        category = ${category},
        description = ${description ?? ''},
        amount = ${amount},
        member = ${member ?? null}
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PATCH /incomes/[id]]', e)
    return NextResponse.json({ error: '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const sql = getSql()
    await sql`DELETE FROM incomes WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /incomes/[id]]', e)
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
}
