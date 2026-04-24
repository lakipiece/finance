export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

function formatDate(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const sql = getSql()
    const rows = await sql`
      SELECT id, val_date, amount, note
      FROM asset_valuations
      WHERE asset_id = ${id}
      ORDER BY val_date ASC
    `
    return NextResponse.json(rows.map((r: Record<string, unknown>) => ({
      ...r,
      val_date: formatDate(r.val_date),
    })))
  } catch (e) {
    console.error('[GET /assets/[id]/valuations]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const { val_date, amount, note } = await req.json()
    if (!val_date || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: '날짜와 금액은 필수입니다' }, { status: 400 })
    }
    const sql = getSql()
    const [row] = await sql`
      INSERT INTO asset_valuations (asset_id, val_date, amount, note)
      VALUES (${id}, ${val_date}, ${Number(amount)}, ${note ?? ''})
      ON CONFLICT (asset_id, val_date) DO UPDATE
        SET amount = EXCLUDED.amount, note = EXCLUDED.note
      RETURNING id, val_date, amount, note
    `
    return NextResponse.json({ ...row, val_date: formatDate(row.val_date) })
  } catch (e) {
    console.error('[POST /assets/[id]/valuations]', e)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
