export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidateCache } from '@/lib/cache'

interface MemoInput { label: string; amount?: number | null }

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { expense_date, category, detail, method, member, memos } = body
    const memoList: MemoInput[] = Array.isArray(memos) ? memos : []

    // 금액 결정: memos에 amount가 하나라도 있으면 합산, 없으면 body.amount 사용
    const hasAmounts = memoList.some(m => m.amount != null && m.amount > 0)
    const amount = hasAmounts
      ? memoList.reduce((s, m) => s + (m.amount ?? 0), 0)
      : Number(body.amount)

    if (!expense_date || !category || !amount || amount <= 0) {
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

    if (memoList.length > 0) {
      const memoRows = memoList
        .filter(m => m.label?.trim())
        .map((m, i) => ({
          expense_id: expense.id,
          label: m.label.trim(),
          amount: m.amount ?? null,
          sort_order: i,
        }))
      if (memoRows.length > 0) {
        await sql`INSERT INTO expense_memos ${sql(memoRows)}`
      }
    }

    invalidateCache()
    return NextResponse.json({ id: expense.id })
  } catch (e) {
    console.error('[expenses/create]', e)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
