export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { invalidateCache } from '@/lib/cache'

interface MemoInput { label: string; amount?: number | null }
type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const sql = getSql()
  const [row] = await sql`
    SELECT id, expense_date, category, detail, method, member, amount, memo
    FROM expenses WHERE id = ${id}
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    id: row.id,
    expense_date: row.expense_date instanceof Date ? row.expense_date.toISOString().slice(0, 10) : row.expense_date,
    category: row.category ?? '',
    detail: row.detail ?? '',
    method: row.method ?? '',
    member: row.member ?? 'L',
    amount: row.amount ?? 0,
    memo: row.memo ?? '',
  })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const body = await req.json()
    const { expense_date, category, detail, method, member, memos } = body
    const memoList: MemoInput[] = Array.isArray(memos) ? memos : []
    const hasAmounts = memoList.some(m => m.amount != null)
    const amount = hasAmounts
      ? memoList.reduce((s, m) => s + (m.amount ?? 0), 0)
      : Number(body.amount)

    if (!expense_date || !category || isNaN(amount)) {
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
