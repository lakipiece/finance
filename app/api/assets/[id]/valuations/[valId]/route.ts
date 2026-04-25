import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; valId: string }> }

function formatDate(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, valId } = await params
  const { val_date, amount, note } = await req.json()
  if (!val_date || !amount || Number(amount) <= 0) {
    return NextResponse.json({ error: '날짜와 금액은 필수입니다' }, { status: 400 })
  }
  const sql = getSql()
  const [row] = await sql`
    UPDATE asset_valuations
    SET val_date = ${val_date}, amount = ${Number(amount)}, note = ${note ?? ''}
    WHERE id = ${valId} AND asset_id = ${id}
    RETURNING id, val_date, amount, note`
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...row, val_date: formatDate(row.val_date) })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, valId } = await params
  const sql = getSql()
  await sql`DELETE FROM asset_valuations WHERE id = ${valId} AND asset_id = ${id}`
  return NextResponse.json({ ok: true })
}
