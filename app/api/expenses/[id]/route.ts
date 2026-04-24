export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidateCache } from '@/lib/cache'

interface MemoInput { label: string; amount?: number | null }
type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const { expense_date, category, detail, method, member, memos } = body
    const memoList: MemoInput[] = Array.isArray(memos) ? memos : []
    const hasAmounts = memoList.some(m => m.amount != null && m.amount > 0)
    const amount = hasAmounts
      ? memoList.reduce((s, m) => s + (m.amount ?? 0), 0)
      : Number(body.amount)

    if (!expense_date || !category || !amount || amount <= 0) {
      return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 })
    }

    const d = new Date(expense_date)
    if (isNaN(d.getTime())) return NextResponse.json({ error: '잘못된 날짜' }, { status: 400 })

    const sql = getSql()
    await sql.begin(async tx => {
      await tx`
        UPDATE expenses SET
          expense_date = ${expense_date},
          year = ${d.getFullYear()},
          month = ${d.getMonth() + 1},
          category = ${category},
          detail = ${detail ?? ''},
          method = ${method ?? ''},
          amount = ${amount},
          member = ${member ?? null},
          memo = ${body.memo ?? ''}
        WHERE id = ${id}
      `
      await tx`DELETE FROM expense_memos WHERE expense_id = ${id}`
      const rows = memoList
        .filter(m => m.label?.trim())
        .map((m, i) => ({
          expense_id: Number(id),
          label: m.label.trim(),
          amount: m.amount ?? null,
          sort_order: i,
        }))
      if (rows.length > 0) {
        await tx`INSERT INTO expense_memos ${tx(rows)}`
      }
    })

    invalidateCache()
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[expenses/[id] PATCH]', e)
    return NextResponse.json({ error: '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const sql = getSql()
    await sql`DELETE FROM expenses WHERE id = ${id}`
    invalidateCache()
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[expenses/[id] DELETE]', e)
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
}
