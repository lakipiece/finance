export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidateCache } from '@/lib/cache'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { expense_date, category, detail, method, member } = body
    const amount = Number(body.amount)

    if (!expense_date || !category || isNaN(amount)) {
      return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 })
    }

    const d = new Date(expense_date)
    if (isNaN(d.getTime())) return NextResponse.json({ error: '잘못된 날짜' }, { status: 400 })
    const year = d.getFullYear()
    const month = d.getMonth() + 1

    const sql = getSql()
    const [expense] = await sql`
      INSERT INTO expenses (expense_date, year, month, category, detail, method, amount, member, memo, source)
      VALUES (${expense_date}, ${year}, ${month}, ${category}, ${detail ?? ''}, ${method ?? ''}, ${amount}, ${member ?? null}, ${body.memo ?? ''}, 'manual')
      RETURNING id
    `

    invalidateCache()
    return NextResponse.json({ id: expense.id })
  } catch (e) {
    console.error('[expenses/create]', e)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
