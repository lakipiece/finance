export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

const VALID_TYPES = ['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'opening']
type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const { account_id, flow_date, type, amount, memo } = await req.json()
    const amt = Number(amount)
    if (!account_id || !flow_date || !VALID_TYPES.includes(type) || !amt || amt <= 0) {
      return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 })
    }
    const sql = getSql()
    await sql`
      UPDATE account_cashflows SET
        account_id = ${account_id},
        flow_date = ${flow_date},
        type = ${type},
        amount = ${amt},
        memo = ${memo ?? ''}
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PATCH /portfolio/cashflows/[id]]', e)
    return NextResponse.json({ error: '수정 실패' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const sql = getSql()
    await sql`DELETE FROM account_cashflows WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /portfolio/cashflows/[id]]', e)
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
  }
}
