export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { security_id, account_id, paid_at, amount, currency, exchange_rate, tax, memo } = await req.json()
    if (!security_id || !account_id || !paid_at || !amount) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }
    const sql = getSql()
    const [row] = await sql`
      UPDATE dividends
      SET security_id = ${security_id},
          account_id = ${account_id},
          paid_at = ${paid_at},
          amount = ${Number(amount)},
          currency = ${currency ?? 'KRW'},
          exchange_rate = ${Number(exchange_rate) || 1},
          tax = ${Number(tax) || 0},
          memo = ${memo ?? null}
      WHERE id = ${params.id}
      RETURNING *
    `
    if (!row) return NextResponse.json({ error: '없는 항목' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e: any) {
    console.error('[dividends PUT]', e?.message ?? e)
    return NextResponse.json({ error: e?.message ?? '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const sql = getSql()
    await sql`DELETE FROM dividends WHERE id = ${params.id}`
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[dividends DELETE]', e?.message ?? e)
    return NextResponse.json({ error: e?.message ?? '삭제 실패' }, { status: 500 })
  }
}
