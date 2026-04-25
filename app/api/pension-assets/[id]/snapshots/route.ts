export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

function formatDate(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const sql = getSql()
    const rows = await sql`
      SELECT id, pension_asset_id, snapshot_date, amount, note, created_at
      FROM pension_snapshots
      WHERE pension_asset_id = ${id}
      ORDER BY snapshot_date ASC
    `
    return NextResponse.json(rows.map((r: Record<string, unknown>) => ({
      ...r,
      snapshot_date: formatDate(r.snapshot_date),
    })))
  } catch (e) {
    console.error('[GET /pension-assets/[id]/snapshots]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const { snapshot_date, amount, note } = await req.json()
    if (!snapshot_date || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: '날짜와 금액은 필수입니다' }, { status: 400 })
    }
    const sql = getSql()
    const [row] = await sql`
      INSERT INTO pension_snapshots (pension_asset_id, snapshot_date, amount, note)
      VALUES (${id}, ${snapshot_date}, ${Number(amount)}, ${note ?? ''})
      ON CONFLICT (pension_asset_id, snapshot_date) DO UPDATE
        SET amount = EXCLUDED.amount, note = EXCLUDED.note
      RETURNING id, pension_asset_id, snapshot_date, amount, note, created_at
    `
    return NextResponse.json({ ...row, snapshot_date: formatDate(row.snapshot_date) })
  } catch (e) {
    console.error('[POST /pension-assets/[id]/snapshots]', e)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
